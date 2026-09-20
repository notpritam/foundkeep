"""Public, credential-free yt-dlp boundary. Run only with an isolated pinned Python.

All Python networking is checked at the actual numeric socket connection, not
merely at source validation. No native request handlers, plugins or subprocesses
are permitted. The parent kills this process group on deadline/cancellation.
"""
import copy
import functools
import io
import ipaddress
import json
import math
import os
from pathlib import Path
import resource
import re
import socket
import stat as statmod
import sys
import urllib.parse
import urllib.request
import zlib

MAX_BYTES = 50 * 1024 * 1024
MAX_AUDIO_BYTES = 16 * 1024 * 1024
MAX_DURATION = 1800
MAX_NETWORK_BYTES = 100 * 1024 * 1024
V4_BLOCKS = tuple(ipaddress.ip_network(value) for value in (
    '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
    '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
    '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15',
    '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4'))
V6_GLOBAL = ipaddress.ip_network('2000::/3')
V6_BLOCKS = tuple(ipaddress.ip_network(value) for value in (
    '2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20'))


class BoundaryError(Exception):
    pass


class TooLarge(BoundaryError):
    pass


class Unsupported(BoundaryError):
    pass


def is_public_address(address):
    try:
        if not isinstance(address, str) or '%' in address:
            return False
        ip = ipaddress.ip_address(address)
        if ip.version == 4:
            return not any(ip in block for block in V4_BLOCKS)
        return ip in V6_GLOBAL and not any(ip in block for block in V6_BLOCKS)
    except ValueError:
        return False


def public_url(raw):
    if not isinstance(raw, str) or len(raw) > 16384 or any(ord(c) < 32 for c in raw):
        raise BoundaryError('Invalid URL')
    try:
        url = urllib.parse.urlsplit(raw)
        if url.scheme not in ('https', 'http') or not url.hostname or url.username is not None or url.password is not None:
            raise BoundaryError('Invalid URL')
        if url.port not in (None, 443 if url.scheme == 'https' else 80):
            raise BoundaryError('Invalid port')
        try:
            ipaddress.ip_address(url.hostname)
        except ValueError:
            if '%' in url.hostname:
                raise BoundaryError('Invalid hostname')
        else:
            if not is_public_address(url.hostname):
                raise BoundaryError('Private address')
        return raw
    except ValueError as error:
        raise BoundaryError('Invalid URL') from error


def validate_cookie_file(path):
    """An operator-supplied Netscape jar: absolute, regular, private, small.

    yt-dlp rewrites this file in place when it closes, so a symlink here would
    be a write primitive as well as a read one; lstat plus S_ISREG refuses both.
    Group/other permission bits mean the jar is already shared and is not used.
    """
    if not isinstance(path, str) or not os.path.isabs(path) or len(path) > 4096 or '\x00' in path:
        raise BoundaryError('Invalid cookie file')
    try:
        info = os.lstat(path)
    except OSError as error:
        raise BoundaryError('Missing cookie file') from error
    if not statmod.S_ISREG(info.st_mode) or (info.st_mode & 0o077) or info.st_size > 256 * 1024:
        raise BoundaryError('Cookie file must be a private regular file')
    return path


def install_network_guard():
    original_getaddrinfo = socket.getaddrinfo
    request_count = 0

    def resolve(*args, **kwargs):
        answers = original_getaddrinfo(*args, **kwargs)
        if not answers or any(not is_public_address(answer[4][0]) for answer in answers):
            raise BoundaryError('DNS returned a nonpublic address')
        return answers

    socket.getaddrinfo = resolve

    def audit(event, args):
        nonlocal request_count
        if event == 'socket.__new__':
            _, family, kind, protocol = args
            if family not in (socket.AF_INET, socket.AF_INET6) or kind != socket.SOCK_STREAM or protocol not in (0, socket.IPPROTO_TCP):
                raise BoundaryError('Only public TCP is permitted')
        elif event == 'socket.connect':
            sock, address = args
            if sock.family not in (socket.AF_INET, socket.AF_INET6) or sock.type != socket.SOCK_STREAM or not isinstance(address, tuple) or len(address) < 2 or address[1] not in (80, 443) or not is_public_address(address[0]):
                raise BoundaryError('Connection target is not a numeric public HTTP address')
        elif event in ('socket.bind', 'socket.sendto', 'socket.sendmsg'):
            raise BoundaryError('Listening and datagram networking are disabled')
        elif event == 'urllib.Request':
            public_url(args[0])
            request_count += 1
            if request_count > 100:
                raise BoundaryError('Request budget exceeded')
        elif event in ('subprocess.Popen', 'os.system', 'os.exec', 'os.posix_spawn', 'os.fork', 'os.forkpty'):
            raise BoundaryError('Extractor subprocesses are disabled')

    sys.addaudithook(audit)


class PublicRedirectHandler(urllib.request.HTTPRedirectHandler):
    max_redirections = 5
    max_repeats = 2

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def write_response(response, output, maximum):
    written = 0
    try:
        declared = response.headers.get('Content-Length')
        if declared and int(declared) > maximum:
            raise TooLarge('Declared size exceeds limit')
        with open(output, 'xb') as handle:
            while True:
                chunk = response.read(min(64 * 1024, maximum - written + 1))
                if not chunk:
                    break
                written += len(chunk)
                if written > maximum:
                    raise TooLarge('Download exceeds limit')
                handle.write(chunk)
        if not written:
            raise BoundaryError('Empty video')
        if declared and int(declared) != written:
            raise BoundaryError('Truncated video')
    except BaseException:
        output.unlink(missing_ok=True)
        raise


class QuietLogger:
    def debug(self, *args, **kwargs):
        pass

    info = warning = error = debug


VIDEO_CODECS = ('avc1', 'avc3', 'h264')
AUDIO_CODECS = ('mp4a', 'aac')


def positive(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) and value > 0 else None


def codec_is(value, prefixes):
    """Strict codec match: an unknown codec is not one of these."""
    return isinstance(value, str) and value.startswith(prefixes)


def resolution_rank(candidate):
    """Highest resolution up to a 720 short edge; when only larger renditions
    exist, the closest above it. Unknown dimensions rank last, and ties go to
    the higher bitrate and then the higher frame rate."""
    width, height = positive(candidate.get('width')), positive(candidate.get('height'))
    resolution = min(width, height) if width and height else height or width or 0
    rank = (2, resolution) if 0 < resolution <= 720 else (1, -resolution) if resolution > 720 else (0, 0)
    return (*rank, positive(candidate.get('tbr')) or 0, positive(candidate.get('fps')) or 0)


def select_progressive_format(context, maximum):
    """Prefer the best picture up to a 720p short edge within the byte budget.

    yt-dlp populates filesize_approx from bitrate and actual source duration
    before calling this selector. Unknown sizes remain candidates; only the
    subsequent bounded streaming write can establish that they fit.
    """
    def codec_matches(value, prefixes):
        return value in (None, 'unknown') or any(str(value).startswith(prefix) for prefix in prefixes)

    source_has_audio = any(
        entry.get('acodec') not in (None, 'unknown', 'none')
        or (entry.get('vcodec') == 'none' and entry.get('acodec') != 'none')
        or positive(entry.get('audio_channels'))
        for entry in context['formats'])
    candidates = []
    oversized = False
    for candidate in context['formats']:
        if candidate.get('ext') != 'mp4' or candidate.get('protocol') not in ('http', 'https'):
            continue
        if not codec_matches(candidate.get('vcodec'), ('avc1', 'avc3', 'h264')):
            continue
        silent = candidate.get('acodec') == 'none'
        if silent:
            # A complete silent original is playable. Do not mistake an adaptive
            # video track for that original when the source has audio evidence.
            if source_has_audio or candidate.get('manifest_url') or candidate.get('fragments') or 'dash' in str(candidate.get('container', '')):
                continue
        elif not codec_matches(candidate.get('acodec'), ('mp4a.40', 'aac')):
            continue
        size = positive(candidate.get('filesize')) or positive(candidate.get('filesize_approx'))
        if size is not None and size > maximum:
            oversized = True
            continue
        candidates.append((resolution_rank(candidate), candidate))
    if candidates:
        yield max(candidates, key=lambda item: item[0])[1]
    elif oversized:
        raise TooLarge('All compatible formats exceed the size budget')


def select_split_formats(context, maximum):
    """Pair one video-only MP4 track with one audio-only MP4 track.

    YouTube publishes no progressive rendition over plain HTTPS, only adaptive
    halves, so the picture and the sound are chosen together and the parent
    muxes them with a stream copy. Both halves must therefore already be MP4
    codecs. No new protocol is involved: a fragmented or m3u8 half is simply
    never a candidate. The pair is returned in yt-dlp's own requested_formats
    shape, which is how the format-selector contract says "these two".
    """
    audio_maximum = min(maximum, MAX_AUDIO_BYTES)
    videos, audios = [], []
    oversized = False
    for candidate in context['formats']:
        if candidate.get('protocol') not in ('http', 'https'):
            continue
        if candidate.get('fragments') or candidate.get('has_drm'):
            continue
        size = positive(candidate.get('filesize')) or positive(candidate.get('filesize_approx'))
        if candidate.get('acodec') == 'none' and candidate.get('ext') == 'mp4' and codec_is(candidate.get('vcodec'), VIDEO_CODECS):
            if size is not None and size > maximum:
                oversized = True
            else:
                videos.append((resolution_rank(candidate), candidate))
        elif candidate.get('vcodec') == 'none' and candidate.get('ext') in ('m4a', 'mp4') and codec_is(candidate.get('acodec'), AUDIO_CODECS):
            if size is None or size <= audio_maximum:
                audios.append(((positive(candidate.get('abr')) or 0, positive(candidate.get('tbr')) or 0), candidate))
    if not videos:
        if oversized:
            raise TooLarge('All compatible formats exceed the size budget')
        return None
    if not audios:
        # A picture with no usable sound is not worth two downloads and a mux.
        return None
    video = max(videos, key=lambda item: item[0])[1]
    audio = max(audios, key=lambda item: item[0])[1]
    sizes = [positive(entry.get('filesize')) or positive(entry.get('filesize_approx')) or 0 for entry in (video, audio)]
    return {
        'requested_formats': [video, audio], 'ext': 'mp4',
        'format_id': '+'.join(str(entry.get('format_id') or '') for entry in (video, audio)),
        'protocol': '+'.join(str(entry.get('protocol')) for entry in (video, audio)),
        'vcodec': video.get('vcodec'), 'acodec': audio.get('acodec'),
        'width': video.get('width'), 'height': video.get('height'), 'fps': video.get('fps'),
        'filesize_approx': sum(sizes) or None,
    }


def select_format(context, maximum):
    """A progressive MP4 keeps first claim; a pair is only considered when no
    single playable file fits, so a source that still offers one is never muxed.
    An oversized progressive rendition must not hide a smaller adaptive one,
    but it is still the reported reason when nothing else can be paired."""
    oversized = None
    try:
        progressive = list(select_progressive_format(context, maximum))
    except TooLarge as error:
        progressive, oversized = [], error
    if progressive:
        yield progressive[0]
        return
    pair = select_split_formats(context, maximum)
    if pair:
        yield pair
    elif oversized is not None:
        raise oversized


def split_stream_pair(requested):
    """Re-check the selector's pair at the point of use.

    Exactly one video-only and one audio-only track, both plain HTTP(S) MP4 in
    codecs the stream-copy mux accepts. A third track, a fragmented half or a
    swapped role is refused rather than fetched, so what reaches the network is
    what was chosen.
    """
    if not isinstance(requested, list) or len(requested) != 2 or not all(isinstance(entry, dict) for entry in requested):
        raise Unsupported('Only one video and one audio track may be combined')
    video = next((entry for entry in requested if entry.get('acodec') == 'none'), None)
    audio = next((entry for entry in requested if entry.get('vcodec') == 'none'), None)
    if video is None or audio is None or video is audio:
        raise Unsupported('Only one video and one audio track may be combined')
    if any(entry.get('protocol') not in ('http', 'https') for entry in requested):
        raise Unsupported('Only progressive HTTP streams are supported')
    if any(entry.get('fragments') or entry.get('has_drm') for entry in requested):
        raise Unsupported('Only complete unencrypted HTTP tracks may be combined')
    if video.get('ext') != 'mp4' or not codec_is(video.get('vcodec'), VIDEO_CODECS):
        raise Unsupported('Only an MP4 H.264 video track may be combined')
    if audio.get('ext') not in ('m4a', 'mp4') or not codec_is(audio.get('acodec'), AUDIO_CODECS):
        raise Unsupported('Only an MP4 AAC audio track may be combined')
    return video, audio


def extractor_options(maximum, duration, cookie_file=None):
    return {
        'quiet': True, 'no_warnings': True, 'logger': QuietLogger(),
        'proxy': '', 'geo_verification_proxy': '', 'usenetrc': False,
        'cookiefile': validate_cookie_file(cookie_file) if cookie_file else None,
        'cookiesfrombrowser': None, 'cachedir': False,
        'js_runtimes': {}, 'remote_components': [], 'enable_file_urls': False,
        'external_downloader': {}, 'fixup': 'never', 'postprocessors': [],
        'outtmpl': 'video.mp4', 'noplaylist': True, 'playlistend': 1,
        'extract_flat': 'in_playlist', 'lazy_playlist': True,
        'max_downloads': 1, 'max_filesize': maximum,
        'socket_timeout': 10, 'retries': 0, 'fragment_retries': 0,
        'extractor_retries': 0, 'file_access_retries': 0,
        'concurrent_fragment_downloads': 1, 'hls_prefer_native': True,
        'continuedl': False, 'nopart': True, 'overwrites': False,
        'writethumbnail': False, 'writeinfojson': False, 'writesubtitles': False,
        'writeautomaticsub': False, 'getcomments': False,
        # Progressive MP4 requires no external downloader/muxer/runtime, and an
        # adaptive pair needs only the parent's existing ffmpeg stream copy. A
        # direct MP4 may have unknown codec metadata; ffprobe independently
        # checks the file that is actually kept.
        'format': lambda context: select_format(context, maximum),
        'check_formats': False,
        'match_filter': lambda info, **kwargs: 'unsupported stream' if info.get('is_live') or (info.get('duration') or 0) > duration else None,
    }


def validate_info(info, duration):
    if not isinstance(info, dict) or info.get('_type', 'video') != 'video' or 'entries' in info or info.get('is_live') or info.get('live_status') in ('is_live', 'is_upcoming', 'post_live'):
        raise Unsupported('Only a single recorded video is supported')
    seconds = info.get('duration')
    if seconds is not None and (not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or seconds <= 0 or seconds > duration):
        raise Unsupported('Duration exceeds limit')


class Budget:
    def __init__(self):
        self.bytes = 0
        self.wire_bytes = 0
        self.requests = 0


class InflateReader(io.RawIOBase):
    """Incremental gzip/deflate decoder; never inflate an entire hostile body."""
    def __init__(self, source, encoding):
        super().__init__()
        self.source = source
        self.encoding = encoding
        self.inflater = zlib.decompressobj(31 if encoding == 'gzip' else zlib.MAX_WBITS)
        self.pending = b''
        self.first = True

    def readable(self):
        return True

    def readinto(self, buffer):
        if not buffer or self.inflater.eof:
            return 0
        while True:
            if not self.pending:
                self.pending = self.source.read(64 * 1024)
                if not self.pending:
                    raise BoundaryError('Truncated compressed response')
            try:
                data = self.inflater.decompress(self.pending, len(buffer))
            except zlib.error as error:
                if self.first and self.encoding == 'deflate':
                    self.inflater = zlib.decompressobj(-zlib.MAX_WBITS)
                    self.encoding = 'raw-deflate'
                    continue
                raise BoundaryError('Invalid compressed response') from error
            self.first = False
            self.pending = self.inflater.unconsumed_tail
            if data:
                buffer[:len(data)] = data
                return len(data)
            if self.inflater.eof:
                return 0

    def close(self):
        self.source.close()
        super().close()


class ResponseBudgetHandler(urllib.request.BaseHandler):
    # Run before yt-dlp HTTPHandler (500), cookie processing, and urllib's
    # HTTPErrorProcessor (1000). Redirect drains and exception bodies therefore
    # see only bounded streams, including during decompression.
    handler_order = 0

    def __init__(self, budget):
        self.budget = budget

    def http_response(self, request, response):
        raw = BoundedResponse(response, self.budget, 'wire_bytes')
        headers = copy.copy(response.headers)
        encoding = headers.get('Content-Encoding', 'identity').strip().lower()
        if encoding in ('gzip', 'deflate'):
            stream = io.BufferedReader(InflateReader(raw, encoding))
            del headers['Content-Encoding']
            if 'Content-Length' in headers:
                del headers['Content-Length']
        elif encoding in ('', 'identity'):
            stream = raw
        else:
            raw.close()
            raise Unsupported('Unsupported response encoding')
        decoded = BoundedResponse(stream, self.budget)
        wrapped = urllib.request.addinfourl(decoded, headers, response.url, response.code)
        decoded.owner_close = wrapped.close
        wrapped.msg = response.msg
        return wrapped

    https_response = http_response


def public_request_handler(budget):
    from yt_dlp.networking._urllib import UrllibRH

    class PublicUrllibRH(UrllibRH):
        def _create_instance(self, *args, **kwargs):
            opener = super()._create_instance(*args, **kwargs)
            opener.add_handler(ResponseBudgetHandler(budget))
            return opener

    return PublicUrllibRH


class BoundedResponse:
    """Every extractor, downloader and subtitle read shares one request budget."""
    def __init__(self, response, budget, counter='bytes'):
        self.response = response
        self.budget = budget
        self.counter = counter
        self.owner_close = None

    def __getattr__(self, name):
        return getattr(self.response, name)

    def _read(self, method, size):
        consumed = getattr(self.budget, self.counter)
        remaining = MAX_NETWORK_BYTES - consumed
        if remaining < 0:
            (self.owner_close or self.close)()
            raise TooLarge('Network budget exhausted')
        amount = min(size if size is not None and size >= 0 else remaining + 1, remaining + 1)
        try:
            data = method(amount)
            setattr(self.budget, self.counter, consumed + len(data))
            if consumed + len(data) > MAX_NETWORK_BYTES:
                raise TooLarge('Network budget exceeded')
            return data
        except BaseException:
            (self.owner_close or self.close)()
            raise

    def read(self, size=-1):
        return self._read(self.response.read, size)

    def read1(self, size=-1):
        return self._read(getattr(self.response, 'read1', self.response.read), size)

    def readline(self, size=-1):
        return self._read(self.response.readline, size)

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)

    def __iter__(self):
        return self

    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line

    def readlines(self, hint=-1):
        lines = []
        total = 0
        for line in self:
            lines.append(line)
            total += len(line)
            if hint > 0 and total >= hint:
                break
        return lines

    def close(self):
        self.owner_close = None
        self.response.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# One process handles one source, so the video and every audio attempt share a
# single wire budget instead of each renewing the network ceiling.
DIRECT_BUDGET = Budget()


def open_direct(request, timeout):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), PublicRedirectHandler(), ResponseBudgetHandler(DIRECT_BUDGET))
    return opener.open(request, timeout=timeout)


def direct_download(source, maximum, audio_urls):
    """A direct MP4 needs no platform extractor, but uses the same actual
    connection guard, verified TLS, redirect checks and streaming limits.

    Some hosts (Reddit) serve the picture and the sound as two sibling files.
    Only the caller's own candidates are tried, only on the video's own host,
    and only until one works; the parent muxes them. A missing or oversized
    audio track leaves a playable silent video rather than failing the save.
    """
    request = urllib.request.Request(source, headers={'Accept': 'video/mp4', 'Accept-Encoding': 'identity', 'User-Agent': 'Foundkeep-Public-Media/1.0'})
    with open_direct(request, 10) as response:
        write_response(response, Path('video.mp4'), maximum)
    audio = False
    video_host = urllib.parse.urlsplit(source).hostname
    for candidate in (audio_urls or [])[:3]:
        try:
            url = public_url(candidate)
            parts = urllib.parse.urlsplit(url)
            if parts.hostname != video_host or not parts.path.lower().endswith(('.mp4', '.m4a')):
                continue
            request = urllib.request.Request(url, headers={'Accept': 'audio/mp4,video/mp4', 'Accept-Encoding': 'identity', 'User-Agent': 'Foundkeep-Public-Media/1.0'})
            with open_direct(request, 10) as response:
                write_response(response, Path('audio.m4a'), min(maximum, MAX_AUDIO_BYTES))
            audio = True
            break
        except Exception:
            # Any failed candidate (refused, truncated, malformed length, bad
            # compression) costs only the sound, never the whole save.
            Path('audio.m4a').unlink(missing_ok=True)
            continue
    return {'status': 'downloaded', 'subtitles': [], 'audio': audio}


def fetch_track(downloader, track, output, maximum):
    """Honor extractor HTTP chunk hints without enabling a downloader plugin.

    YouTube throttles a whole-track request. Its extractor specifies bounded
    HTTP ranges; every range still uses the same guarded opener and budget.
    Reject gaps, changed lengths and truncation instead of assembling a corrupt
    file. Servers ignoring the first Range may still stream a complete file.
    """
    from yt_dlp.networking import Request
    output = Path(output)
    url = public_url(track.get('url'))
    if positive(track.get('filesize')) and track['filesize'] > maximum:
        raise TooLarge('Stream exceeds limit')
    headers = {key: value for key, value in (track.get('http_headers') or {}).items() if key.lower() not in ('range', 'accept-encoding')}
    headers['Accept-Encoding'] = 'identity'
    hint = positive((track.get('downloader_options') or {}).get('http_chunk_size'))
    if not hint:
        with downloader.urlopen(Request(url, headers=headers)) as response:
            write_response(response, output, maximum)
        return
    chunk_size = max(1, min(int(hint), 10 * 1024 * 1024))
    offset, total, handle = 0, None, None
    try:
        while total is None or offset < total:
            end = min(offset + chunk_size, total if total is not None else maximum) - 1
            with downloader.urlopen(Request(url, headers={**headers, 'Range': f'bytes={offset}-{end}'})) as response:
                if response.status == 200 and offset == 0 and not response.headers.get('Content-Range'):
                    write_response(response, output, maximum)
                    return
                match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range') or '')
                if response.status != 206 or not match:
                    raise BoundaryError('Invalid HTTP range response')
                first, last, length = map(int, match.groups())
                if length > maximum:
                    raise TooLarge('Stream exceeds limit')
                if length <= 0 or first != offset or last != min(end, length - 1) or (total is not None and total != length):
                    raise BoundaryError('Inconsistent HTTP range response')
                total = length
                expected, written = last - first + 1, 0
                if handle is None:
                    handle = open(output, 'xb')
                while True:
                    data = response.read(min(64 * 1024, expected - written + 1))
                    if not data:
                        break
                    written += len(data)
                    if written > expected:
                        raise BoundaryError('HTTP range exceeds its declared length')
                    handle.write(data)
                if written != expected:
                    raise BoundaryError('Truncated HTTP range')
                offset += written
    except BaseException:
        if handle is not None:
            handle.close()
        output.unlink(missing_ok=True)
        raise
    finally:
        if handle is not None:
            handle.close()


def extract(source, maximum, duration, cookie_file=None):
    import yt_dlp
    from yt_dlp.globals import all_plugins_loaded, plugin_dirs
    from yt_dlp.version import __version__
    if __version__ != '2026.08.19':
        raise BoundaryError('Unreviewed yt-dlp version')
    # Embedding bypasses CLI configuration; disable plugin discovery before
    # constructing YoutubeDL (the pinned internal API is deliberately tested).
    plugin_dirs.value = []
    all_plugins_loaded.value = True
    budget = Budget()

    class PublicYoutubeDL(yt_dlp.YoutubeDL):
        @functools.cached_property
        def _request_director(self):
            return self.build_request_director([public_request_handler(budget)])

        def urlopen(self, req):
            public_url(req if isinstance(req, str) else req.url)
            budget.requests += 1
            if budget.requests > 100:
                raise BoundaryError('Request budget exceeded')
            return super().urlopen(req)

    with PublicYoutubeDL(extractor_options(maximum, duration, cookie_file)) as downloader:
        info = downloader.extract_info(source, download=False)
        validate_info(info, duration)

        audio = False
        if info.get('requested_formats'):
            # No progressive MP4 exists (YouTube): the picture and the sound are
            # two plain HTTPS tracks fetched over this same guarded transport,
            # each bounded on its own, and the parent muxes them into one file.
            video_track, audio_track = split_stream_pair(info['requested_formats'])
            fetch_track(downloader, video_track, 'video.mp4', maximum)
            try:
                fetch_track(downloader, audio_track, 'audio.m4a', min(maximum, MAX_AUDIO_BYTES))
                audio = True
            except Exception:
                # A refused, oversized or malformed audio track costs only the
                # sound; the parent keeps the silent picture rather than the
                # save failing outright.
                Path('audio.m4a').unlink(missing_ok=True)
        else:
            if info.get('protocol') not in ('http', 'https') or info.get('ext') != 'mp4':
                raise Unsupported('No progressive MP4 available')
            fetch_track(downloader, info, 'video.mp4', maximum)
        subtitles = []
        for automatic, collection in ((False, info.get('subtitles')), (True, info.get('automatic_captions'))):
            if subtitles or not isinstance(collection, dict):
                continue
            languages = sorted(collection, key=lambda language: (not language.startswith('en'), language))
            for language in languages[:2]:
                tracks = collection[language]
                track = next((entry for entry in tracks if entry.get('ext') == 'vtt' and entry.get('url')), None)
                if not track:
                    continue
                try:
                    with downloader.urlopen(track['url']) as response:
                        data = response.read(32_001)
                    if len(data) <= 32_000 and data.lstrip(b'\xef\xbb\xbf').startswith(b'WEBVTT'):
                        subtitles.append({'language': language[:32], 'automatic': automatic, 'text': data.decode('utf-8', 'replace')})
                except Exception:
                    # Optional evidence must never become a fabricated transcript.
                    continue
        return {'status': 'downloaded', 'audio': audio, 'title': str(info.get('title') or '')[:1000],
                'description': str(info.get('description') or '')[:16000],
                'author': str(info.get('uploader') or info.get('creator') or '')[:500], 'subtitles': subtitles}


def main():
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES, MAX_BYTES))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    install_network_guard()
    result = {'status': 'error'}
    try:
        payload = sys.stdin.buffer.read(8193)
        if len(payload) > 8192:
            raise BoundaryError('Oversized input')
        options = json.loads(payload)
        source = public_url(options['url'])
        maximum = min(MAX_BYTES, max(1, int(options['maxBytes'])))
        duration = min(MAX_DURATION, max(1, int(options['maxDurationSeconds'])))
        cookie_file = options.get('cookieFile')
        if cookie_file is not None:
            cookie_file = validate_cookie_file(cookie_file)
        audio_urls = options.get('audioUrls')
        if audio_urls is not None and (not isinstance(audio_urls, list) or len(audio_urls) > 3 or not all(isinstance(entry, str) for entry in audio_urls)):
            raise BoundaryError('Invalid audio URLs')
        resource.setrlimit(resource.RLIMIT_FSIZE, (maximum, maximum))
        if urllib.parse.urlsplit(source).path.lower().endswith('.mp4'):
            result = direct_download(source, maximum, audio_urls)
        else:
            result = extract(source, maximum, duration, cookie_file)
    except TooLarge:
        result = {'status': 'too_large'}
    except Unsupported:
        result = {'status': 'unsupported'}
    except BoundaryError:
        result = {'status': 'error'}
    except Exception:
        result = {'status': 'unavailable'}
    print(json.dumps(result, ensure_ascii=True))


if __name__ == '__main__':
    main()

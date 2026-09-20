# YouTube video: split video+audio streams — design

Date: 2026-09-20. Status: approved in chat ("complete everything").
Builds on `2026-09-18-social-resolvers-design.md` §5 (video path with muxing).

## Problem

YouTube saves keep the title and thumbnail but never a video file. The sandboxed helper
(`apps/backend/scripts/customer-remote-media.py`) only accepts a **progressive** MP4 — one URL
carrying both video and audio — and YouTube no longer offers one.

Measured from omni on 2026-09-20 (`yt-dlp --list-formats`, default player clients):

| Offered | Examples |
|---|---|
| video-only MP4 over **https**, avc1/h264 | 160 (144p), 133 (240p), 134 (360p), 135 (480p), 136 (720p), 137 (1080p) |
| audio-only M4A over **https**, mp4a | 139 (49k), 140 (130k) |
| progressive (video+audio in one file) | **none** |
| HLS (`m3u8`) variants | present, video-only and audio-only |

Forcing a single player client (`web`, `tv`, `ios`, `android`, `web_safari`) yielded **no** https
formats at all from this IP — only m3u8. The default multi-client set is what surfaces the https
DASH streams, so the extractor's client selection is left alone.

## Approach

Select a **video-only + audio-only pair over plain HTTPS**, download each through the existing
guarded transport, and mux with the ffmpeg step already built for Reddit. No new protocol, no
new process, no postprocessor: HLS stays unsupported and still degrades to "no video copy".

This reuses machinery that already exists and is tested:
`video.mp4` + `audio.m4a` → `prlimit … ffmpeg -f mov -i … -c copy … muxed.mp4` → ftyp + ffprobe
validation, with `--fsize = maxBytes + 16 MiB` and a fall back to the silent `video.mp4` when the
muxed result exceeds `maxBytes`.

## Changes

**`scripts/customer-remote-media.py`**

1. `select_progressive_format` keeps first claim on a true progressive MP4. When none qualifies,
   a new `select_split_formats(context, maximum)` picks:
   * **video:** `ext == 'mp4'`, `protocol in ('http','https')`, `vcodec` avc1/avc3/h264,
     `acodec == 'none'`, largest resolution with a short edge ≤ 720, size (or
     `filesize_approx`) ≤ `maximum`; ties broken by `tbr` then `fps`.
   * **audio:** `ext in ('m4a','mp4')`, `protocol in ('http','https')`, `acodec` mp4a/aac,
     `vcodec == 'none'`, highest `abr` with size ≤ `MAX_AUDIO_BYTES` (16 MiB).
   * Both must be present, else no split selection (the save degrades as today).
   yt-dlp's format-selector callback returns the pair as a single entry with
   `requested_formats`, which is how yt-dlp expresses "download these two".
2. `extract()` accepts `info['requested_formats']` of exactly two entries (one video-only, one
   audio-only). Each is fetched with the same `downloader.urlopen(Request(url, headers))` +
   bounded `write_response` used today — video into `video.mp4`, audio into `audio.m4a` — and
   the result reports `"audio": True`. A single progressive format keeps the current path and
   reports `"audio": False`.
3. Every existing guard is unchanged: `download=False`, no plugins, version pin, audit hook, one
   shared network budget, request cap, public-address checks, `m3u8`/other protocols rejected.

**TypeScript** — no behaviour change needed. `downloadCustomerRemoteMedia` already muxes when the
helper reports `audio: true`, validates the muxed file exactly like a plain download, and falls
back to the silent video when it overshoots. Only the comment describing when `audio` appears is
updated.

**`customer-youtube.ts`** — unchanged. The resolver already emits the watch URL as a video item;
the video path does the rest.

## Byte budget

Video is capped at `maximum` (50 MiB default), audio at 16 MiB, so the muxed file can exceed
`maximum` by up to the audio size. The mux already runs with `--fsize = maxBytes + 16 MiB`, and a
muxed file larger than `maxBytes` is discarded in favour of the silent video, so the stored asset
never exceeds the plan budget. At 720p this is not reached in practice (a 720p+audio copy of the
measured test video is ~28 MiB).

## Testing

* Python, offline, using yt-dlp's own selector contract with synthetic format lists:
  * progressive present → split selection never runs;
  * no progressive, avc1 video-only + mp4a audio-only → both chosen, 720p preferred over 1080p;
  * video-only present but no compatible audio → no selection (degrades);
  * m3u8-only formats → no selection;
  * oversized video formats → `TooLarge` rather than a silent wrong pick.
* Python, transport: a fake opener returning two bodies writes `video.mp4` and `audio.m4a` and
  reports `audio: True`; a failing audio fetch leaves the video and reports `audio: False`.
* TypeScript: existing mux tests already cover `audio: true` → muxed + probed, and the oversize
  fallback; extend the fake helper to exercise the extractor (non-`.mp4` URL) path, not only the
  direct-URL path.
* Live check from omni after deploy: save a YouTube link and confirm a playable video asset with
  an audio track (`ffprobe` shows `h264` + `aac`).

## Out of scope

HLS/m3u8 assembly (would mean writing a fragment client inside the sandbox), VP9/AV1 (the mux is
a stream copy into MP4 and the validator requires h264), and YouTube's bot wall (unchanged: a
`youtube.txt` cookie file is still used when present).

## Recovery verification refinement

The first live whole-track request selected the expected 26.5 MB video but took 107 seconds before audio began, exceeding the 120-second combined deadline. The pinned YouTube extractor supplies `downloader_options.http_chunk_size`; the helper now honors that hint through the same guarded opener, with strict HTTP Content-Range and body-length checks, at most 10 MiB per request, one shared request/byte budget, and cleanup on inconsistency. Offline cases cover ignored ranges, shifted offsets, changing totals, truncation and oversize. This remains ordinary HTTP transfer, without enabling fragment manifests or an external downloader.

# Social resolvers with operator sessions — design

Date: 2026-09-18. Status: approved in chat, implementation follows.
Background research: `2026-09-18-social-media-resolvers.md` (same folder).

## Goal

When a user saves a link to a public social post on any major platform, FoundKeep preserves the
full post — text, author, date, images, video, linked article — the way X posts are preserved
today. Where a platform refuses anonymous server-side access, an **operator-supplied logged-in
session** (cookies) is used, with guard rails that protect the account.

Platforms in scope now: X (existing), Reddit, Instagram, LinkedIn, Bluesky, YouTube, and a
generic path for everything else (TikTok, Threads, Facebook, Pinterest, Tumblr, Vimeo, …).

Out of scope for this pass: extension / share-sheet hints for Instagram and LinkedIn (phase 2),
an admin UI for session health, per-user sessions.

## Architecture

```
capture (extension / mobile / MCP)
   │  sourceUrl (+ SocialContext hints for X)
   ▼
enqueuePreservation ──▶ customer_preservation_jobs        (any recognised social post)
   │
   ▼  tick()
resolveSocialPost(url, hints, signal)  ──▶ SocialManifest  (text, author, publishedAt, media[], links[], flags)
   │        registry: x | reddit | instagram | linkedin | bluesky | youtube | generic
   │        each resolver: anonymous chain first → session chain if a healthy session exists
   ▼
existing asset pipeline: post text → images via PublicReader → video via yt-dlp sandbox (+ mux) → linked articles
```

### Components

**1. `customer-social-sessions.ts` — session store**

* Directory `FOUNDKEEP_SOCIAL_SESSIONS_DIR` (default `~/.config/foundkeep/social-sessions`).
* Per platform, either `<platform>.txt` (Netscape cookies.txt) or `<platform>.cookie` (one line,
  raw `Cookie` header value, e.g. `sessionid=…; csrftoken=…; ds_user_id=…`). `.txt` wins when
  both exist. Files must be regular, mode `0600` or stricter, ≤ 256 KiB; otherwise ignored with
  one startup warning naming the file, never its contents.
* Reloaded when mtime changes (checked at most every 30 s).
* API: `session(platform) → { cookieHeader(host): string | null; cookieFile: string | null;
  headers: Record<string,string>; report(outcome) }`.
  * `cookieHeader(host)` returns only cookies whose domain matches `host` (browser rules:
    exact or dot-suffix), so a redirect off-platform never carries the session.
  * `report('ok' | 'denied' | 'ratelimited' | 'login')` drives the breaker.
* Breaker: `denied`/`login` → unhealthy 30 min; `ratelimited` → 10 min. While unhealthy,
  `session()` returns `null`. Minimum spacing between authenticated calls per platform: 2 s.
* Never logged, never in job errors, never in exports. Admin sees only "session: healthy /
  cooling down / absent" via a startup log line and the job's error text.

**2. `customer-public-resource.ts` — reader gains headers**

`PublicReader` options gain `headers?: Record<string,string>` and
`cookies?: (host: string) => string | null`. The cookie callback is evaluated per hop, so
redirects re-scope the cookie set. `requestPinned` in `customer-preview.ts` accepts an optional
headers map merged over the defaults (`Host`, `User-Agent`, `Accept`, `Accept-Encoding` stay
authoritative unless overridden explicitly by the resolver, e.g. a browser UA for LinkedIn).
The existing anonymous callers are unchanged.

**3. `customer-social.ts` — registry**

* `socialPost(url) → { platform, id, url } | null` (canonical permalink; hosts allow-listed,
  no credentials, no lookalikes — same discipline as `twitterPost`).
* `SocialManifest` = the existing `TwitterManifest` fields + `platform`.
* `resolveSocialPost(url, hints, signal, deps)` picks the resolver; every resolver validates
  media URLs against its platform CDN allow-list before returning them (as X does).
* `platformLabel(platform)` for user-facing messages ("X did not expose…" becomes
  "Reddit did not expose…").
* `remoteVideoCandidate` (in `customer-remote-preservation.ts`) recognises reddit / redd.it /
  linkedin / bsky / tiktok / facebook / threads / pinterest / vimeo in addition to today's hosts.

**4. Platform resolvers** (one file each, fixture-tested)

| File | Anonymous chain | Session chain (when `session(platform)` is healthy) | Media |
|---|---|---|---|
| `customer-reddit.ts` | `/r/<sub>/s/<id>` share links → follow one redirect; `<permalink>.json?raw_json=1` with UA `FoundKeep/1.0`; `over18=1` cookie for NSFW-gated posts. Text = `title` + `selftext`; author `u/<name>`; `created_utc`. | Same endpoint with `reddit.txt`/`.cookie` (lifts "IP unable to access the Reddit API"). | Images: `url_overridden_by_dest` (i.redd.it), `preview.images[].source`, galleries via `gallery_data.items` × `media_metadata` (`s.u`, unescaped). Video: `secure_media.reddit_video` → handled by the video path (below). Crossposts: `crosspost_parent_list[0]`. |
| `customer-instagram.ts` | `https://www.instagram.com/p/<code>/embed/captioned/` → `contextJSON`/`og:*` → caption, author, first image. | Media id from shortcode (offline base-64 with IG alphabet). `GET https://www.instagram.com/api/v1/media/<id>/info/` with `x-ig-app-id: 936619743392459`, `x-csrftoken` from the `csrftoken` cookie, `x-requested-with: XMLHttpRequest`, browser UA → `items[0]`: `caption.text`, `user.username`/`full_name`, `taken_at`, `carousel_media[]`/`image_versions2.candidates[0].url`, `video_versions[0].url`. | Images: `*.cdninstagram.com`, `*.fbcdn.net` (allow-list). Video: direct mp4 via the video path with the session cookie file when present. |
| `customer-linkedin.ts` | Guest page `https://www.linkedin.com/posts/<slug>` or `/feed/update/urn:li:activity:<id>` with a desktop browser UA. Text from `<p class="attributed-text-segment-list__content">` (fallback `og:description`), author from `og:title` prefix / `data-tracking-control-name="public_post_feed-actor-name"`, date from `<time>`, images from `data-delayed-url` / `og:image`, video from `<video data-sources>`. `/authwall` or `/login` redirect → `denied`. | Voyager: `GET https://www.linkedin.com/voyager/api/feed/updates/urn:li:activity:<id>` with cookies `li_at` + `JSESSIONID`, headers `csrf-token: <JSESSIONID value without quotes>`, `x-restli-protocol-version: 2.0.0`, `accept: application/vnd.linkedin.normalized+json+2.1`. | Images `media.licdn.com`, `dms.licdn.com`; video `dms.licdn.com` mp4 via the video path. |
| `customer-bluesky.ts` | `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=` then `app.bsky.feed.getPostThread?uri=at://<did>/app.bsky.feed.post/<rkey>&depth=0&parentHeight=0`. Text `record.text`, author `author.displayName (@handle)`, `record.createdAt`. | none needed | Images `embed.images[].fullsize` (`cdn.bsky.app`); video is thumbnail-only in this pass — `embed.thumbnail` is stored as an image and the manifest is marked `incomplete`; the HLS `embed.playlist` download is deferred. |
| `customer-youtube.ts` | `https://www.youtube.com/oembed?url=<watch>&format=json` → title, author. Description/subtitles come back from the video path. | yt-dlp receives `youtube.txt` as cookie file. | Video via the video path. |
| `customer-generic-social.ts` | Existing `fetchCustomerSource` (og/JSON-LD) → title, description as text, `og:image`, author. | If a `<platform>.txt` exists for the host's platform, pass it to yt-dlp. | Video via the video path when `remoteVideoCandidate`. |

Every resolver returns `metadataAvailable:false` rather than throwing when the anonymous and
session chains both fail; the pipeline still stores the captured text and notes the gap.

**5. Video path with sessions and muxing**

* `downloadCustomerRemoteMedia(url, { cookieFile, audioUrls })`: TS validates the path is a
  regular file inside the sessions dir, then copies the operator jar into the per-download temp
  directory as `cookies.txt` (mode `0600`) before yt-dlp ever sees it — yt-dlp rewrites whatever
  jar it is given when it closes, so the helper must hand it a private copy, never the operator's
  original file. The helper keeps `cookiesfrombrowser: None`, no proxy, no plugins, pinned
  version; it only sets `cookiefile` when given. yt-dlp's jar is domain-scoped, so the file is
  never sent off-platform.
* Reddit (and any other source whose manifest carries sibling audio): the resolver emits
  `audioUrls` on the video item instead of a merge mode inside yt-dlp. The Python helper's
  direct-`.mp4` branch downloads the video into `video.mp4`, then tries the caller's `audioUrls`
  in order — same host as the video only, `.mp4`/`.m4a` path only — through the same bounded
  transport, into `audio.m4a` capped at 16 MiB; a missing or broken candidate costs only the
  sound; the picture is still kept. When an `audio.m4a` came back, TS runs
  `prlimit --fsize=<maxBytes> --as=536870912 --cpu=30 --nofile=32 -- /usr/bin/ffmpeg -v error
  -nostdin -threads 1 -protocol_whitelist file -f mov -i video.mp4 -f mov -i audio.m4a -map 0:v:0
  -map 1:a:0 -c copy -movflags +faststart -f mp4 muxed.mp4` and treats `muxed.mp4` as the
  result. The same size/ftyp checks and the same `prlimit … ffprobe` validation that runs
  against `video.mp4` in the no-audio case run against `muxed.mp4` here — there is no separate
  validation path for the muxed file.

**6. Pipeline changes** (`customer-preservation.ts`, `customer-preservation-routes.ts`,
`customer.ts`)

* `twitterPost` gating → `socialPost`. `context_json` hints are stored for every social post
  (currently only for X).
* `current(job)` compares canonical URLs via `socialPost`.
* Messages: "Article captured from X" → "Article captured from <Platform>";
  "X did not expose…" → "<Platform> did not expose…".
* Image download allow-list per platform replaces the implicit twimg-only assumption (the
  resolver already filtered; the pipeline keeps the `image/jpeg|png|webp` check).

## Error handling

* Resolver failures never fail the job; they degrade to `metadataAvailable:false` + captured
  text. Only "source changed/removed" and storage limits fail a job, as today.
* Session problems are reported to the breaker and surface as a neutral job note:
  "<Platform> restricted server access; the captured text and available files are kept."
* Nothing from a cookie file or an authenticated response body is ever written to logs.

## Security

* Public reader rules unchanged: pinned DNS, public addresses only, bounded bytes/time.
* Cookies scoped by domain per hop; sessions dir enforced `0600`; helper cookie path validated.
* Authenticated calls rate-limited per platform; breaker on any denial.
* Media URLs allow-listed per platform CDN before download.
* ToS: public posts only, per-user saves, no crawling. Operator accepts the account risk;
  a secondary account is recommended.

## Testing

* Unit: `socialPost` canonicalisation and lookalike rejection per platform; each parser
  against JSON/HTML fixtures under `test/fixtures/social/`; session store (parsing both
  formats, mode check, domain scoping incl. redirect hop, breaker timings, min spacing);
  reader header/cookie injection; `remoteVideoCandidate`.
* Integration (existing style, fake reader/remote): preservation job for a Reddit gallery,
  an Instagram carousel with session, a LinkedIn guest post with video, a Bluesky post, and
  a generic TikTok link; platform-aware messages.
* Python: helper test for `cookiefile` passthrough and for `merge` mode producing two files;
  TS test for the ffmpeg mux invocation and post-mux ffprobe validation.
* Manual on omni after deploy: one real link per platform, with and without sessions, checked
  through `preservationDetails`.

## Operator setup (after deploy)

```
mkdir -p ~/.config/foundkeep/social-sessions && chmod 700 ~/.config/foundkeep/social-sessions
# either: export cookies.txt from a signed-in browser and
scp instagram.txt linkedin.txt youtube.txt reddit.txt pritam@157.180.102.248:~/.config/foundkeep/social-sessions/
# or: write the named values as one line per platform
#   instagram.cookie : sessionid=…; csrftoken=…; ds_user_id=…
#   linkedin.cookie  : li_at=…; JSESSIONID="ajax:…"
#   reddit.cookie    : reddit_session=…
chmod 600 ~/.config/foundkeep/social-sessions/*
sudo systemctl restart atlas-backend   # picks up the dir; later changes hot-reload
```

Values never pass through an agent transcript.

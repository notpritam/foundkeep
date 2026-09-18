# Social media resolvers: how the "online downloader" tools work, and what FoundKeep should do

Research date: 2026-09-18. Question: how do sites like ssstwitter / twdown / cobalt "see" a
tweet and pull its video, and what is the equivalent for YouTube, Reddit, Instagram, LinkedIn
and the rest — so FoundKeep can save a full post (text + media) from any social link.

## TL;DR

* Every online downloader does the same thing: it impersonates a **logged-out web/mobile
  client** and calls the platform's **own internal JSON endpoints** (guest-token GraphQL,
  syndication/embed endpoints, `.json` suffixes, embed pages), then picks the best media
  variant from the response. None of them use official developer APIs.
* FoundKeep already does this for X/Twitter (`apps/backend/src/customer-twitter.ts`):
  FxTwitter API + X syndication endpoint queried in parallel and merged. It also already has
  a sandboxed, pinned **yt-dlp** runtime (`apps/backend/scripts/customer-remote-media.py`,
  yt-dlp 2026.8.19 in `~/.local/share/foundkeep-media-runtime`) used for video preservation.
* The gap is not tooling, it is **coverage and gating**: only YouTube, Instagram and X are
  recognised as platforms (`customer-source.ts` `sourcePlatform`) and as video candidates
  (`customer-remote-preservation.ts` `remoteVideoCandidate`). Reddit, LinkedIn, TikTok,
  Threads, Bluesky, Facebook, Pinterest fall through to the generic HTML scraper, which hits
  login shells and returns metadata only.
* Recommended: one **resolver-chain per platform** built from (a) a cheap platform JSON
  endpoint via the existing hardened `PublicReader`, (b) yt-dlp in the existing sandbox for
  video, (c) the browser extension / share sheet as the only reliable path for login-walled
  platforms (Instagram, LinkedIn). Optionally a **self-hosted cobalt** instance as a single
  "give me the media URL" backend for the long tail.

## How the X/Twitter tools work

Three techniques, all credential-free for public posts:

| Technique | Endpoint | Used by | Notes |
|---|---|---|---|
| Guest-token GraphQL | `POST https://api.x.com/1.1/guest/activate.json` (hard-coded public web bearer) → `GET https://api.x.com/graphql/<queryId>/TweetDetail` or `TweetResultByRestId` with `x-guest-token` | cobalt, FxTwitter/FxEmbed, yt-dlp `twitter`, `the-convocation/twitter-scraper`, most downloader sites | Query IDs rotate every few weeks; NSFW posts return `NsfwLoggedOut` and need a real account cookie (FxTwitter's "elongator"). |
| Syndication / embed endpoint | `GET https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=<t>` where `t = ((id/1e15)*π).toString(36)` with `0` and `.` stripped | Vercel `react-tweet`, yt-dlp fallback, cobalt fallback, **FoundKeep today** | Stable for years, no token rotation. Returns `mediaDetails[].video_info.variants` (bitrate + mp4 URL) and photos. Truncates long "note tweets" to ~278 chars. |
| Third-party embed fixer API | `GET https://api.fxtwitter.com/status/<id>` (also vxtwitter / `api.vxtwitter.com`) | Discord/Telegram bots, **FoundKeep today** | MIT, self-hostable on Cloudflare Workers. Full note-tweet text, all media, polls, translations. |

FoundKeep's `resolveTwitterPost` = FxTwitter ∥ syndication → `mergeManifests` → every media URL
re-validated against `pbs.twimg.com` / `video.twimg.com`. This is the right shape; nothing to
change except optionally pointing `FOUNDKEEP_TWITTER_API_BASE` at a self-hosted FxEmbed so the
product does not depend on the public instance.

## Per-platform approaches

| Platform | Cheapest public JSON | Open-source reference | Auth reality (Sept 2026) | FoundKeep status |
|---|---|---|---|---|
| **X / Twitter** | syndication `tweet-result` + FxTwitter | cobalt `services/twitter.js`, FxEmbed, yt-dlp `twitter` | Public posts: none. NSFW: account cookie. | Done. |
| **YouTube** | none usable; player API needs InnerTube client + PO token | yt-dlp `youtube` (+ `bgutil-ytdlp-pot-provider` plugin), cobalt (self-host only; public instance blocked) | Datacenter IPs (omni is Hetzner) get "Sign in to confirm you're not a bot"; ~1 in 4 fresh cloud IPs are challenged. Fixes: PO-token provider, cookies from a real account, or residential proxy. This is an arms race. | yt-dlp path exists. Needs a PO-token provider or cookie strategy before it is reliable from omni; measure failure rate in `customer_preservation_jobs.error`. |
| **Reddit** | `https://www.reddit.com/<post-path>/.json` (any post URL + `.json`), needs a real `User-Agent`; `r/<sub>/s/<id>` share links 302 to the canonical post | yt-dlp `reddit` (gets a `loid` cookie from `old.reddit.com`, sets `over18=1`, falls back to `/svc/shreddit/<slug>` with browser impersonation), cobalt `services/reddit.js` | Public: none. Reddit blocks some datacenter IPs on the API ("Your IP address is unable to access the Reddit API") — cobalt optionally uses a free script-type OAuth app to get a bearer, which lifts that. | **Missing.** Not a platform, not a video candidate. |
| Reddit video specifics | `secure_media.reddit_video.fallback_url` is video-only; audio is a separate track: `DASH_AUDIO_128.mp4` / `DASH_audio.mp4` / `<base>/DASHPlaylist.mpd` (yt-dlp) or HLS `HLSPlaylist.m3u8`. Must mux with ffmpeg (already on omni at `/usr/bin/ffmpeg`). Galleries live in `media_metadata` + `gallery_data.items`. | | | |
| **Instagram** | Chain: `i.instagram.com/api/v1/oembed/?url=` → `/api/v1/media/<id>/info/` with `x-ig-app-id: 936619743392459`; else `www.instagram.com/p/<code>/embed/captioned/` (HTML with embedded JSON); else `POST /graphql/query` with `doc_id` + `X-FB-LSD` | cobalt `services/instagram.js`, yt-dlp `instagram`, instaloader | Effectively **login-walled from datacenter IPs** in 2026: yt-dlp reports "empty media response" / "exceeded the rate-limit for accessing posts anonymously"; instaloader 401s without a session. Stories always need cookies. Account cookies risk bans. | Recognised as platform + video candidate but anonymous fetches mostly fail. Treat the **user's own browser (extension) and phone (share sheet)** as the source of truth; server side only enriches from the embed page. |
| **LinkedIn** | Public "guest" post page `linkedin.com/posts/<slug>-<activityId>-xxxx` or `/feed/update/urn:li:activity:<id>`; video sources are in the `<video data-sources="[...]">` attribute, images in `og:image` / `data-delayed-url` | yt-dlp `LinkedIn` extractor (no login, parses `data-sources`), scrapfly `linkedin-scraper` | No public API. Guest page works from residential IPs with a browser UA; datacenter IPs frequently get the `/authwall` redirect (already detected by `blockedRoute`). LinkedIn's terms prohibit automated access. | **Missing** as a platform; generic scraper gets og-tags at best. |
| **TikTok / Threads / Bluesky / Facebook / Pinterest / Tumblr / Vimeo / SoundCloud** | Bluesky and Tumblr have real public APIs; the rest are web-API impersonation | cobalt covers all of these (see `api/src/processing/service-config.js`), yt-dlp covers TikTok, Bluesky, Facebook, Pinterest, Tumblr | TikTok/Facebook: datacenter-hostile. Bluesky: fully open (`public.api.bsky.app`). | Not recognised. Long tail is where a self-hosted cobalt pays off. |

Image-only fetching across Reddit/X/Instagram: **gallery-dl** (150+ sites, needs cookies for Instagram).

## cobalt as a single backend (optional)

[imputnet/cobalt](https://github.com/imputnet/cobalt) (AGPL-3.0) is the open-source engine
behind cobalt.tools. `POST /` with `{ "url": ... }` returns `tunnel` (cobalt proxies/remuxes),
`redirect` (direct CDN URL), `picker` (multi-media post), or `error`. Supports X, YouTube,
Reddit, Instagram, TikTok, Facebook, Pinterest, Tumblr, Bluesky, Twitch clips, Vimeo,
SoundCloud, Snapchat, Threads-adjacent, and more.

* The public `api.cobalt.tools` is bot-protected and **explicitly not for third-party use**;
  self-host (Docker image `ghcr.io/imputnet/cobalt`, one container + optional cookies file).
* YouTube through cobalt has the same PO-token / datacenter problem as bare yt-dlp.
* Nothing is stored; it streams. Fits FoundKeep's "download → validate → owner-scoped storage"
  pattern if the tunnel URL is consumed through the existing bounded downloader.

Trade-off: one more service to run, but it replaces per-platform code for the long tail and is
maintained by people who track endpoint churn full-time.

## Recommended design for FoundKeep

1. **Resolver registry** keyed by host (extend `sourcePlatform` in `customer-source.ts`):
   `x`, `youtube`, `reddit`, `instagram`, `linkedin`, `bluesky`, `tiktok`, `threads`,
   `facebook`, `pinterest`, `tumblr`. Each resolver returns the same manifest shape
   `TwitterManifest` already uses (text, author, publishedAt, media[], links[], incomplete).
2. **Per-platform chain**, cheapest first, all through `readPublicResource` (pinned DNS,
   bounded bytes, no cookies):
   * Reddit: `<post>/.json` with `User-Agent: FoundKeep/1.0` → parse `selftext`, `title`,
     `author`, `media_metadata`, `secure_media.reddit_video`; video via the yt-dlp sandbox
     (it already muxes DASH audio). Add `reddit.com` / `redd.it` / `v.redd.it` to
     `remoteVideoCandidate`.
   * LinkedIn: guest page → `og:*`, `data-sources`, `data-delayed-url`; video via yt-dlp
     `LinkedIn` extractor. Expect authwall from omni; when hit, keep the extension capture.
   * Instagram: embed/captioned page only; do not add account cookies server-side.
   * Bluesky: `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://...`
     (resolve handle → DID via `com.atproto.identity.resolveHandle`). Fully public, no auth.
3. **Client-side capture stays primary for walled platforms.** The extension and the mobile
   share sheet run inside the user's logged-in session; they should send the same
   `SocialContext` hints (`images`, `links`, `articleText`) that X capture already sends, for
   Instagram and LinkedIn too. The server then only needs to download the hinted CDN URLs.
4. **YouTube reliability:** add `bgutil-ytdlp-pot-provider` (HTTP server mode) beside the
   pinned yt-dlp, or route only YouTube through a residential proxy. Track the failure
   reason distribution before choosing.
5. **Policy:** all of this is ToS-grey for LinkedIn/Instagram/TikTok. Keep it to public posts,
   per-user saves, no crawling, and keep the "we could not fetch this publicly, saved from
   your browser instead" notice that `customer-source.ts` already produces.

## Sources

* Apple/cobalt/yt-dlp code read directly: cobalt `api/src/processing/services/{twitter,reddit,instagram}.js`
  and `service-config.js`; yt-dlp `extractor/{reddit,instagram,linkedin}.py`; Vercel
  `react-tweet` `fetch-tweet.ts` (syndication token formula).
* FxEmbed wiki: https://github.com/FxEmbed/FxEmbed/wiki/Status-Fetch-API
* cobalt API doc: https://github.com/imputnet/cobalt/blob/main/docs/api.md
* yt-dlp bot-wall context: https://github.com/yt-dlp/yt-dlp/issues/12264
* yt-dlp Instagram anonymous failures: https://github.com/yt-dlp/yt-dlp/issues/17074
* instaloader anonymous 401s (2026-09-07): https://github.com/instaloader/instaloader/issues/2739

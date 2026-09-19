# Social sessions (operator cookies) — setup on omni

FoundKeep's backend resolves social posts anonymously first. When a platform blocks server access
(Instagram, LinkedIn, sometimes Reddit and YouTube), it retries with an operator-supplied browser session.

## Where files live
`~/.config/foundkeep/social-sessions/` (override with `FOUNDKEEP_SOCIAL_SESSIONS_DIR` in a systemd drop-in). Directory `0700`, files `0600`, owner = the service user (`pritam`). The backend hot-reloads changes within 30 s; the startup log line `social sessions: …` lists which sites loaded (names only).

## Two file formats per site
* `<site>.txt` — Netscape cookies.txt exported from a signed-in browser (extension "Get cookies.txt LOCALLY", export for the site only). Best for YouTube (yt-dlp needs the full jar).
* `<site>.cookie` — one line of `name=value; name2=value2` for the few cookies that matter:
  * `instagram.cookie`: `sessionid`, `csrftoken`, `ds_user_id`
  * `linkedin.cookie`: `li_at`, `JSESSIONID` (keep the quotes: `JSESSIONID="ajax:…"`)
  * `reddit.cookie`: `reddit_session`
  * `x.cookie`: `auth_token`, `ct0` — only used by the video download path (for age-restricted posts); public X posts need no session
Sites: x, reddit, instagram, linkedin, bluesky, youtube, tiktok, threads, facebook, pinterest, tumblr, vimeo, twitch, dailymotion.

## Moving the values safely
Never paste cookie values into a chat or a ticket. From the Mac:
```
scp instagram.cookie linkedin.cookie youtube.txt pritam@157.180.102.248:~/.config/foundkeep/social-sessions/
ssh pritam@157.180.102.248 'chmod 700 ~/.config/foundkeep/social-sessions && chmod 600 ~/.config/foundkeep/social-sessions/*'
```
Or use the bb `secrets` skill to write a `.cookie` file without the value passing through an agent.

## Guard rails
Cookies for other domains in a file are ignored: only the site's own domains are loaded (plus `google.com` for YouTube and `twitter.com` for X), so exporting a whole browser jar by mistake leaks nothing to another platform. Cookies are only sent to hosts matching their domain (re-checked on every redirect). On 401/403/429 or a login redirect the site's session cools down for 30 minutes (10 for rate limits) and anonymous access is used meanwhile. Authenticated calls are spaced at least 2 s apart per site. Nothing from a session is ever logged.

The backend prints `social sessions: …` once at startup (see "Where files live" above); if a site you just dropped a file for is missing from that line, check permissions and filename before assuming the fetch itself failed. `FOUNDKEEP_SOCIAL_SESSIONS_DIR` can point the whole lookup at a different directory — set it in a systemd drop-in (`systemctl edit <service>`) rather than the shared `.env` if only one deployment should use the override.

## Risk
Platforms may flag an account whose session appears from a datacenter IP. Prefer a secondary account. Refresh the file when the platform signs you out (the job notes will say "<Platform> restricted server access").

# Session health and YouTube completion — 2026-09-20

Completed the unfinished scope from the FoundKeep User Experience thread. Library archive/merge/daily upkeep remains deferred as explicitly scoped there.

## Shipped behavior

- Session checks after two minutes and every six hours, persisted across restarts, with cooldown and transient-failure handling.
- Admin-only session status at `/console/sessions` and `/api/admin/social-sessions`.
- Expiry alerts through the existing opt-in Expo device registration, restricted to the shared admin allowlist. Failed delivery retries; invalid tokens are removed. No cookie values or authenticated response bodies enter status rows or alerts.
- YouTube H.264/AAC split streams downloaded through the existing sandbox and combined locally. Bounded HTTP ranges honor the pinned extractor's chunk hint; whole-track throttling previously caused the timeout.

## Evidence

- 438 backend tests passed; 22 Python network/format/transfer boundary tests passed.
- Backend and site typechecks passed. Dev and production Next builds passed.
- Packaged console checked in Chromium at desktop and mobile widths: status rows, navigation, no page-wide overflow or browser errors.
- Public save flow on both `https://dev.foundkeep.app` and `https://foundkeep.app` produced `ready` with post, video, image and transcript. The 29,969,206-byte sample contains H.264 video and AAC audio, verified with ffprobe. Direct helper download completed in 1.698 seconds after the range fix.
- Unauthenticated access to the private media returned 401. Disposable verification accounts and saves were removed through the account API.
- Database migration copies preserved existing account, capture, session and connection counts. Both environments now run schema 32.

## Release and rollback

- Application revision: `ec16070d08c6cca54db2e4bec6f37aabe8b2406b`.
- Backend: `/home/pritam/.local/share/foundkeep-backend/releases/20260920-055210-session-health-ec16070`.
- Dev site: `/home/pritam/.local/share/foundkeep-site-dev/releases/20260920-055210-session-health-ec16070`.
- Production site: `/home/pritam/.local/share/foundkeep-site/releases/20260920-055210-session-health-ec16070`.
- Database backups: `/home/pritam/.local/share/foundkeep-backend/backups/20260920-055210-session-health-ec16070` (private, outside the checkout).
- Previous production site: `/home/pritam/.local/share/foundkeep-site/releases/20260919-225046-social-dfe828b`.
- Previous dev site: `/home/pritam/.local/share/foundkeep-site-dev/releases/20260916-144928-mind-map-graph-74a28fa`.

The old backend cannot open schema 32 directly. A verified fallback preserving the previous production behavior plus the additive migration is at `/home/pritam/.local/share/foundkeep-backend/releases/20260920-055210-session-health-ec16070-fallback`. To roll back backend behavior, update only the corresponding service's release WorkingDirectory to that fallback's `apps/backend`, reload systemd and restart the affected backend. Do not restore a database backup over newer saves. Website rollback uses the previous immutable release and an atomic `current` symlink switch. Existing environment, auth, billing and static-download configuration is preserved.

## Operator action and platform limits

At verification time there were zero opted-in, unexpired operator devices in production. Enable **FoundKeep → Settings → Capture-ready alerts** and grant the OS notification permission to receive session alerts. Console monitoring works independently.

Some YouTube videos still receive YouTube's sign-in/bot check (observed for `jNQXAC9IVRw`); there is no `youtube.txt` operator session installed. Split-stream support fixes the format/transfer limitation, not platform access restrictions. HLS/fragment manifests and DRM remain unsupported. A successful anonymous probe shows public availability and does not establish that a cookie is valid; the console states this distinction.

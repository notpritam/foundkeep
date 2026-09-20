# Instagram cover failure status — 2026-09-20

The reported Instagram reel about LinkedIn SEO had a complete 7,443,107-byte MP4 with H.264 video and AAC audio. Its cover image had failed, causing the whole preservation job to show the generic “A media file could not be downloaded” warning. The cover was accessible during investigation; the original transport error was not retained, so its precise cause is unknown.

Instagram resolvers now associate a video's cover with that video. A missing cover does not make a successfully preserved video incomplete. Missing independent photos, missing videos, and storage limits still report failures. Remaining media errors identify images or videos. Retries compare file digests within the same save so refreshed CDN signatures cannot store identical bytes twice.

## Verification

- 442 backend tests pass, including regressions for unavailable covers, independent carousel photos, missing videos, repeat retries, and rotated CDN URLs.
- Backend TypeScript check passes; packaged release passes the focused regression tests.
- Public API saves of the reported reel passed in dev and production: `ready`, post/video/image, 7,443,107-byte video, H.264/AAC, anonymous media access rejected with 401.
- Disposable verification accounts and their saves were deleted.
- The reported production save was retried through the normal preservation queue. It is now `ready`, with no error, plus a 145,794-byte JPEG cover. Original asset IDs, paths, sizes, and digests are unchanged; file bytes were verified against the stored digests.

## Deployment and rollback

Application revision: `8d02824215ff553136cc4211f189124584574f87`.

Both backend services use:

`/home/pritam/.local/share/foundkeep-backend/releases/20260920-063314-instagram-cover-8d02824/apps/backend`

The prior release remains available:

`/home/pritam/.local/share/foundkeep-backend/releases/20260920-055210-session-health-ec16070/apps/backend`

For rollback, restore that WorkingDirectory in the service's existing release drop-in, reload systemd and restart only the affected backend. No schema changes were introduced. Production's pre-deployment database snapshot and original affected asset metadata are private under `~/.local/share/foundkeep-backend/backups/20260920-063314-instagram-cover-8d02824`; never overwrite newer customer data with that snapshot.

Website releases, mobile binaries, static downloads, authentication, billing and other service settings were unchanged. No mobile update is needed; reopening the saved item fetches the corrected status.

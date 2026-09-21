# Save archive — 2026-09-21

Manual archive/restore is implemented for the web and mobile libraries. Archived saves are hidden from ordinary library lists, search, suggested related saves and the mind map; the Archive view supports search and type filters. Direct readers, files, notes, exports, existing relationships and shared collection entries remain available. Archived saves continue counting toward both storage and save limits.

The API adds a nullable `archived_at` timestamp in migration 33. `PUT /api/captures/:id/archive` and its `/api/mobile` equivalent accept `{ archived: boolean, expectedUpdatedAt: number }`, enforce ownership and revision checks, and update the change feed. Repeating the current state preserves the revision. List routes accept `archived=true`; omitted/false lists active saves. MCP adds `set_save_archived`, and `list_saves` supports the same explicit archived filter. Exports include both states.

## User controls

- Web: open a save and choose **Archive save**. **Archive** in the sidebar lists archived items; open one and choose **Restore save**.
- Mobile: the archive icon in the saved-item toolbar archives it; the restore icon brings it back. The archive icon at the top of the collection switches to Archive, with its own search and empty state.
- Both views refresh after mutations. Errors keep the item intact and visible for retry.

## Verification

- 446 backend tests pass, including authorization, invalid input, revision conflicts, list pagination, storage preservation, export, graph/related visibility, and MCP archive/restore.
- 105 mobile tests pass, including cache separation and invalidation for active/archived lists.
- Backend, mobile and web TypeScript checks pass. Next production-mode dev build and Expo dev web export pass.
- Compiled mobile browser journey passes archive, archive view, restore, retained notes and 390/320px layouts.
- Web browser journey passes on an isolated API and on the public permanent dev site, including failed-write recovery, search, full-reader navigation, restore and 1280/390/320px layouts. Disposable live test account and saves were deleted.
- Dev database migration was checked on a private snapshot: integrity passes, account/capture/media/session/connection counts are unchanged, and existing saves default to active.

## Deployment

Application revision: `cf24ebda1e6b412363f0fcfbdb346597d1f61b0d`.

- Dev backend: `~/.local/share/foundkeep-backend/releases/20260921-115951-archive-cf24ebd/apps/backend`.
- Dev website: `~/.local/share/foundkeep-site-dev/releases/20260921-115951-archive-cf24ebd`.
- Public testing: https://dev.foundkeep.app.
- Private pre-migration snapshot: `~/.local/share/foundkeep-backend/backups/20260921-115951-archive-cf24ebd`.
- Verified schema-33-compatible fallback backend: `~/.local/share/foundkeep-backend/releases/20260921-115951-archive-cf24ebd-fallback/apps/backend`. This is the previous backend with the additive migration applied.
- Previous dev website: `~/.local/share/foundkeep-site-dev/releases/20260920-055210-session-health-ec16070`.

Rollback uses the fallback backend WorkingDirectory and previous website symlink, then restarts only the dev services. Never restore the old database over newer saves. Production remains on schema 32 and its existing Instagram-cover release; this feature has not been promoted there.

## Mobile delivery

The mobile source and compiled browser UI are verified. The phone update is not published: this host is not authenticated to Expo, and opening a terminal on the enrolled release Mac returned HTTP 504. Resume mobile delivery from a responsive authenticated release machine, verify its dev runtime against the installed dev binary, then publish only to the dev channel. Do not force a runtime fingerprint or publish to production-beta as part of this dev rollout.

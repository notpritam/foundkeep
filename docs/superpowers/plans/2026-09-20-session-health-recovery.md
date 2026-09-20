# Session health and YouTube recovery implementation plan

**Goal:** Complete the approved session monitoring and split-stream YouTube designs in this thread.

**Architecture:** Reuse the existing guarded social resolvers, operator cookie store, Expo delivery and admin console. Preserve the existing partial YouTube implementation and validate it against the pinned media runtime.

**Specs:** `../specs/2026-09-19-session-health-design.md` and `../specs/2026-09-20-youtube-split-streams-design.md`.

**Constraints:** User selected inline execution. Preserve all existing data and partial changes. Probe after two minutes, then every six hours. Only fixed safe reasons reach the database, console or push. Test in dev before the previously authorized production rollout. Library upkeep remains deferred as explicitly scoped in the source thread.

- [x] Recover source requirements, approvals, stopped workers and uncommitted changes.
- [x] Reproduce missing session-health module and session-store methods with the existing failing tests.
- [x] Implement `customer-session-health.ts`, append the probe migration in `db.ts`, add observable outcomes and site names to `customer-social-sessions.ts`. Reserve one session per probe and reuse it so the spacing guard cannot swallow the authenticated request. Persist only safe status/reason/timestamps.
- [x] Add operator-only push delivery using the same admin allowlist as console access. Test recipient isolation, disabled devices, receipt errors and token pruning. Retry failed delivery without claiming an alert was sent.
- [x] Add the admin-gated `/admin/social-sessions` endpoint, startup/interval/shutdown wiring and `/console/sessions` using the existing console components. Verify authorization and rendering with fresh data.
- [x] Review and run Python/Bun media tests, correct split-stream format/transport issues, and run a real YouTube download with ffprobe evidence.
- [x] Run backend suite/typechecks and production site build. Package immutable dev backend/site releases, verify locally, switch atomically and verify the public dev origin.
- [x] Promote the verified changes under the existing production authorization, retain prior releases, verify health/admin access and actual media results, record release and rollback notes.

Verification so far: 438 backend tests pass; 22 Python boundary tests pass; backend and site TypeScript checks pass; dev Next build passes. The live YouTube sample `dQw4w9WgXcQ` downloaded 29,969,206 bytes in 1.698 seconds; ffprobe verified H.264 video and AAC audio, duration 213.09 seconds. The separate `jNQXAC9IVRw` sample still received a platform bot/sign-in wall; that external restriction is unchanged.

Dev and production API save tests both returned ready with post/video/image/transcript assets and an authenticated H.264/AAC video. Anonymous media reads returned 401. Test accounts and their saves were deleted. The dev startup probes reported Instagram, LinkedIn and Reddit healthy. Production operator push delivery has no opted-in active device yet; the owner must enable Capture-ready alerts on the phone.

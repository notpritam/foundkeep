# Atlas Studio Launch Implementation Plan

> Execute inline using the approved Studio × Operator implementation. The user explicitly authorized enhancement, completion, publication, and production deployment.

**Goal:** Launch the capture-first Atlas redesign at https://atlas.notpritam.in and publish signed extension v1.3.0.

**Architecture:** The running backend serves `apps/web` directly from the main checkout. Fast-forwarding that checkout deploys static files without touching the database. Pushing main triggers the established signing workflow and GitHub release.

**Spec:** PRODUCT.md, DESIGN.md, and the approved redesign in 039516f.

## Global constraints

- Preserve extension ID mjfcgmboaijfcaanepdipbgmipnccnpn, manifest permissions, local library schema, and existing control protocol.
- Keep agent control secondary; do not add an agent workflow.
- Preserve production services, account tokens, and stored captures.
- Use the existing signing key and version 1.3.0; verify release contents and public URLs.

## Execution

- [x] Finish canonical/social metadata, launch artwork, and current setup documentation; keep the approved layout.
- [x] Add repeatable landing browser checks and run them alongside extension and backend tests.
- [x] Make CI run checks before signing and fail if the signing secret is absent.
- [x] Independently review launch changes and confirm test evidence.
- [x] Record the previous main SHA for rollback, fast-forward production main, and push to origin.
- [x] Verify public HTTPS, page assets, privacy, downloads, API health, and the GitHub signed release.
- [x] Synchronize generated signed release artifacts to the site's existing direct download URLs and record completion.

## Preflight evidence

- Previous production/main commit: `98725dce79da7da377f1c75609fa704f3e0e340e`.
- 15 backend tests and 14 browser tests pass; browser tests also pass using CI defaults with no local executable override.
- Local v1.3.0 CRX signature verifies cryptographically against the original pinned public key. ZIP/CRX content and update manifest match the source and expected extension identity.
- Responsive hero image payload reduced from 2,696,952 bytes to 37,572 or 97,604 bytes depending on viewport density. The original artwork is retained.
- Independent review resolved the picture layout and default-headless-browser regressions. Preview entrypoint now redirects to the documented page path.

## Launch complete — 6 September 2026

- Production: https://atlas.notpritam.in/
- Extension ZIP: https://atlas.notpritam.in/atlas-extension.zip
- Signed release: https://github.com/notpritam/atlas/releases/tag/ext-v1.3.0
- Successful CI: https://github.com/notpritam/atlas/actions/runs/34026655984
- Release source commit: `01dd104e82e56327d75e142b5aa28a804b9d25ae`.
- Production main fast-forwarded from the recorded prelaunch SHA and pushed to GitHub. No database migration or service restart was required.
- Public landing browser checks pass at 320/390/768/1440px. Eleven public site/download/metadata routes returned HTTP 200 with matching release bytes, and `/healthz` remained healthy.
- Published GitHub ZIP and CRX downloaded and checked: valid archive CRC, every file matches extension source, original extension ID retained, CRX cryptographic signature valid, update manifest version 1.3.0.
- Direct site downloads synchronized to the verified GitHub artifacts.
- Remaining rollout behavior: unpacked users reload their existing folder; managed installations follow Chrome’s normal update schedule.

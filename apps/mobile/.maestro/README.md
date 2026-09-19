# FoundKeep Android — Maestro E2E

End-to-end UI flows for the FoundKeep Android app, one per screen/feature, written
in [Maestro](https://maestro.mobile.dev) (YAML, works on emulator, real device, or
cloud). Authoring is complete; **choose where to run** (see below).

## Prerequisites
- **Maestro CLI**: `curl -fsSL https://get.maestro.mobile.dev | bash`
- **The app installed** on the target: `adb install foundkeep-android-1.0.0-*.apk`
  (grab it from https://foundkeep.app/beta or `~/.local/share/foundkeep-beta-artifacts/`).
- **A test account** on the backend the build points at (the friends APK points at
  **prod**). Pass creds as env vars — never hard-code them.

## Run

```bash
# Everything (from apps/mobile/)
maestro test .maestro --env EMAIL="you@example.com" --env PASSWORD="••••"

# Just the fast smoke set
maestro test .maestro --include-tags smoke --env EMAIL=… --env PASSWORD=…

# A single flow
maestro test .maestro/02-library.yaml --env EMAIL=… --env PASSWORD=…
```

Tags: `smoke` (launch + sign-in), `auth`, `core` (library/new-note/detail/search/
settings), `billing`, `share`, `writes-data` (creates real data — dev only).

### Share-intent flow
Maestro can't open the OS share sheet, so trigger the intent first, then run the flow:
```bash
adb shell am start -a android.intent.action.SEND -t text/plain \
  --es android.intent.extra.TEXT "https://example.com/article" app.foundkeep.android
maestro test .maestro/10-share-intent-android.yaml
```
Repeat with `-t image/*` + `--eu android.intent.extra.STREAM <content-uri>` for images,
and `android.intent.action.SEND_MULTIPLE` for batches.

## Where to run it — pick one
- **Local emulator / device (Mac):** easiest interactive loop — Android Studio AVD or
  a plugged-in phone, then `maestro test`. Good for development.
- **Cloud (recommended for headless/omni & CI):** upload the APK + flows to
  **Maestro Cloud** — runs on real devices, no local emulator:
  `maestro cloud --apk foundkeep.apk .maestro --env EMAIL=… --env PASSWORD=…`.
  (EAS also has a Maestro build-time e2e integration if you'd rather run it in EAS.)
- **omni is headless** (no display/GPU), so running an emulator here is heavy; prefer
  the Mac for local runs or Maestro Cloud for automated runs.

## Which build / backend
The friends APK is `app.foundkeep.android` → **prod**. To avoid writing test data to
prod, prefer a **dev build** pointed at `dev.foundkeep.app` (override `appId` in the
flows if the dev package differs) and a disposable account, or keep runs to the
read-only flows (`smoke`, `02-library`, `04-capture-detail`, `05-search`, `06-settings`).

## Selector hardening (first-run task)
These flows were authored from `apps/mobile/src` (real testIDs + labels), but the
app is sparse on testIDs. On the first real run, confirm text selectors and, for
robustness, add these `testID`s (small app change) — then swap the `text:`/`accessibilityLabel:`
selectors for `id:`:
- `sign-in.tsx`: `email-input`, `password-input`, `sign-in-button`
- `(tabs)/_layout.tsx`: `tab-collection`, `tab-settings`
- gallery item: `gallery-item` (currently taps `gallery-list` child index 0)
- `new-note.tsx`: `note-input`, `save-note-button`
- `capture/[id].tsx`: `capture-detail`
Existing testIDs already used: `collection-header`, `collection-search`,
`collection-expanded-controls`, `floating-dock`, `dock-new-note`, `dock-material`,
`masonry-gallery`, `gallery-list`, `build-info`.

See `../docs/TEST_PLAN.md` for the full manual QA checklist (covers the paths Maestro
can't easily automate — real OS share sheet, IAP purchase, push alerts, cross-device sync).

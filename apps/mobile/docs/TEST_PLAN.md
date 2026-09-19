# FoundKeep Android — manual test plan

Every screen and feature, with the expected result. Use for release QA and to cover
what the Maestro flows (`../.maestro/`) can't easily automate (the OS share sheet,
in-app purchases, push notifications, cross-device sync). Check each on a real device.

Legend: **[A]** = also covered by an automated Maestro flow · **[M]** = manual only.

## 1. Launch & auth
- [ ] **[A]** Cold launch (signed out) → auth entry ("Continue with email" / "Your collection awaits.").
- [ ] Onboarding/welcome shows on first run and can be dismissed/continued.
- [ ] **[A]** Sign in with email + password → lands in the library.
- [ ] Wrong password → clear inline error, no crash.
- [ ] **[M]** "Continue with Google" → OAuth round-trip → signed in.
- [ ] **[M]** "Continue with Apple" → OAuth round-trip → signed in.
- [ ] **[A]** "Create an account" → register screen; register a new account (dev backend only).
- [ ] **[A]** "Use a recovery code" → recovery screen; recover with a valid code.
- [ ] Sign out (Settings) → returns to auth entry; session cleared.

## 2. Library / collection (main tab)
- [ ] **[A]** Header, search entry, floating dock, and gallery render.
- [ ] Saves display in the masonry gallery with type, title, source, tags, date.
- [ ] Empty state ("The collection.") shows for a fresh account.
- [ ] Pull-to-refresh reloads; new saves appear.
- [ ] **[A]** Search: open, type a query, results filter.
- [ ] Filters (Show search and filters): filter by type (bookmarks/images/tweets/notes…).
- [ ] Offline: "Waiting to upload" / "They'll upload when FoundKeep reconnects" shows; syncs on reconnect.
- [ ] Outdated-build banner ("Update FoundKeep in the App Store…") behaves (when applicable).

## 3. Capture detail
- [ ] **[A]** Tap a save → detail/reader view opens.
- [ ] Text/bookmark: summary + article/readable text render; "Show source details" works.
- [ ] **[M]** Tweet: preserved full text + photos + video + article all display (preserved-post view).
- [ ] Image/screenshot/document/file: media renders or downloads correctly.
- [ ] Related saves load; "Retry related saves" works when they fail.
- [ ] "Try keeping this post again" (re-preserve) works.
- [ ] Batch detail (`batch/[id]`): a multi-item share opens as a batch and lists its items.

## 4. Creating content
- [ ] **[A]** New note from the dock → editor ("Get it down before it gets away…") → save → appears in library.
- [ ] Dock "material" action (dock-material) works.
- [ ] **[M]** Share a **link** from another app (Chrome/Safari) → FoundKeep → capture created with preview.
- [ ] **[M]** Share an **image** / **file** / **selected text** → capture created.
- [ ] **[M]** Share **multiple** items (SEND_MULTIPLE) → batch created.
- [ ] Saving while offline → queued, uploads on reconnect.

## 5. Settings
- [ ] **[A]** Settings tab: "Appearance", "Save from other apps", "Capture-ready alerts", account, build info.
- [ ] Appearance: switch light ↔ dark ↔ system; UI updates.
- [ ] Capture-ready alerts: toggle on → permission prompt → alert arrives after processing (**[M]** push).
- [ ] "Save from other apps": guidance to enable the share extension.
- [ ] Account: name/email correct; manage/sign out.
- [ ] "Delete your account?" → confirmation → account deleted (dev only).

## 6. Subscription / Pro
- [ ] **[M]** Open the subscription screen; plan/price shows.
- [ ] **[M]** Purchase Pro via the store (sandbox account) → Pro unlocked.
- [ ] **[M]** Restore purchases works.
- [ ] "Subscription unavailable" state handled gracefully.

## 7. Deep links & agents
- [ ] Open a `foundkeep://` / `https://foundkeep.app/open?...` link → routes to the right item.
- [ ] OAuth complete deep link (`oauth/complete`) lands correctly.

## 8. Cross-cutting
- [ ] **[M]** Cross-device: a save from the web/extension appears on the phone (and vice-versa).
- [ ] Dark theme is consistent across every screen.
- [ ] No crashes; no unhandled error toasts on the happy paths.
- [ ] Back navigation and tab switching are stable.

---
Automated coverage lives in `apps/mobile/.maestro/` — run `maestro test .maestro` with
`--env EMAIL=… --env PASSWORD=…`. See that folder's README for run environments
(local emulator vs. Maestro Cloud) and the share-intent trigger.

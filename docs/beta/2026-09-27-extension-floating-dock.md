# Extension floating dock — 2026-09-27

The Chrome side panel and local-only library are gone. The extension now shows
a small floating dock on the page itself: a collapsed pill (bottom-right by
default, draggable) that expands into `Save page · Highlight · Screenshot ·
Note · Library ↗ · ⋯`. Capturing and reviewing a save happen in the dock — a
review card opens attached to it (destination, title, note, folder, tags).
Library, settings, import and local saves all moved to the web dashboard at
`foundkeep.app`; an account is required to save, and "This browser only" as a
destination is gone. `⋯` also has **Show on every site** (opt-in, puts the
collapsed dock on every page) and **Hide on this site**. Spec:
`docs/superpowers/specs/2026-09-27-extension-floating-dock-design.md`.

This ships as extension **1.8.0**, built and verified locally against the dev
backend. It has not been released to friends or the Chrome Web Store yet.

## Real-site verification (spec risks 1 and 3)

Verified 2026-09-27 in headed Chromium (Playwright, `channel: 'chromium'`,
`headless: false`, under Xvfb) with the unpacked `apps/extension` loaded and
signed in as the same fixture account the automated tests use
(`chrome.storage.local` set directly; no real credentials). The dock was
summoned the same way the tests do — `import('./dock-control.js')` then
`summonDock(tabId, { expand })` — since the toolbar icon can't be clicked by
automation. On each site: collapsed dock, expanded dock, then a Save page
review card, always cancelled before any confirm.

| Site | Dock rendered | Review iframe loaded | Style leakage | Notes |
|---|---|---|---|---|
| github.com | Yes, clean | Yes (framed, not fallback popup) | None observed | Strict-CSP site named in the spec; iframe loaded normally. |
| x.com | Yes, clean | Yes (framed) | None observed | Hosted via the static `content_scripts` entry (matches `*://x.com/*`), not `summonDock`'s `chrome.scripting.executeScript` injection path — the dock is already running before anything summons it. `summonDock` on x.com also skips its usual pre-emptive `dock-state` push because `chrome.tabs.get` redacts `tab.url` for tabs matched only by a static content script (see the flaky-test fix below); the dock still renders correctly here because rendering now waits for the content script's own `dock-hello` reply instead of racing it. |
| youtube.com | Yes, clean | Yes (framed) | None observed | Google's own cookie-consent modal appeared centered on load; it did not overlap the dock's corner and did not block the flow. |
| notion.so (public template page, `notion.so/templates/simple-to-do-list`) | Yes, clean | Yes (framed) | None observed | A cookie-consent banner initially rendered in the dock's default bottom-right corner and would have intercepted a click there — dismissed it first, as a real visitor would. Worth a follow-up: the dock's default position can collide with common bottom-right consent banners on first visit. |

Result: the review iframe loaded on every site tested, including both
strict-CSP sites named in the spec (github.com, x.com) — Chrome does not
enforce a page's `frame-src` against its own extension's `web_accessible_resources`,
confirming the same finding already captured in `tests/extension-dock-flow.mjs`'s
CSP test. No page CSS leaked into the dock on any site (shadow DOM + `all:
initial` held up). Screenshots (collapsed/expanded/review per site, 12 total):
`docs/beta/dock/`.

The public notion.so workspace-page URL format (`notion.so/<workspace>/<slug>`)
renders a soft "page couldn't be found" without a live page id; the marketplace
template detail pages (also served from `www.notion.so`, no login) were used
instead as a stable, genuinely public substitute with the same app shell.

Not covered here: risk 2 (the always-on permission prompt / install-time
permission change) — out of this task's scope.

## Flaky test fixed: `dock: hiding on x.com survives an X save…`

`tests/extension-dock-flow.mjs`'s test "dock: hiding on x.com survives an X
save despite the background's redacted tab.url" (added in Task 5) failed
intermittently under load. Reproduced reliably before any fix: 8 of 10 runs
failed, first at `dock.waitFor("__foundkeepDock.state() === 'hidden'")`, then
(after tightening the test's own click sequencing) at
`dock.waitFor("...rect('[data-menu=\"more\"]').height > 0")` — the "more" menu
never opened at all.

**This is a real product race, not just test timing**, and it's fixed in
`apps/extension/src/dock/dock.js`, not just the test. On x.com,
`summonDock()` (`apps/extension/src/dock-control.js`) cannot safely refresh
the dock's state before showing it: `chrome.tabs.get` redacts `tab.url` for
tabs matched only by a static `content_scripts` entry (x.com/twitter.com, not
`host_permissions`), and pushing a `dock-state` built from a null origin would
incorrectly compute `hiddenHere: false` and undo a real per-site hide. So on
x.com the *only* source of `dockState` (which gates whether `.actions` —
including the `⋯`/`more` button — renders at all) is the content script's own
`dock-hello` round trip, fired once at script load. A `dock-show` message
arriving from an external `summonDock({expand:true})` call before that round
trip resolves used to render `mode: 'expanded'` while `dockState` was still
`null`, which reads `connected` as `false` and hides every action button —
an apparently-expanded but actually-empty dock. A click computed against that
empty layout lands outside the dock, which the page's own
"click outside collapses it" listener then collapses right back down, so the
menu the test wanted never opens.

Fix: `dock.js` now keeps the initial `dock-hello` request in a `dockReady`
promise, and the `'dock-show'` handler applies its mode change immediately
only if `dockState` is already populated, otherwise defers until `dockReady`
resolves. Real users are extremely unlikely to hit this (the toolbar-icon
click that triggers `dock-show` happens long after `dock-hello` has already
resolved), but a fast programmatic `summonDock` call — exactly what this test
and the always-on/import flows do — could win the race. Also added a
defensive wait in the test itself (matching the existing pattern used for the
screenshot submenu a few tests down) so it waits for the `more` menu to
actually be open before clicking into it, rather than assuming the previous
click already landed.

**Stability proof:** `tests/extension-dock-flow.mjs` alone, run 10 times in a
row after the fix:

```
for i in $(seq 1 10); do /usr/bin/node --test tests/extension-dock-flow.mjs; done
```

10/10 passed (0 failures across all 150 individual test cases in those 10
runs). Before the fix, the same loop failed 8/10 times.

## Verification — every suite

| Suite | Command | Result |
|---|---|---|
| Extension | `/usr/bin/node --test tests/extension-smoke.mjs tests/extension-cloud.mjs tests/extension-db.mjs tests/extension-extractor.mjs tests/extension-preferences.mjs tests/extension-policy.mjs tests/extension-store.mjs tests/bookmark-import.mjs tests/library-api.mjs tests/extension-environments.mjs tests/extension-environments-browser.mjs tests/extension-collections.mjs tests/extension-review.mjs tests/extension-dock-ui.mjs tests/extension-dock-flow.mjs tests/extension-dock-always-on.mjs tests/extension-dock-account.mjs tests/save-review-tabs.mjs` (i.e. `test:extension`) | 87 pass, 0 fail (run twice for confidence) |
| Backend | `cd apps/backend && ATLAS_DATA_DIR=$(mktemp -d) ~/.bun/bin/bun test` | 465 pass, 0 fail, 3421 `expect()` calls |
| Site typecheck | `cd apps/site && ~/.bun/bin/bunx tsc --noEmit` | Clean, no errors |

## Installing the 1.8.0 dev build

Built with `/usr/bin/node deploy/build-extension.mjs --environment dev`, output:

```
/home/pritam/personal/apps/foundkeep-dock/deploy/dist/extensions/dev/foundkeep-extension-dev.zip
```

(unpacked alongside it at `foundkeep-extension-dev/`, plus a matching
`customer-config.json` for the paired dev web build).

1. Unzip `foundkeep-extension-dev.zip` (or point straight at the unpacked
   `foundkeep-extension-dev/` folder).
2. Load it unpacked via `chrome://extensions` → Developer mode → **Load
   unpacked**.
3. It shows as "FoundKeep Dev — Save what matters" and only ever talks to
   `https://dev.foundkeep.app`; it keeps a separate identity, storage and
   local database (`atlas-dev`) from any installed production build, so both
   can be installed side by side.
4. Sign in against `dev.foundkeep.app` and try the dock: click the toolbar
   icon to summon it, drag it by the grip, and run a real Save page /
   Highlight / Screenshot / Note through the review card.

Shipping to friends (an `ext-v1.8.0` GitHub release) and the Chrome Web Store
1.0.3 kit are separate steps that need Pritam's go-ahead after trying this
build.

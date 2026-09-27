# Extension floating dock — design

Date: 2026-09-27
Status: Approved in conversation (Pritam, 2026-09-27); awaiting spec review
Replaces: the Chrome side panel as the extension's surface (`side_panel` → `src/library.html`)

## Goal

Replace the extension's Chrome side panel with a small floating dock that lives
on the web page, modeled on a compact dark toolbar (drag grip, icon + label
actions). The dock is collapsed most of the time and expands when used. Capturing
and reviewing a save happen in the dock; everything else (library, settings,
local saves) lives in the web dashboard at foundkeep.app.

## Decisions (from Pritam)

| Question | Decision |
|---|---|
| Which sidebar | The extension side panel. The web app sidebar is unchanged. |
| When the dock appears | Summoned on the current tab by default; an opt-in **Show on every site** setting puts the collapsed dock on every page. |
| Library, settings, import, local saves | The web dashboard. The extension keeps only capture and save review. |
| Signed-out use | An account is required to save. The "This browser only" destination is removed. |

## Behavior

### States

1. **Collapsed** — a small dark pill with the FoundKeep mark, default position
   bottom-right, 16px from the edges. Clicking it expands the dock. Hover does
   nothing (a hover-to-expand widget on every site is intrusive).
2. **Expanded** — a single-row toolbar:
   `⋮⋮ grip · Save page · Highlight · Screenshot · Note · Library ↗ · ⋯`.
   - *Screenshot* offers Region / Full page in a small popover.
   - *Library ↗* opens `https://foundkeep.app/dashboard` in a new tab.
   - *⋯* menu: **Show on every site** (toggle), **Hide on this site**,
     **Import browser bookmarks**, **Settings ↗** (dashboard settings).
   - Buttons for capture methods disabled in the account's preferences are hidden,
     using the existing `getEffectivePreferences()` capture flags.
3. **Review** — after any capture starts, a review card opens attached above (or
   below, if there is no room) the dock: destination (My library or a
   collection), title, personal note, folder, personal tags, and the collection
   share fields when a collection is chosen — the same fields as today's
   `destinationDialog`. Actions: **Save** / **Cancel**.

Collapse happens on Escape, on a click outside the dock and card, and ~4 seconds
after a successful save (the dock first shows a "Saved" confirmation). Collapse
is not forced while a review is open.

### Movement

- Drag by the grip in the collapsed and expanded states (pointer events). The
  dock is clamped inside the viewport and re-clamped on resize.
- Keyboard: with the grip focused, arrow keys move it 16px (Shift: 64px);
  **Home** resets to the default position.
- The position is stored once for all sites in `chrome.storage.local`
  (`foundkeep-dock-position`, as fractions of the viewport so it survives window
  size changes).

### How it appears

- **Toolbar icon** — injects the dock into the active tab (using the `activeTab`
  grant) and expands it. A second click collapses it. `openPanelOnActionClick`
  is removed.
- **Context menus and keyboard shortcuts** — inject the dock if absent, stage the
  review as today, and open the review card on that tab.
- **X/Twitter save button** (`src/twitter.js`) — stages the tweet review as today
  and opens the review card on that tab instead of the side panel.
- **Show on every site** — requests the already-declared optional host
  permission (`<all_urls>`). When granted, the extension registers the dock
  script for all `http(s)` pages with `chrome.scripting.registerContentScripts`,
  and pages load with the collapsed pill. Turning it off unregisters the script
  and leaves the permission in place (the user can revoke it in Chrome).
- **Hide on this site** — adds the page's origin to `foundkeep-dock-hidden-origins`
  (`chrome.storage.local`). Always-on injection skips those origins; summoning
  from the icon still works and offers "Show on this site again" in `⋯`.
- **Pages extensions can't script** (chrome://, the Web Store, the built-in PDF
  viewer, other extensions' pages) — the icon opens the dashboard in a new tab;
  context menus and shortcuts show the existing failure flash.

### Signed out

The dock expands to a single **Sign in to save** button that opens the existing
connect flow on foundkeep.app. Capture buttons are not shown until connected.

## Architecture

### Components

| Unit | File(s) | Responsibility |
|---|---|---|
| Dock shell | `src/dock/dock.js`, `src/dock/dock.css` | Content script. Renders the pill/toolbar in a **closed shadow root** on a fixed-position host element; drag, keyboard, collapse; sends user intents to the background. Shows no account data. |
| Review card | `src/review.html`, `src/review.js` (from `sidebar-destination.js`, `save-details.js`, tag input) | Extension page loaded in an iframe the dock positions. Reads and confirms the staged draft through the existing `save-review-*` messages. |
| Import page | `src/import.html`, `src/import.js` (from the side panel's import dialog + `bookmark-import.js`) | Extension page opened in a tab from `⋯` or from the dashboard. Requests the optional `bookmarks` permission from its own user gesture. |
| Background orchestration | `src/background.js`, new `src/dock-control.js` | Injects the dock, routes dock intents to the existing capture functions, stages reviews, tells the dock to open or close the card, manages always-on registration and hidden origins. |

The capture functions (`performCapture`, `saveHighlight`, `regionScreenshot`,
`fullPageScreenshot`, `saveImage`) and the upload queue are unchanged.

### Why an iframe for the review card

The card shows folders, tags and collection names, and its Save button commits a
capture. Rendered in the page's DOM (even in a closed shadow root), page scripts
could observe those values or synthesize clicks. As an extension-origin iframe the
page cannot read or click into it, and `trustedLibrarySender` already accepts
extension pages, so the existing `save-review-*` messaging applies once it also
accepts `src/review.html`.

The dock shell stays in the page because it holds no account data. Its handlers
ignore events whose `isTrusted` is false, and the worst a page could do by
reaching it is start a capture of itself that still waits in the review card for
the user to confirm.

### Messages

- Dock → background (content script; validated by `sender.tab`, `sender.frameId
  === 0` and an allowlisted `kind`): `dock-capture {action}`,
  `dock-open-library`, `dock-open-import`, `dock-settings`, `dock-hide-site`,
  `dock-always-on {enabled}`. The background never returns account data to the
  dock.
- Background → dock (`chrome.tabs.sendMessage`): `dock-show`, `dock-expand`,
  `dock-collapse`, `dock-review-open {draftId}`, `dock-review-close {saved}`,
  `dock-before-capture` / `dock-after-capture` (hide the dock while region and
  full-page screenshots run so it is not captured).
- Review card ↔ background: the existing `save-review-get | update | confirm |
  cancel`, with drafts keyed by **tab** instead of window (`save-review.js`
  `key(tabId)`), because two tabs in one window can each have a dock.

### Manifest changes

- Add `web_accessible_resources`: `src/review.html` (and the assets it needs),
  matched to `http(s)` pages, so the dock can frame it.
- Keep `activeTab`, `scripting`, `contextMenus`, `storage`, `alarms`, the optional
  `<all_urls>` host permissions and optional `bookmarks`. No new install-time
  permission.
- `src/dock/dock.js` is injected with `chrome.scripting.executeScript` (summoned)
  or `registerContentScripts` (always on), so it is a classic script with no
  imports; its CSS is inlined into the shadow root.

### Removed

- Manifest `side_panel` and the `sidePanel` permission; `openReviewPanel()` and
  `chrome.sidePanel.*` calls.
- `src/library.html`, `src/library.js`, `src/library.css`, `sidebar-capture.js`,
  `sidebar-local.js`, and the side-panel parts of `sidebar-destination.js` that
  the review card does not reuse.
- The "This browser only" destination and the local-saves dialog.

### Local-only saves (migration)

Existing captures that were saved only in this browser stay in IndexedDB. After the
user connects, the dock shows a one-time prompt in the expanded state: "N saves
are only in this browser — Move to My library / Later". *Move* calls the existing
`importLocalCaptures({ confirmed: true, accountId })` path. *Later* re-asks after
7 days. Offline queuing of account saves (`drainQueue`) is unchanged.

### Theming and layout

- Dark surface by default (`#0f1011`, 1px `#1d1f22` border, 12px radius, soft
  shadow), emerald accent (`#4cc38a`) for focus and the Saved state — the FoundKeep
  dark direction. The review card follows the extension's theme preference.
- System UI font stack at 13–14px; 36px hit targets; `z-index: 2147483646`.
- The host element sets `all: initial`, so page CSS cannot restyle the dock.
- `prefers-reduced-motion` turns expand/collapse into a fade.
- The dock is not rendered inside iframes (top frame only), and it hides while the
  page is in fullscreen.

## Error handling

- Injection fails (restricted page, missing grant after navigation): the icon
  opens the dashboard; a context menu or shortcut shows the existing failure flash.
- The review iframe fails to load (for example, if a page's CSP blocks it — see
  risks): the background falls back to a 380×560 popup window (`chrome.windows.create`,
  `type: 'popup'`) showing `review.html` for that tab's draft.
- A second capture on a tab with an open review shows "Finish or cancel the
  current save first" in the card, matching today's single-draft rule.
- The tab navigates while a review is open: the draft remains available for 30
  minutes as today; summoning the dock on the new page reopens the card.

## Testing

Playwright with the unpacked dev build (the pattern in `tests/extension-*.mjs`):

- The icon injects and expands the dock; a second click collapses it.
- Every capture action opens the review card; Save lands in My library; saving to
  a collection sends the shared fields; Cancel clears the draft.
- Context menu, keyboard shortcut and the X/Twitter button open the card on the
  right tab; two tabs keep separate drafts.
- Drag, keyboard move, Home reset and position persistence across pages.
- Show on every site: permission granted → pill on a fresh page; hidden origin →
  no pill; turning it off unregisters.
- Signed out: only "Sign in to save".
- Security: a synthetic `click()` from page script on the dock host does nothing;
  the page cannot read the review iframe; dock messages from another tab's frame
  are rejected.
- Restricted page: the icon opens the dashboard.
- The dock is absent from region and full-page screenshots.
- Local-save migration prompt appears once with N saves, and *Move* uploads them.
- Remove or rewrite the side-panel assertions in `extension-store.mjs`,
  `extension-action.mjs`, `extension-library.mjs`, `extension-destination.mjs`,
  `extension-environments-browser.mjs` and `customer-flow.mjs`.

## Rollout

1. Build **FoundKeep Dev** (`bun run extension:build:dev`) against
   dev.foundkeep.app for Pritam to try.
2. Friends channel: a GitHub `ext-v1.8.0` release (auto-updates).
3. Chrome Web Store: ship in the 1.0.3 store update (launch roadmap P6.3), with a
   new listing description, screenshots and permission justifications (the
   `sidePanel` justification removed; `activeTab`/`scripting` now describe the
   dock).

No backend change is required. The dashboard gets an "Import from this browser"
link that opens `import.html` through the existing `externally_connectable`
channel (`open-import`).

## Out of scope

- The web app's sidebar.
- A dock inside the mobile app.
- Hover previews, dock themes, and multiple dock positions per site.

## Risks to verify early in implementation

1. **Page CSP and extension iframes.** Chrome is expected to let a content script
   embed a `web_accessible_resources` page regardless of the page's `frame-src`.
   Verify on strict-CSP sites (github.com, x.com); the popup-window fallback
   covers failures.
2. **Always-on permission prompt.** Chrome's "read and change all your data"
   prompt appears only when the user turns on Show on every site, never at
   install; confirm no install-time permission change in the 1.0.3 store build.
3. **Pages with aggressive styles or overlays.** `all: initial`, a closed shadow
   root and a max z-index handle most; test on x.com, youtube.com, notion.so and
   google docs.

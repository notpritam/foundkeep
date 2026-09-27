# Extension Floating Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FoundKeep extension's Chrome side panel with a floating, collapsible dock on the web page, with save review in an extension-origin card and everything else in the web dashboard.

**Architecture:** A classic content script (`src/dock/dock.js`) renders the dock in a closed shadow root and sends user intents to the service worker. A new background module (`src/dock-control.js`) injects the dock, routes intents to the existing capture pipeline, and opens the review card, an extension page (`src/review.html`) framed by the dock. Save drafts become per-tab. The side panel, its library UI and the local-only destination are removed at the end, after the dock path is proven.

**Tech Stack:** Chrome MV3 extension (plain ES modules in the service worker and pages, classic content scripts), Playwright (`playwright-core`) with `node:test` for browser tests, Next.js site (`apps/site`) for one dashboard link.

**Spec:** `docs/superpowers/specs/2026-09-27-extension-floating-dock-design.md`

## Global Constraints

- No new install-time permissions. Remove `sidePanel`; keep `activeTab`, `scripting`, `contextMenus`, `storage`, `alarms`, optional `<all_urls>`/`http://*/*`/`https://*/*`, optional `bookmarks`.
- Dock renders in the **top frame only**, inside a **closed** shadow root, on a host element with `all: initial` and `z-index: 2147483646`, appended to `document.documentElement`.
- Dock look: surface `#0f1011`, 1px border `#1d1f22`, 12px radius, accent `#4cc38a`, system UI font 13–14px, 36px hit targets; `prefers-reduced-motion` → fade only.
- Default position bottom-right, 16px from edges. Arrow keys move 16px (Shift: 64px); Home resets. Position stored once for all sites as viewport fractions in `chrome.storage.local` key `foundkeep-dock-position`.
- Other storage keys: `foundkeep-dock-hidden-origins` (array of origins), `foundkeep-dock-always-on` (boolean), `foundkeep-dock-local-prompt` (`{laterUntil:number}`).
- Collapse on Escape, click outside, and ~4 s after a successful save; never while a review is open.
- Dock event handlers ignore events with `isTrusted === false`.
- Review card: extension page in an iframe; `web_accessible_resources` with `use_dynamic_url: true`; fallback popup window 380×560 when the frame does not report ready within 3 s.
- Save drafts are keyed by **tab id**, expire after 30 minutes, one open draft per tab.
- An account is required to save; the `local` destination is removed.
- `src/dock/dock.js` is a classic script: no `import`/`export`; its CSS is inlined.
- Version `1.8.0`; friends release tag `ext-v1.8.0`.
- In this shell `node` is broken: run node as `/usr/bin/node`, bun as `~/.bun/bin/bun`. Extension tests run with `/usr/bin/node --test tests/<file>.mjs` from the repo root.

## Review Focus

1. **SPA navigation (x.com, YouTube).** After an in-app URL change the dock stays and captures must target the tab's *current* URL; after a cross-origin navigation the `activeTab` grant is gone and the dock must say "Click the FoundKeep icon on this page to allow capture" rather than fail silently. → test in Task 4.
2. **Strict page CSP.** A page served with `Content-Security-Policy: frame-src 'none'` must still get a working review (iframe or the popup fallback). → test in Task 4.
3. **Reload mid-review.** Reloading the page closes the dock (unless always-on) but keeps the draft; summoning again reopens the card with the typed note. → test in Task 4.
4. **Two tabs at once.** Each tab keeps its own draft; confirming in one never saves the other. → test in Task 1.
5. **Keyboard-only use.** Tab reaches every dock control, Escape collapses and returns focus to the pill, and the review card traps focus while open. → test in Task 3.

---

### Task 1: Per-tab save drafts and trusted review senders

**Files:**
- Modify: `apps/extension/src/save-review.js` (key, lock and API by tab id; drop the "sidebar" wording)
- Modify: `apps/extension/src/library-api.js` (`trustedLibrarySender` page list)
- Modify: `apps/extension/src/background.js` (save-review message handlers take `tabId`; clear drafts on tab close)
- Modify: `apps/extension/src/sidebar-destination.js` (send `tabId` of the active tab while the side panel still exists)
- Test: `tests/save-review-tabs.mjs` (new), `tests/library-api.mjs` (update)

**Interfaces:**
- Produces:
  - `readSaveReview(tabId: number): Promise<Draft|null>`
  - `stageSaveReview(request: {action, tab, ...}): Promise<Draft>` — keyed by `request.tab.id`
  - `updateSaveReview(tabId: number, id: string, form: object): Promise<void>`
  - `cancelSaveReview(tabId: number, id: string): Promise<void>`
  - `confirmSaveReview({tabId, id, choice}, capture): Promise<Record|null>`
  - `clearSaveReview(tabId: number): Promise<void>` (new; used on tab close)
  - Messages `save-review-get|update|cancel|confirm` carry `tabId` (integer) instead of `windowId`.
  - `trustedLibrarySender` accepts `library.html`, `popup.html`, `dashboard.html`, `review.html`, `import.html`, `dock-settings.html`.

- [ ] **Step 1: Write the failing test**

Create `tests/save-review-tabs.mjs`. It loads the extension, opens two fixture tabs on the host-permitted origin, stages a draft in each from an extension page, and checks isolation.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

test('save drafts are per tab: two tabs keep separate drafts and closing a tab drops its draft', { timeout: 30000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-drafts-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__draft-*', route => route.fulfill({ contentType: 'text/html', body: '<title>Draft fixture</title><p>Text</p>' }));
  const a = await context.newPage(); await a.goto(origin + '/__draft-a');
  const b = await context.newPage(); await b.goto(origin + '/__draft-b');
  const page = await context.newPage(); await page.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const ids = await page.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => /__draft-[ab]$/.test(tab.url)).sort((x, y) => x.url.localeCompare(y.url)).map(tab => tab.id);
  });
  const staged = await page.evaluate(async ([ta, tb]) => {
    const m = await import('./save-review.js');
    const tabA = await chrome.tabs.get(ta), tabB = await chrome.tabs.get(tb);
    const da = await m.stageSaveReview({ action: 'savepage', tab: tabA, trigger: 'dock' });
    const db = await m.stageSaveReview({ action: 'savepage', tab: tabB, trigger: 'dock' });
    return [da.tab.id, db.tab.id, (await m.readSaveReview(ta)).id === da.id, (await m.readSaveReview(tb)).id === db.id];
  }, ids);
  assert.deepEqual(staged, [ids[0], ids[1], true, true]);
  const second = await page.evaluate(async ta => {
    const m = await import('./save-review.js');
    try { await m.stageSaveReview({ action: 'highlight', tab: await chrome.tabs.get(ta), trigger: 'dock' }); return 'staged'; }
    catch (error) { return error.message; }
  }, ids[0]);
  assert.match(second, /Finish or cancel the current save first/);
  await a.close();
  await page.waitForFunction(async ta => !(await (await import('./save-review.js')).readSaveReview(ta)), ids[0]);
  assert.ok(await page.evaluate(async tb => !!(await (await import('./save-review.js')).readSaveReview(tb)), ids[1]));
});
```

In `tests/library-api.mjs`, add next to the existing `trustedLibrarySender` assertions:

```js
for (const page of ['review.html', 'import.html', 'dock-settings.html'])
  assert.equal(trustedLibrarySender({ id: runtime.id, url: runtime.getURL('src/' + page) + '?tab=4' }, runtime), true, page);
assert.equal(trustedLibrarySender({ id: runtime.id, url: runtime.getURL('src/dock/dock.js') }, runtime), false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/usr/bin/node --test tests/save-review-tabs.mjs tests/library-api.mjs`
Expected: FAIL — drafts collide (keyed by window) and the new pages are untrusted.

- [ ] **Step 3: Implement per-tab drafts**

In `apps/extension/src/save-review.js`, replace the window keying:

```js
const key = tabId => 'foundkeep-save-review-tab-' + tabId;
const locks = new Map();
const changed = tabId => chrome.runtime.sendMessage({ kind: 'foundkeep-save-review-changed', tabId }).catch(() => {});
async function exclusive(tabId, run) {
  const previous = locks.get(tabId) || Promise.resolve();
  const next = previous.catch(() => {}).then(run); locks.set(tabId, next);
  try { return await next; } finally { if (locks.get(tabId) === next) locks.delete(tabId); }
}
export async function readSaveReview(tabId) {
  const draft = (await chrome.storage.session.get(key(tabId)))[key(tabId)];
  return draft && Date.now() - draft.createdAt < 30 * 60_000 ? draft : null;
}
export async function clearSaveReview(tabId) {
  await chrome.storage.session.remove(key(tabId)); changed(tabId);
}
```

Then change every function to take `tabId` where it took `windowId`: `stageSaveReview` uses `request.tab.id` for the lock and key and throws `'Finish or cancel the current save first.'`; `cancelSaveReview(tabId, id)`, `updateSaveReview(tabId, id, form)`, `confirmSaveReview({ tabId, id, choice }, capture)`; every `changed()` call passes the tab id. Keep all validation unchanged.

In `apps/extension/src/library-api.js`:

```js
// Framed review pages use a per-session dynamic host (use_dynamic_url), so match
// the extension id, the extension scheme and the page path rather than the host.
export function trustedLibrarySender(sender, runtime) {
  if (sender?.id !== runtime.id) return false;
  try { const url=new URL(sender.url); return url.protocol==='chrome-extension:'&&['library.html','popup.html','dashboard.html','review.html','import.html','dock-settings.html'].some(page=>url.pathname==='/src/'+page); }
  catch {return false;}
}
```

Add to the `tests/library-api.mjs` assertions: `assert.equal(trustedLibrarySender({ id: 'other', url: runtime.getURL('src/review.html') }, runtime), false);` and `assert.equal(trustedLibrarySender({ id: runtime.id, url: 'https://evil.example/src/review.html' }, runtime), false);`

In `apps/extension/src/background.js`, in the `['prepare-save','save-review-get',…]` handler: require `Number.isInteger(msg.tabId)` (instead of `windowId`) for the four `save-review-*` kinds and pass `msg.tabId` to the save-review functions (`confirmSaveReview({ ...msg })` already forwards `tabId`). Add at module level:

```js
chrome.tabs.onRemoved.addListener(tabId => { void clearSaveReview(tabId); });
```

(import `clearSaveReview` from `./save-review.js`). In `sidebar-destination.js`, compute the id once per request so the side panel keeps working until Task 8:

```js
const request = async (kind, values = {}) => {
  windowId ??= (await chrome.windows.getCurrent()).id;
  const [active] = await chrome.tabs.query({ active: true, windowId });
  const result = await chrome.runtime.sendMessage({ kind, windowId, tabId: active?.id, ...values });
  if (!result?.ok) throw new Error(result?.error || 'Could not prepare the save. Try again.');
  return result;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/usr/bin/node --test tests/save-review-tabs.mjs tests/library-api.mjs tests/extension-destination.mjs tests/extension-action.mjs`
Expected: PASS (the side-panel tests still pass through the transitional `tabId`). Fix `tests/extension-destination.mjs` reads of `readSaveReview(window.id)` to use the tab id if they fail.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/save-review.js apps/extension/src/library-api.js apps/extension/src/background.js apps/extension/src/sidebar-destination.js tests/save-review-tabs.mjs tests/library-api.mjs tests/extension-destination.mjs
git commit -m "refactor(extension): key save drafts by tab and trust the new extension pages"
```

---

### Task 2: Review card page

**Files:**
- Create: `apps/extension/src/review.html`, `apps/extension/src/review.js`, `apps/extension/src/review.css`
- Modify: `deploy/extension-files.json` (add the three files)
- Modify: `apps/extension/src/save-review.js` (note text comes from the review form)
- Test: `tests/extension-review.mjs` (new)

**Interfaces:**
- Consumes: Task 1 messages (`save-review-get|update|cancel|confirm` with `tabId`), `library-request`, `bindSaveTags` from `save-details.js`, `$`/`message` from `ui.js`.
- Produces:
  - Page URL `src/review.html?tab=<tabId>` (plus `&window=1` in the popup fallback).
  - `postMessage` to `window.parent` (only when framed), all shaped `{ foundkeepReview: true, type, ... }`:
    - `{type:'ready'}` once the draft rendered,
    - `{type:'resize', height:number}` whenever content height changes,
    - `{type:'done', saved:boolean}` after confirm or cancel.
  - In the popup fallback it calls `window.close()` instead of posting `done`.

- [ ] **Step 1: Write the failing test**

Create `tests/extension-review.mjs`: stage a `note` draft for a fixture tab from an extension page, open `review.html?tab=<id>` directly in a tab (no dock yet), and check the card.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

test('review card: account required, note text comes from the form, cancel clears the draft', { timeout: 30000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-review-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__review', route => route.fulfill({ contentType: 'text/html', body: '<title>Review fixture</title>' }));
  const web = await context.newPage(); await web.goto(origin + '/__review');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__review' }))[0].id);
  // Signed out: staging is refused with a sign-in message.
  const signedOut = await ext.evaluate(async id => { try { await (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }); return 'staged'; } catch (e) { return e.message; } }, tabId);
  assert.match(signedOut, /Sign in to FoundKeep to save/);
  // Signed in (fixture account with no network): a draft stages and renders.
  await ext.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));
  await context.route('**/api/organization', route => route.fulfill({ json: { folders: [], tags: [], suggestedTags: [] } }));
  await context.route('**/api/collections', route => route.fulfill({ json: { collections: [] } }));
  await ext.evaluate(async id => (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }), tabId);
  const card = await context.newPage(); await card.goto(await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), tabId));
  await card.waitForSelector('#reviewForm[data-ready="true"]');
  assert.deepEqual(await card.$$eval('#saveDestination option', options => options.map(o => o.value)), ['library']);
  assert.equal(await card.getAttribute('#reviewNote', 'required'), '');
  await card.click('#reviewCancel');
  await card.waitForFunction(async id => !(await (await import('./save-review.js')).readSaveReview(id)), tabId);
});
```

Add a second test in the same file: route `**/api/collections` to `{ collections: [{ id: 'col_1', title: 'Design refs', visibility: 'public', canSubmit: true, requireApproval: false, canModerate: true }] }`, stage a `savepage` draft, open the card, wait for `#saveDestination option[value="collection:col_1"]`, select it, and assert `#destinationShare` is visible and `#destinationConfirm` reads `Save to collection`. The routes are fetched by the service worker; if Playwright does not intercept them, launch with `env: { ...process.env, PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: '1' }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `/usr/bin/node --test tests/extension-review.mjs`
Expected: FAIL — `review.html` does not exist and signed-out staging is allowed.

- [ ] **Step 3: Build the review page**

`apps/extension/src/review.html` — the destination form from `library.html`'s `destinationDialog`, as the page body (no `<dialog>`), with these ids renamed where marked:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FoundKeep — Review your save</title>
<link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="review.css">
<script src="theme.js" type="module"></script></head>
<body>
<form id="reviewForm" data-ready="false">
  <header class="review-head"><p class="eyebrow">Save to <span data-product-name>FoundKeep</span></p><h1 id="destinationSource">Your next good find</h1></header>
  <fieldset id="destinationFields" class="review-body">
    <details id="destinationOriginal"><summary>View original content</summary><p id="destinationExcerpt"></p></details>
    <label class="field">Save in<select id="saveDestination" required></select></label>
    <p id="destinationRules" class="fine"></p>
    <label class="field">Title<input id="destinationPersonalTitle" maxlength="1000" placeholder="Give this save a useful name"></label>
    <label class="field"><span id="destinationNoteLabel">Personal note</span><textarea id="reviewNote" rows="3" maxlength="50000" placeholder="Why are you saving this?"></textarea></label>
    <div class="destination-folder-head"><label for="destinationFolder" class="field">Folder</label><button id="destinationNewFolderToggle" type="button" class="btn quiet" aria-expanded="false">New folder</button></div>
    <label class="field"><select id="destinationFolder" aria-label="Folder"></select></label>
    <div id="destinationNewFolder" hidden><label class="field">New folder name<input id="destinationFolderName" maxlength="80"></label><button id="destinationCreateFolder" type="button" class="btn secondary">Create</button><p id="destinationFolderFeedback" class="statusline" role="status"></p></div>
    <fieldset class="save-tags-field"><legend>Personal tags</legend><div id="destinationTags" data-label="Add a personal tag"></div></fieldset>
    <p id="destinationPreservation" class="fine" hidden>FoundKeep will also try to keep this post’s photos, videos and linked articles in your private library.</p>
    <section id="destinationShare" hidden>
      <h2>Shared with this collection</h2><p class="fine">Your personal note, folder and personal tags stay private.</p>
      <label class="field">Title in collection<input id="destinationTitle" maxlength="200"></label>
      <label class="field">Source link<input id="destinationUrl" type="url" maxlength="2048"></label>
      <label class="field">Text in collection<textarea id="destinationBody" rows="4" maxlength="5000"></textarea></label>
      <fieldset class="save-tags-field"><legend>Tags in collection</legend><div id="destinationSharedTags" data-label="Add a collection tag"></div></fieldset>
      <label id="destinationImageLabel" class="attach-source" hidden><input id="destinationImage" type="checkbox">Include the saved image</label>
    </section>
  </fieldset>
  <footer class="review-foot"><p id="destinationFeedback" class="statusline" role="status"></p>
    <button id="destinationReload" type="button" class="btn quiet" hidden>Retry</button>
    <button id="reviewCancel" type="button" class="btn quiet">Cancel</button>
    <button id="destinationConfirm" type="submit" class="btn primary">Save</button></footer>
</form>
<script src="review.js" type="module"></script>
</body></html>
```

`apps/extension/src/review.js` — port `bindSidebarDestination()` from `sidebar-destination.js` with these changes (copy the whole function, then apply each):

1. `const tabId = Number(new URLSearchParams(location.search).get('tab'));` and `const framed = window.parent !== window;`. `request()` sends `{ kind, tabId, ...values }` and no longer reads windows.
2. Destinations: only `library` and collections. Remove every `'local'` branch (`renderDestinations` no longer adds "This browser only"; `selection()` drops `local` and the folder hint; the confirm label is `Save` or the collection label).
3. The note field id is `reviewNote`; for `draft.action === 'note'` set `$('reviewNote').required = true` and label it `Note`.
4. Replace dialog open/close with page state: set `$('reviewForm').dataset.ready = 'true'` after the first render and post `{type:'ready'}`.
5. `finish(saved)`: when framed, `window.parent.postMessage({ foundkeepReview: true, type: 'done', saved }, '*')`; otherwise `window.close()`.
6. Cancel calls `save-review-cancel` then `finish(false)`; a successful confirm calls `finish(true)`.
7. Report height with a `ResizeObserver` on `document.body`: post `{type:'resize', height: Math.ceil(document.body.scrollHeight)}` when framed.
8. Escape (`keydown` on `document`) triggers Cancel; focus stays inside the form (on `Tab` from the last focusable element, focus the first; `Shift+Tab` from the first focuses the last).
9. For `region` drafts show `Drag over the page to select a region. Press Esc on the page to cancel.` while saving, as today.

`apps/extension/src/review.css` — card styles: `body{margin:0;background:transparent}` then a `#reviewForm` card at 100% width with the theme tokens from `theme.css`, 12px radius, 16px padding, max height `min(560px, 100vh)` with the body scrolling.

In `apps/extension/src/save-review.js`:
- `stageSaveReview`: after `captureBinding()`, `if (!binding.cloudAccountId) throw new Error('Sign in to FoundKeep to save.');`
- `confirmSaveReview`: reject `choice.kind === 'local'` with `'Sign in to FoundKeep to save.'`; for `draft.action === 'note'`, require `details.noteText` to be a non-empty string of at most 50,000 characters and pass it as the captured text: `const record = existing || await capture({ ...draft, text: draft.action === 'note' ? details.noteText : draft.text }, input => saveCapture(input, { destination, id: draft.id }));`

Add `src/review.html`, `src/review.js`, `src/review.css` to `deploy/extension-files.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `/usr/bin/node --test tests/extension-review.mjs tests/save-review-tabs.mjs`
Expected: PASS. (`save-review-tabs.mjs` now needs a signed-in fixture: add the same `chrome.storage.local.set({ atlasCustomer: … })` before staging.)

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/review.* apps/extension/src/save-review.js deploy/extension-files.json tests/extension-review.mjs tests/save-review-tabs.mjs
git commit -m "feat(extension): review card page with account-only destinations"
```

---

### Task 3: Dock content script

**Files:**
- Create: `apps/extension/src/dock/dock.js`
- Create: `tests/helpers/dock-world.mjs`, `tests/extension-dock-ui.mjs`
- Modify: `deploy/extension-files.json` (add `src/dock/dock.js`)

**Interfaces:**
- Consumes (background → dock via `chrome.tabs.sendMessage`): `{kind:'dock-show', expand?:boolean}`, `{kind:'dock-collapse'}`, `{kind:'dock-review-open', url:string}` (review page URL from `chrome.runtime.getURL`), `{kind:'dock-review-close', saved:boolean}`, `{kind:'dock-hide'}`, `{kind:'dock-unhide'}`, `{kind:'dock-status', text:string, tone:'error'|'ok'|''}`, `{kind:'dock-state', state:DockState}`.
- Produces (dock → background via `chrome.runtime.sendMessage`):
  - `{kind:'dock-hello'}` → response `DockState = { connected:boolean, actions:{savepage,highlight,region,fullpage,note:boolean}, alwaysOn:boolean, hiddenHere:boolean, localOnly:number, show:boolean }`
  - `{kind:'dock-capture', action:'savepage'|'highlight'|'region'|'fullpage'|'note'}`
  - `{kind:'dock-open', target:'library'|'settings'|'import'|'sign-in'}`
  - `{kind:'dock-site', hidden:boolean}`, `{kind:'dock-always-on', enabled:boolean}`
  - `{kind:'dock-review-fallback'}`, `{kind:'dock-local', choice:'move'|'later'}`
- Isolated-world test handle: `window.__foundkeepDock = { state(): 'hidden'|'collapsed'|'expanded'|'review', rect(selector): {x,y,width,height}, position(): {left,top}, focused(): string|null, visible(): boolean }` (visible only in the content-script world, never to the page).

- [ ] **Step 1: Write the test helper and failing UI test**

`tests/helpers/dock-world.mjs` — evaluate inside the extension's isolated world through CDP and click with trusted mouse input:

```js
export async function dockWorld(page, extensionId) {
  const cdp = await page.context().newCDPSession(page);
  const worlds = new Map();
  cdp.on('Runtime.executionContextCreated', ({ context }) => {
    if (context.auxData?.type === 'isolated' && (context.origin === `chrome-extension://${extensionId}` || /FoundKeep/.test(context.name))) worlds.set(context.auxData.frameId, context.id);
  });
  cdp.on('Runtime.executionContextsCleared', () => worlds.clear());
  await cdp.send('Runtime.enable');
  const mainFrame = async () => (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
  async function evaluate(expression) {
    for (let i = 0; i < 100; i++) {
      const id = worlds.get(await mainFrame());
      if (id) {
        const r = await cdp.send('Runtime.evaluate', { contextId: id, expression, returnByValue: true, awaitPromise: true });
        if (!r.exceptionDetails) return r.result.value;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Dock world not available: ' + expression);
  }
  const waitFor = async (expression, timeout = 5000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error('Timed out: ' + expression);
  };
  const click = async selector => {
    const r = await evaluate(`__foundkeepDock.rect(${JSON.stringify(selector)})`);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  };
  return { evaluate, waitFor, click };
}
```

`tests/extension-dock-ui.mjs` — inject the dock directly (Task 4 adds the real summon path), then drive it:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

test('dock: collapsed pill, expand, keyboard, drag and position memory, page scripts cannot drive it', { timeout: 45000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-dock-ui-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    viewport: { width: 1200, height: 800 }, args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__dock*', route => route.fulfill({ contentType: 'text/html', body: '<title>Dock fixture</title><p style="height:3000px">Long page</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__dock');
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__dock' }))[0].id);
  await worker.evaluate(async id => { await chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/dock/dock.js'] }); await chrome.tabs.sendMessage(id, { kind: 'dock-show' }); }, tabId);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  // Closed shadow root: the page sees an opaque element and cannot open it.
  assert.equal(await web.evaluate(() => document.querySelector('foundkeep-dock')?.shadowRoot ?? null), null);
  await web.evaluate(() => document.querySelector('foundkeep-dock').click());
  assert.equal(await dock.evaluate(`__foundkeepDock.state()`), 'collapsed', 'a synthetic click must not expand the dock');
  // Default bottom-right, 16px from the edges.
  const pill = await dock.evaluate(`__foundkeepDock.rect('.pill')`);
  assert.equal(Math.round(1200 - (pill.x + pill.width)), 16); assert.equal(Math.round(800 - (pill.y + pill.height)), 16);
  await dock.click('.pill');
  await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  for (const action of ['savepage', 'highlight', 'screenshot', 'note', 'library', 'more'])
    assert.ok(await dock.evaluate(`!!__foundkeepDock.rect('[data-action="${action}"]').width`), action);
  // Keyboard: Escape collapses and returns focus to the pill.
  await web.keyboard.press('Escape');
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  assert.equal(await dock.evaluate(`__foundkeepDock.focused()`), 'pill', 'Escape returns focus to the pill');
  // Tab reaches every toolbar control in order.
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  const reached = [];
  for (let i = 0; i < 7; i++) { await web.keyboard.press('Tab'); reached.push(await dock.evaluate(`__foundkeepDock.focused()`)); }
  for (const action of ['savepage', 'highlight', 'screenshot', 'note', 'library', 'more']) assert.ok(reached.includes(action), `Tab reaches ${action}: ${reached}`);
  await web.keyboard.press('Escape'); await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  // Drag by the grip, then reload and summon again: the position is remembered.
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  const grip = await dock.evaluate(`__foundkeepDock.rect('.grip')`);
  await web.mouse.move(grip.x + 5, grip.y + 5); await web.mouse.down(); await web.mouse.move(300, 200, { steps: 8 }); await web.mouse.up();
  const moved = await dock.evaluate(`__foundkeepDock.position()`);
  assert.ok(moved.left < 400 && moved.top < 300, JSON.stringify(moved));
  // Arrow keys move 16px, Shift+Arrow 64px, Home resets.
  await dock.click('.grip'); await web.keyboard.press('ArrowRight');
  assert.equal((await dock.evaluate(`__foundkeepDock.position()`)).left, moved.left + 16);
  await web.keyboard.press('Shift+ArrowDown');
  assert.equal((await dock.evaluate(`__foundkeepDock.position()`)).top, moved.top + 64);
  await web.reload();
  await worker.evaluate(async id => { await chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/dock/dock.js'] }); await chrome.tabs.sendMessage(id, { kind: 'dock-show' }); }, tabId);
  const again = await dockWorld(web, extensionId); await again.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  const kept = await again.evaluate(`__foundkeepDock.position()`);
  assert.equal(kept.left, moved.left + 16); assert.equal(kept.top, moved.top + 64);
  await again.click('.pill'); await again.click('.grip'); await web.keyboard.press('Home');
  const reset = await again.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (reset.x + reset.width)), 16);
  // Resizing the window keeps the dock inside the viewport.
  await web.setViewportSize({ width: 500, height: 400 });
  const clamped = await again.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.ok(clamped.x >= 0 && clamped.x + clamped.width <= 500 && clamped.y + clamped.height <= 400, JSON.stringify(clamped));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/usr/bin/node --test tests/extension-dock-ui.mjs`
Expected: FAIL — `src/dock/dock.js` does not exist.

- [ ] **Step 3: Implement the dock**

Create `apps/extension/src/dock/dock.js` (classic script; keep the whole file self-contained):

```js
(() => {
  if (window.top !== window || window.__foundkeepDock) return;
  const EXT = new URL(chrome.runtime.getURL('')).origin;
  const POS_KEY = 'foundkeep-dock-position', EDGE = 16;
  const ICON = {
    grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
    mark: '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"/>',
    savepage: '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"/>',
    highlight: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    screenshot: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
    note: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    library: '<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  const CSS = `
    :host{all:initial}
    .dock{position:fixed;display:flex;align-items:center;gap:2px;padding:2px;background:#0f1011;color:#d6d8db;border:1px solid #1d1f22;border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,.35);font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;transition:opacity .15s ease}
    .dock[hidden],[hidden]{display:none!important}
    button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:36px;min-width:36px;padding:0 10px;border-radius:9px;cursor:pointer;color:inherit;white-space:nowrap}
    button:hover{background:#1a1b1e}
    button:focus-visible{outline:2px solid #4cc38a;outline-offset:1px}
    .grip{cursor:grab;padding:0;width:24px;justify-content:center;color:#8a8f98}
    .grip:active{cursor:grabbing}
    .pill{padding:0 10px}
    .status{padding:0 10px;color:#8a8f98;max-width:260px;overflow:hidden;text-overflow:ellipsis}
    .status[data-tone="ok"]{color:#4cc38a}.status[data-tone="error"]{color:#f28b82}
    .menu{position:absolute;bottom:44px;right:0;display:flex;flex-direction:column;min-width:220px;padding:4px;background:#0f1011;border:1px solid #1d1f22;border-radius:12px}
    .menu button{width:100%}
    .card{position:fixed;width:380px;border:0;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);background:transparent;color-scheme:normal}
    @media (prefers-reduced-motion:reduce){.dock{transition:none}}`;

  const host = document.createElement('foundkeep-dock');
  host.style.cssText = 'all:initial;position:fixed;inset:auto;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="dock" hidden role="toolbar" aria-label="FoundKeep">
      <button class="grip" aria-label="Move FoundKeep dock" aria-description="Drag or use arrow keys to move. Press Home to reset.">${svg('grip')}</button>
      <button class="pill" data-action="expand" aria-label="Open FoundKeep" aria-expanded="false">${svg('mark')}</button>
      <div class="actions" hidden>
        <button data-action="savepage">${svg('savepage')}Save page</button>
        <button data-action="highlight">${svg('highlight')}Highlight</button>
        <button data-action="screenshot" aria-haspopup="menu">${svg('screenshot')}Screenshot</button>
        <button data-action="note">${svg('note')}Note</button>
        <button data-action="library">${svg('library')}Library</button>
        <button data-action="more" aria-haspopup="menu" aria-label="More">${svg('more')}</button>
      </div>
      <button data-action="sign-in" hidden>Sign in to save</button>
      <span class="status" role="status" hidden></span>
      <div class="menu" data-menu="screenshot" role="menu" hidden>
        <button data-action="region" role="menuitem">Region</button><button data-action="fullpage" role="menuitem">Full page</button></div>
      <div class="menu" data-menu="more" role="menu" hidden>
        <button data-action="always-on" role="menuitem">Show on every site</button>
        <button data-action="site" role="menuitem">Hide on this site</button>
        <button data-action="import" role="menuitem">Import browser bookmarks</button>
        <button data-action="settings" role="menuitem">Settings ↗</button></div>
      <div class="local" hidden><span class="status"></span><button data-action="local-move">Move to My library</button><button data-action="local-later">Later</button></div>
    </div>`;
  const $ = selector => root.querySelector(selector);
  const dockEl = $('.dock');
  let mode = 'hidden', dockState = null, frame = null, readyTimer = 0, collapseTimer = 0;
  let pos = null; // {fx, fy} fractions of the viewport for the dock's top-left corner

  const send = message => chrome.runtime.sendMessage(message).catch(() => null);
  function render() {
    dockEl.hidden = mode === 'hidden';
    const open = mode === 'expanded' || mode === 'review';
    const connected = !!dockState?.connected;
    $('.actions').hidden = !open || !connected;
    $('[data-action="sign-in"]').hidden = !open || connected;
    $('.pill').setAttribute('aria-expanded', String(open));
    for (const [action, enabled] of Object.entries(dockState?.actions || {}))
      for (const button of root.querySelectorAll(`[data-action="${action}"]`)) button.hidden = !enabled;
    $('[data-action="screenshot"]').hidden = !(dockState?.actions?.region || dockState?.actions?.fullpage);
    $('[data-action="always-on"]').textContent = dockState?.alwaysOn ? 'Stop showing on every site' : 'Show on every site';
    $('[data-action="site"]').textContent = dockState?.hiddenHere ? 'Show on this site again' : 'Hide on this site';
    const local = root.querySelector('.local');
    local.hidden = !open || !connected || !(dockState?.localOnly > 0);
    local.querySelector('.status').textContent = `${dockState?.localOnly || 0} saves are only in this browser`;
    local.querySelector('.status').hidden = false;
    if (!open) closeMenus();
    place();
  }
  function closeMenus() { for (const menu of root.querySelectorAll('.menu')) menu.hidden = true; }
  function status(text, tone = '') {
    const el = $('.dock > .status'); el.hidden = !text; el.textContent = text; el.dataset.tone = tone;
  }
  function size() { const r = dockEl.getBoundingClientRect(); return { w: r.width || 48, h: r.height || 42 }; }
  function place() {
    if (dockEl.hidden) return;
    const { w, h } = size();
    let left = pos ? pos.fx * innerWidth : innerWidth - w - EDGE;
    let top = pos ? pos.fy * innerHeight : innerHeight - h - EDGE;
    left = Math.min(Math.max(0, left), Math.max(0, innerWidth - w));
    top = Math.min(Math.max(0, top), Math.max(0, innerHeight - h));
    dockEl.style.left = left + 'px'; dockEl.style.top = top + 'px';
    if (frame) placeCard();
  }
  function setPosition(left, top, persist = true) {
    pos = { fx: left / innerWidth, fy: top / innerHeight }; place();
    if (persist) void chrome.storage.local.set({ [POS_KEY]: pos });
  }
  function placeCard() {
    const d = dockEl.getBoundingClientRect(), h = Number(frame.dataset.height || 420);
    const height = Math.min(h, innerHeight - 24);
    const left = Math.min(Math.max(8, d.right - 380), innerWidth - 388);
    const above = d.top - height - 8;
    frame.style.left = left + 'px'; frame.style.height = height + 'px';
    frame.style.top = (above >= 8 ? above : Math.min(d.bottom + 8, innerHeight - height - 8)) + 'px';
  }
  function setMode(next) {
    clearTimeout(collapseTimer); mode = next; render();
    if (next === 'collapsed') $('.pill').focus({ preventScroll: true });
  }
  function openReview(url) {
    closeReview();
    frame = document.createElement('iframe');
    frame.className = 'card'; frame.src = url; frame.title = 'Review your FoundKeep save'; frame.dataset.height = '420';
    root.append(frame); setMode('review'); placeCard();
    readyTimer = setTimeout(() => { closeReview(); setMode('expanded'); void send({ kind: 'dock-review-fallback' }); }, 3000);
  }
  function closeReview() { clearTimeout(readyTimer); frame?.remove(); frame = null; }
  function finishReview(saved) {
    closeReview();
    if (saved) { setMode('expanded'); status('Saved', 'ok'); collapseTimer = setTimeout(() => { status(''); setMode('collapsed'); }, 4000); }
    else setMode('expanded');
  }

  // Trusted user input only: a page script cannot synthesize a save.
  root.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const button = event.target.closest?.('button[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'expand') return void setMode(mode === 'collapsed' ? 'expanded' : mode === 'review' ? 'review' : 'collapsed');
    if (action === 'screenshot' || action === 'more') {
      const menu = $(`[data-menu="${action}"]`); const open = menu.hidden; closeMenus(); menu.hidden = !open; return;
    }
    closeMenus(); status('');
    if (['savepage', 'highlight', 'region', 'fullpage', 'note'].includes(action)) return void send({ kind: 'dock-capture', action });
    if (['library', 'settings', 'import', 'sign-in'].includes(action)) return void send({ kind: 'dock-open', target: action });
    if (action === 'always-on') return void send({ kind: 'dock-always-on', enabled: !dockState?.alwaysOn });
    if (action === 'site') { const hiding = !dockState?.hiddenHere; return void send({ kind: 'dock-site', hidden: hiding }).then(() => { if (hiding) setMode('hidden'); }); }
    if (action === 'local-move' || action === 'local-later') return void send({ kind: 'dock-local', choice: action === 'local-move' ? 'move' : 'later' });
  });
  // Drag by the grip with pointer capture.
  const grip = $('.grip');
  grip.addEventListener('pointerdown', event => {
    if (!event.isTrusted || event.button !== 0) return;
    const start = dockEl.getBoundingClientRect(), dx = event.clientX - start.left, dy = event.clientY - start.top;
    grip.setPointerCapture(event.pointerId);
    const move = e => { if (e.isTrusted) setPosition(e.clientX - dx, e.clientY - dy, false); };
    const up = e => { grip.releasePointerCapture(e.pointerId); grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up);
      const r = dockEl.getBoundingClientRect(); setPosition(r.left, r.top); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('keydown', event => {
    if (!event.isTrusted) return;
    const step = event.shiftKey ? 64 : 16, r = dockEl.getBoundingClientRect();
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (delta) { event.preventDefault(); setPosition(r.left + delta[0], r.top + delta[1]); }
    if (event.key === 'Home') { event.preventDefault(); pos = null; void chrome.storage.local.remove(POS_KEY); place(); }
  });
  document.addEventListener('keydown', event => {
    if (event.isTrusted && event.key === 'Escape' && mode === 'expanded') setMode('collapsed');
  }, true);
  document.addEventListener('pointerdown', event => {
    if (event.isTrusted && mode === 'expanded' && !event.composedPath().includes(host)) setMode('collapsed');
  }, true);
  document.addEventListener('fullscreenchange', () => { host.style.display = document.fullscreenElement ? 'none' : ''; });
  addEventListener('resize', place);
  // Messages from the review card: only its own frame, from the extension origin.
  addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== EXT || !event.data?.foundkeepReview) return;
    const data = event.data;
    if (data.type === 'ready') clearTimeout(readyTimer);
    if (data.type === 'resize' && Number.isFinite(data.height)) { frame.dataset.height = String(Math.min(Math.max(160, data.height), 560)); placeCard(); }
    if (data.type === 'done') finishReview(data.saved === true);
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.kind === 'dock-ping') { respond({ ok: true }); return; }
    switch (message?.kind) {
      case 'dock-show': if (mode === 'hidden') setMode(message.expand ? 'expanded' : 'collapsed'); else if (message.expand && mode === 'collapsed') setMode('expanded'); break;
      case 'dock-collapse': if (mode === 'expanded') setMode('collapsed'); break;
      case 'dock-review-open': if (mode === 'hidden') setMode('expanded'); openReview(message.url); break;
      case 'dock-review-close': finishReview(message.saved === true); break;
      case 'dock-hide': host.style.visibility = 'hidden'; break;
      case 'dock-unhide': host.style.visibility = ''; break;
      case 'dock-status': if (mode === 'hidden') setMode('expanded'); status(message.text || '', message.tone || ''); break;
      case 'dock-state': dockState = message.state; render(); break;
    }
  });

  window.__foundkeepDock = {
    state: () => mode,
    rect: selector => { const r = root.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 }; },
    position: () => { const r = dockEl.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top) }; },
    focused: () => root.activeElement?.className || root.activeElement?.dataset?.action || null,
    visible: () => host.style.visibility !== 'hidden' && host.style.display !== 'none',
  };
  document.documentElement.append(host);
  void chrome.storage.local.get(POS_KEY).then(values => { pos = values[POS_KEY] || null; place(); });
  void send({ kind: 'dock-hello' }).then(state => { if (!state) return; dockState = state; if (state.show && mode === 'hidden') setMode('collapsed'); else render(); });
})();
```

Add `src/dock/dock.js` to `deploy/extension-files.json`.

Note for the test: until Task 4 the background does not answer `dock-hello`, so `dockState` is `null` and `connected` is false. For this UI test, make the test send `{kind:'dock-state', state:{connected:true, actions:{savepage:true,highlight:true,region:true,fullpage:true,note:true}, alwaysOn:false, hiddenHere:false, localOnly:0, show:false}}` right after `dock-show`.

- [ ] **Step 4: Run test to verify it passes**

Run: `/usr/bin/node --test tests/extension-dock-ui.mjs`
Expected: PASS. If `dockWorld` cannot find the isolated world, log the `Runtime.executionContextCreated` contexts once and adjust the matcher (the extension world's `name` is the extension name).

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/dock/dock.js deploy/extension-files.json tests/helpers/dock-world.mjs tests/extension-dock-ui.mjs
git commit -m "feat(extension): floating dock content script"
```

---

### Task 4: Background dock control and every capture path

**Files:**
- Create: `apps/extension/src/dock-control.js`
- Modify: `apps/extension/src/background.js` (action click, context menus, commands, X save, message router, capture hiding)
- Modify: `apps/extension/manifest.json` (`web_accessible_resources`; `src/dock/dock.js` on the x.com content script)
- Test: `tests/extension-dock-flow.mjs` (new)

**Interfaces:**
- Consumes: Task 1 save-review API, Task 2 review page and `postMessage` contract, Task 3 dock messages.
- Produces (exported from `dock-control.js`):
  - `summonDock(tabId: number, {expand?: boolean}): Promise<boolean>` — injects `src/dock/dock.js` if needed, sends `dock-state` and `dock-show`; `false` if the tab cannot be scripted.
  - `openReview(tab: chrome.tabs.Tab): Promise<void>` — summons the dock and sends `dock-review-open` with `chrome.runtime.getURL('src/review.html?tab=' + tab.id)`.
  - `dockState(tab): Promise<DockState>`
  - `handleDockMessage(msg, sender): Promise<object>` — only called for `dock-*` kinds.
  - `withDockHidden(tabId, run): Promise<T>` — sends `dock-hide`, runs, always sends `dock-unhide`.
  - `openFallbackReview(tabId): Promise<void>` — 380×560 popup window with `review.html?tab=<id>&window=1`.
  - `dashboardUrl(path: string): string` — `CUSTOMER_ORIGIN + path` from `product.js`.

- [ ] **Step 1: Write the failing test**

`tests/extension-dock-flow.mjs` covers: summon (from an extension page, because tests cannot click the toolbar), savepage end to end into the account queue, review in the dock iframe, the Saved state and auto-collapse, the X button, strict CSP fallback, reload mid-review, SPA navigation, and a restricted page. Use the signed-in fixture from Task 2 plus these routes:

```js
await context.route('**/api/organization', r => r.fulfill({ json: { folders: [], tags: [], suggestedTags: [] } }));
await context.route('**/api/collections', r => r.fulfill({ json: { collections: [] } }));
await context.route(origin + '/__flow', r => r.fulfill({ contentType: 'text/html', body: '<title>Flow fixture</title><p>Readable paragraph worth keeping.</p><script>history.pushState({}, "", "/__flow?step=2")</script>' }));
await context.route(origin + '/__strict', r => r.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': "frame-src 'none'; default-src 'self'" }, body: '<title>Strict fixture</title><p>Strict page</p>' }));
```

Summon helper used in the test (runs in an extension page; `dock-control.js` is a plain module and works outside the worker):

```js
const summon = (ext, url) => ext.evaluate(async url => {
  const [tab] = await chrome.tabs.query({ url }); return (await import('./dock-control.js')).summonDock(tab.id, { expand: true });
}, url);
```

Assertions (each as its own `t.test` step):
1. `summon(ext, origin + '/__flow*')` → `true`; the dock is `expanded`; clicking `[data-action="savepage"]` (trusted, via `dockWorld.click`) opens a frame whose URL starts with `chrome-extension://` and contains `review.html?tab=`; in that frame (`web.frames().find(f => f.url().includes('review.html'))`) `#saveDestination` has only `library`; fill `#destinationPersonalTitle`, click `#destinationConfirm`; the dock status reads `Saved`; `db.listCaptures()` (from an extension page) has one `bookmark` row with `cloudAccountId === 'account-a'` and `sourceUrl` ending `/__flow?step=2` (the SPA URL); within 5 s the dock is `collapsed`.
2. Reload mid-review: start `note`, type into `#reviewNote`, wait for the draft's `form.note` in `chrome.storage.session`, `web.reload()`, summon again, and the card reopens with the same note text (the background's `dock-hello` handler calls `openReview` when the tab has a pending draft).
3. X button: route `https://x.com/**` with the fixture from `tests/extension-destination.mjs`, click the tweet's FoundKeep button, and the dock appears on x.com with the review card open (dock injected by the static content script entry).
4. Strict CSP page: summon on `/__strict`, click `note`; either the frame reports ready, or within 4 s a new popup window with `review.html?tab=` and `&window=1` exists (`context.pages()`). Confirming in the popup saves and closes it.
5. Restricted page: `summonDock` for a `chrome://version` tab returns `false`.
6. Screenshot hiding: route `**/api/**` as above, click `screenshot` → `fullpage`, confirm in the card, and poll `__foundkeepDock.visible()` every 50 ms until the save finishes; it must be `false` at least once during the capture and `true` afterwards.
7. Capture without a grant: with `activeTab` unavailable (navigate the fixture tab to `https://example.org/` routed locally so there is no host permission), dock `region` → status text `Click the FoundKeep icon on this page to allow capture.`

- [ ] **Step 2: Run test to verify it fails**

Run: `/usr/bin/node --test tests/extension-dock-flow.mjs`
Expected: FAIL — `dock-control.js` does not exist.

- [ ] **Step 3: Implement `dock-control.js`**

```js
import { CUSTOMER_ORIGIN } from './product.js';
import { readSaveReview, stageSaveReview } from './save-review.js';
import { getCloudStatus } from './cloud.js';
import { getEffectivePreferences } from './preferences.js';

const HIDDEN_KEY = 'foundkeep-dock-hidden-origins', ALWAYS_KEY = 'foundkeep-dock-always-on', LOCAL_KEY = 'foundkeep-dock-local-prompt';
const DOCK_FILE = 'src/dock/dock.js';
export const dashboardUrl = path => CUSTOMER_ORIGIN + path;
const scriptable = url => /^https?:\/\//i.test(url || '') && !/^https:\/\/chromewebstore\.google\.com\//.test(url) && !/^https:\/\/chrome\.google\.com\/webstore/.test(url);
const originOf = url => { try { return new URL(url).origin; } catch { return null; } };

export async function dockState(tab) {
  const [{ preferences }, cloud, stored] = await Promise.all([getEffectivePreferences(), getCloudStatus(), chrome.storage.local.get([HIDDEN_KEY, ALWAYS_KEY, LOCAL_KEY])]);
  const hidden = stored[HIDDEN_KEY] || [], origin = originOf(tab?.url);
  const hiddenHere = !!origin && hidden.includes(origin), alwaysOn = stored[ALWAYS_KEY] === true;
  const later = stored[LOCAL_KEY]?.laterUntil || 0;
  const c = preferences.capture;
  return {
    connected: cloud.status === 'connected' && !!cloud.account?.id,
    actions: { savepage: c.bookmark, highlight: c.highlight, region: c.region, fullpage: c.fullPage, note: c.note },
    alwaysOn, hiddenHere, localOnly: Date.now() < later ? 0 : cloud.localOnly || 0, show: alwaysOn && !hiddenHere,
  };
}
// A dock that is already there answers a ping; this works on x.com and on
// always-on pages, where the extension may lack a scripting grant.
const hasDock = tabId => chrome.tabs.sendMessage(tabId, { kind: 'dock-ping' }).then(r => r?.ok === true, () => false);
export async function summonDock(tabId, { expand = false } = {}) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !scriptable(tab.url)) return false;
  if (!await hasDock(tabId)) {
    try { await chrome.scripting.executeScript({ target: { tabId }, files: [DOCK_FILE] }); }
    catch { return false; }
  }
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-state', state: await dockState(tab) }).catch(() => {});
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-show', expand }).catch(() => {});
  return true;
}
export async function openReview(tab) {
  if (!await summonDock(tab.id, { expand: true })) return openFallbackReview(tab.id);
  await chrome.tabs.sendMessage(tab.id, { kind: 'dock-review-open', url: chrome.runtime.getURL('src/review.html?tab=' + tab.id) });
}
const popups = new Map(); // popup tab id -> reviewed tab id
export async function openFallbackReview(tabId) {
  const win = await chrome.windows.create({ url: chrome.runtime.getURL(`src/review.html?tab=${tabId}&window=1`), type: 'popup', width: 380, height: 560, focused: true });
  const popupTab = win.tabs?.[0]; if (popupTab) popups.set(popupTab.id, tabId);
}
export function reviewTabFor(sender) {
  // A framed card must belong to the tab it sits in; a popup must be one we opened.
  const url = new URL(sender.url), tab = Number(url.searchParams.get('tab'));
  if (!Number.isInteger(tab)) return null;
  if (url.searchParams.get('window') === '1') return popups.get(sender.tab?.id) === tab ? tab : null;
  return sender.tab?.id === tab ? tab : null;
}
export async function withDockHidden(tabId, run) {
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-hide' }).catch(() => {});
  try { return await run(); } finally { await chrome.tabs.sendMessage(tabId, { kind: 'dock-unhide' }).catch(() => {}); }
}
async function refreshState(tab) { await chrome.tabs.sendMessage(tab.id, { kind: 'dock-state', state: await dockState(tab) }).catch(() => {}); }
export async function startCapture(tab, action, extra = {}) {
  try { await stageSaveReview({ action, tab, trigger: 'dock', ...extra }); await openReview(tab); }
  catch (error) {
    if (!await summonDock(tab.id, { expand: true })) throw error;
    await chrome.tabs.sendMessage(tab.id, { kind: 'dock-status', text: error.message, tone: 'error' }).catch(() => {});
  }
}
export async function handleDockMessage(msg, sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || sender.url?.startsWith(chrome.runtime.getURL(''))) return { ok: false };
  const tab = sender.tab;
  switch (msg.kind) {
    case 'dock-hello': {
      const state = await dockState(tab);
      if (await readSaveReview(tab.id)) void openReview(tab);
      return state;
    }
    case 'dock-capture': {
      if (!['savepage', 'highlight', 'region', 'fullpage', 'note'].includes(msg.action)) return { ok: false };
      const { preferences } = await getEffectivePreferences();
      const extra = msg.action === 'note' ? { text: '', attachPage: preferences.notes.attachSource } : {};
      await startCapture(tab, msg.action, extra); return { ok: true };
    }
    case 'dock-open': {
      const target = { library: dashboardUrl('/dashboard'), settings: dashboardUrl('/dashboard/settings'), 'sign-in': dashboardUrl('/login'), import: chrome.runtime.getURL('src/import.html') }[msg.target];
      if (!target) return { ok: false };
      await chrome.tabs.create({ url: target, index: tab.index + 1 }); return { ok: true };
    }
    case 'dock-site': {
      const origin = originOf(tab.url); if (!origin) return { ok: false };
      const list = new Set((await chrome.storage.local.get(HIDDEN_KEY))[HIDDEN_KEY] || []);
      msg.hidden ? list.add(origin) : list.delete(origin);
      await chrome.storage.local.set({ [HIDDEN_KEY]: [...list] }); await refreshState(tab); return { ok: true };
    }
    case 'dock-review-fallback': if (await readSaveReview(tab.id)) await openFallbackReview(tab.id); return { ok: true };
    default: return { ok: false };
  }
}
```

(`dock-always-on` and `dock-local` are added in Tasks 5 and 6; until then they return `{ ok:false }`.)

In `background.js`:
- Remove `chrome.sidePanel.setPanelBehavior(...)` and add:

```js
chrome.action.onClicked.addListener(tab => {
  void summonDock(tab.id, { expand: true }).then(async shown => {
    if (!shown) await chrome.tabs.create({ url: dashboardUrl('/dashboard'), index: tab.index + 1 });
  });
});
```

- Replace `openReviewPanel(tab)` + `stageSaveReview(...)` in the context-menu, command and `saveTweet` handlers with `startCapture(tab, action, extra)` (context menu: `action = info.menuItemId`, `extra = { info, trigger: 'context' }`; command: `{ trigger: 'keyboard' }`; tweet: `startCapture(sender.tab, 'tweet', { tweet: {...}, trigger: 'twitter' })`, respond `{ ok:true, pending:true }`). Keep `configuredFlash(false, error.message)` in the catch.
- In the message listener, first lines (the kind check must be synchronous; `handleDockMessage` is async):

```js
if (typeof msg?.kind === 'string' && msg.kind.startsWith('dock-')) {
  handleDockMessage(msg, sender).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
}
```
- For `save-review-*` from `review.html`, derive the tab with `reviewTabFor(sender)` and reject when it is `null` or differs from `msg.tabId`.
- In `performCapture`, wrap the `region` and `fullpage` cases: `return withDockHidden(tab.id, () => regionScreenshot(tab, captureMethod, limits, commit));` (same for `fullPageScreenshot`).
- When a capture fails because the tab is not scriptable (`chrome.scripting.executeScript` / `captureVisibleTab` rejection mentioning permission, "Cannot access", or "activeTab"), throw `new Error('Click the FoundKeep icon on this page to allow capture.')` from `assertCaptureTab` / the capture helpers so the review card shows it.

In `manifest.json`:

```json
"web_accessible_resources": [{
  "resources": ["src/review.html"],
  "matches": ["http://*/*", "https://*/*"],
  "use_dynamic_url": true
}]
```

(Subresources the framed page loads come from its own extension origin and should not need listing; if any fail to load in the frame, add exactly those files.) Then change the x.com content script entry to `"js": ["src/twitter.js", "src/dock/dock.js"]` (the dock stays hidden there until summoned or a tweet review opens). Add `src/dock-control.js` to `deploy/extension-files.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `/usr/bin/node --test tests/extension-dock-flow.mjs tests/extension-dock-ui.mjs tests/extension-review.mjs`
Expected: PASS. If step 4 of the test shows the iframe loading on the strict-CSP page, keep the assertion that accepts either path and note the result in the commit message (it answers spec risk 1).

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/dock-control.js apps/extension/src/background.js apps/extension/manifest.json deploy/extension-files.json tests/extension-dock-flow.mjs
git commit -m "feat(extension): route every capture through the floating dock"
```

---

### Task 5: Show on every site, and hide on this site

**Files:**
- Create: `apps/extension/src/dock-settings.html`, `apps/extension/src/dock-settings.js`
- Modify: `apps/extension/src/dock-control.js` (always-on registration), `apps/extension/src/background.js` (startup reconcile, permission removal)
- Modify: `deploy/extension-files.json`
- Test: `tests/extension-dock-always-on.mjs` (new)

**Interfaces:**
- Produces:
  - `applyAlwaysOn(enabled: boolean): Promise<boolean>` — registers or unregisters content script id `foundkeep-dock` (`matches: ['http://*/*','https://*/*']`, `js: ['src/dock/dock.js']`, `runAt: 'document_idle'`, `allFrames: false`, `persistAcrossSessions: true`) and stores `foundkeep-dock-always-on`. Returns the stored value. Enabling without the `<all_urls>` permission returns `false` and stores `false`.
  - `reconcileAlwaysOn(): Promise<void>` — on `runtime.onStartup` / `onInstalled` and `permissions.onRemoved`.
  - `dock-always-on {enabled:true}` from the dock opens `dock-settings.html` in a 380×320 popup window (content scripts cannot request permissions); `{enabled:false}` calls `applyAlwaysOn(false)` directly.

- [ ] **Step 1: Write the failing test**

`tests/extension-dock-always-on.mjs`:
1. From an extension page: `(await import('./dock-control.js')).applyAlwaysOn(true)` → returns `true` in the test profile only if `chrome.permissions.contains({origins:['<all_urls>']})`; in the default test profile it is not granted, so first assert it returns `false`.
2. Open `dock-settings.html`, stub `chrome.permissions.request = async () => true` and `chrome.permissions.contains = async () => true` in that page, click `#enable`, and assert `chrome.scripting.getRegisteredContentScripts()` (from the worker) lists `foundkeep-dock`.
3. Open a new fixture page on the host-permitted origin: the dock appears **collapsed** without summoning (`dockWorld` state `collapsed`).
4. Click `more` → `site` (Hide on this site): the dock disappears; reload: no dock (`__foundkeepDock.state()` is `hidden` or the world never renders it — assert `state() === 'hidden'`).
5. Summon on that page: the dock shows and the menu offers `Show on this site again`.
6. From the dock menu choose `Stop showing on every site`: `getRegisteredContentScripts()` no longer lists it.

- [ ] **Step 2: Run test to verify it fails**

Run: `/usr/bin/node --test tests/extension-dock-always-on.mjs`
Expected: FAIL — `applyAlwaysOn` is not exported.

- [ ] **Step 3: Implement**

Add to `dock-control.js`:

```js
const REGISTRATION = { id: 'foundkeep-dock', matches: ['http://*/*', 'https://*/*'], js: [DOCK_FILE], runAt: 'document_idle', allFrames: false, persistAcrossSessions: true };
export async function applyAlwaysOn(enabled) {
  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  const on = enabled && granted;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [REGISTRATION.id] });
  if (on && !existing.length) await chrome.scripting.registerContentScripts([REGISTRATION]);
  if (!on && existing.length) await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION.id] });
  await chrome.storage.local.set({ [ALWAYS_KEY]: on });
  return on;
}
export async function reconcileAlwaysOn() {
  await applyAlwaysOn((await chrome.storage.local.get(ALWAYS_KEY))[ALWAYS_KEY] === true);
}
```

and in `handleDockMessage`:

```js
case 'dock-always-on': {
  if (msg.enabled === true) { await chrome.windows.create({ url: chrome.runtime.getURL('src/dock-settings.html'), type: 'popup', width: 380, height: 320, focused: true }); return { ok: true }; }
  await applyAlwaysOn(false); await refreshState(tab); return { ok: true };
}
```

In `dockState`, the hidden-origin rule already returns `show:false`; also make `dock.js` skip auto-show when `state.hiddenHere` (it already does via `show`).

`dock-settings.html` — a small extension page: a heading "Show FoundKeep on every site", one paragraph ("Chrome will ask to let FoundKeep read and change data on all sites. FoundKeep only uses this to show the dock and capture pages you choose."), a primary button `#enable` ("Allow and turn on") and `#cancel`. `dock-settings.js`:

```js
import { applyAlwaysOn } from './dock-control.js';
document.getElementById('enable').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
  const on = granted && await applyAlwaysOn(true);
  document.getElementById('result').textContent = on ? 'The dock now appears on every site. You can hide it per site from its menu.' : 'Permission was not granted. The dock still appears when you click the FoundKeep icon.';
  if (on) setTimeout(() => window.close(), 1500);
});
document.getElementById('cancel').addEventListener('click', () => window.close());
```

In `background.js`: `chrome.runtime.onStartup.addListener(() => void reconcileAlwaysOn());`, call it inside the existing `onInstalled` handler, and `chrome.permissions.onRemoved.addListener(() => void reconcileAlwaysOn());`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `/usr/bin/node --test tests/extension-dock-always-on.mjs tests/extension-dock-flow.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/dock-settings.* apps/extension/src/dock-control.js apps/extension/src/background.js deploy/extension-files.json tests/extension-dock-always-on.mjs
git commit -m "feat(extension): opt-in dock on every site with per-site hiding"
```

---

### Task 6: Account-only saving, local-save migration and the import page

**Files:**
- Create: `apps/extension/src/import.html`, `apps/extension/src/import.js`
- Modify: `apps/extension/src/dock-control.js` (`dock-local`), `apps/extension/src/background.js` (external `atlas-open-import`)
- Modify: `apps/site/components/dashboard/devices.tsx` (Import from this browser)
- Modify: `deploy/extension-files.json`
- Test: `tests/extension-dock-account.mjs` (new), `tests/customer-web.mjs` (dashboard link)

**Interfaces:**
- Consumes: `importLocalCaptures({confirmed:true, accountId})` and `getCloudStatus()` from `cloud.js`; the side panel's import dialog markup in `library.html` (`#importDialog`) and its binder (find it with `grep -n "importDialog" apps/extension/src/*.js`).
- Produces: `dock-local {choice:'move'|'later'}`; external message `{kind:'atlas-open-import'}` accepted only from `trustedPairingSender(sender)`, which opens `src/import.html` in a new tab.

- [ ] **Step 1: Write the failing test**

`tests/extension-dock-account.mjs`:
1. Signed out: summon → expanded dock shows only `[data-action="sign-in"]`; clicking it opens a tab at `<CUSTOMER_ORIGIN>/login`.
2. Seed one local-only capture (`import('./db.js').then(db => db.addCapture({ type:'note', noteText:'old local', createdAt:Date.now() }))` from an extension page), sign in with the fixture account, summon → the dock shows `1 saves are only in this browser`; click `local-later` → the prompt disappears and `foundkeep-dock-local-prompt.laterUntil` is about 7 days ahead; set `laterUntil` to 0, re-summon, click `local-move` → `db.listCaptures()` row has `cloudAccountId === 'account-a'` and the prompt is gone.
3. Dock menu → `import` opens `src/import.html`; the page shows the "Bring your collection." heading and its import button requests the `bookmarks` permission (stub `chrome.permissions.request` in the page and assert it was called with `{permissions:['bookmarks']}`).
4. External: from a `https://foundkeep.app/__ext` fixture page, `chrome.runtime.sendMessage(extensionId, {kind:'atlas-open-import'})` opens `import.html`.

- [ ] **Step 2: Run test to verify it fails**

Run: `/usr/bin/node --test tests/extension-dock-account.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `dock-control.js`:

```js
case 'dock-local': {
  const cloud = await getCloudStatus();
  if (msg.choice === 'later') await chrome.storage.local.set({ [LOCAL_KEY]: { laterUntil: Date.now() + 7 * 86_400_000 } });
  else if (msg.choice === 'move' && cloud.account?.id) { await importLocalCaptures({ confirmed: true, accountId: cloud.account.id }); void drainQueue(); }
  else return { ok: false };
  await refreshState(tab); return { ok: true };
}
```

(import `importLocalCaptures` from `./cloud.js` and `drainQueue` from `./capture.js`.)

`import.html` / `import.js`: move the `#importDialog` markup from `library.html` into the body of a standalone page (same element ids) and call the existing import binder from `import.js`. The binder already sends `bookmark-import-*` messages that `trustedLibrarySender` accepts for `import.html` (Task 1).

In `background.js`, in `chrome.runtime.onMessageExternal` before `handleExternalMessage`:

```js
if (msg?.kind === 'atlas-open-import') {
  if (!trustedPairingSender(sender)) { respond({ ok: false, error: 'This page cannot open FoundKeep import.' }); return; }
  void chrome.tabs.create({ url: chrome.runtime.getURL('src/import.html') }).then(() => respond({ ok: true }));
  return true;
}
```

In `apps/site/components/dashboard/devices.tsx`, where the extension is shown as installed (it already calls `extensionMessage({ kind: 'atlas-ping' }, id)`), add a secondary button "Import from this browser" that calls `extensionMessage({ kind: 'atlas-open-import' }, extensionId)` and shows the returned error text on failure. Add to `tests/customer-web.mjs` an assertion that the devices page source contains `atlas-open-import`.

Add `src/import.html`, `src/import.js` to `deploy/extension-files.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `/usr/bin/node --test tests/extension-dock-account.mjs tests/customer-web.mjs` and `cd apps/site && ~/.bun/bin/bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/import.* apps/extension/src/dock-control.js apps/extension/src/background.js apps/site/components/dashboard/devices.tsx deploy/extension-files.json tests/extension-dock-account.mjs tests/customer-web.mjs
git commit -m "feat(extension): account-only saves, local-save move prompt and import page"
```

---

### Task 7: Remove the side panel and the local library

**Files:**
- Modify: `apps/extension/manifest.json` (remove `side_panel`, `sidePanel`), `apps/extension/src/background.js` (remove `openReviewPanel`, side-panel messages `prepare-save`/`prepare-legacy-save`/`capture` with `source:'sidebar'`, `saveNote` from the sidebar)
- Delete: `apps/extension/src/library.html`, `library.js`, `library.css`, `sidebar-capture.js`, `sidebar-destination.js`, `sidebar-local.js`; and the extension's local library `dashboard.html`, `dashboard.js`, `dashboard.css` plus `popup.html`, `popup.js`, `popup.css`, `legacy-review.js` **only if** `grep -rn` shows nothing outside them and the deleted files still references them.
- Modify: `apps/extension/src/library-api.js` (trusted pages: `review.html`, `import.html`, `dock-settings.html`), `deploy/extension-files.json`, `deploy/STORE_LISTING.md` (permission justifications)
- Delete or rewrite tests: `tests/extension-action.mjs`, `tests/extension-destination.mjs`, `tests/extension-library.mjs`, `tests/helpers/action-panel.mjs`, the side-panel parts of `tests/extension-environments-browser.mjs`, `tests/customer-flow.mjs`, `tests/next-extension-autoconnect.mjs`, `tests/extension-store.mjs`, `tests/library-api.mjs`; update the `test:extension` list in `package.json`.

**Interfaces:**
- Consumes: everything from Tasks 1–6. After this task no code path calls `chrome.sidePanel`.

- [ ] **Step 1: Write the failing test**

In `tests/extension-store.mjs`, replace the side-panel assertions with:

```js
assert.equal(manifest.side_panel, undefined);
assert.equal(manifest.permissions.includes('sidePanel'), false);
assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'contextMenus', 'storage', 'alarms']);
assert.ok(manifest.web_accessible_resources[0].resources.includes('src/review.html'));
assert.equal(manifest.web_accessible_resources[0].use_dynamic_url, true);
const shipped = JSON.parse(await readFile('deploy/extension-files.json', 'utf8'));
for (const gone of ['src/library.html', 'src/sidebar-destination.js', 'src/sidebar-local.js']) assert.equal(shipped.includes(gone), false, gone);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/usr/bin/node --test tests/extension-store.mjs`
Expected: FAIL — the manifest still declares the side panel.

- [ ] **Step 3: Remove**

Delete the files and manifest entries listed above. Before deleting each extra page (`dashboard.*`, `popup.*`, `legacy-review.js`), run `grep -rn "<name>" apps/extension/src deploy tests apps/site | grep -v "^apps/extension/src/<name>"` and delete it only when nothing else uses it. Rewrite tests that used `actionPanel` or `popup.html` as a launcher to open `src/review.html` or `src/dock-settings.html` as the extension-page context instead. Port any still-relevant assertion from `extension-destination.mjs` (draft survives a worker restart; a different account cannot confirm an outstanding draft) into `tests/extension-review.mjs` using `tabId`. Update `STORE_LISTING.md`: delete the `sidePanel` justification; describe `activeTab` + `scripting` as "shows the FoundKeep dock on the page you choose and captures it"; describe the optional host permissions as "only when you turn on Show on every site".

- [ ] **Step 4: Run the full extension suite**

Add the new test files to the `test:extension` script in `package.json`, then run:
`bash -c '/usr/bin/node --test $(python3 -c "import json;print(json.load(open(\"package.json\"))[\"scripts\"][\"test:extension\"].replace(\"node --test \",\"\"))")'`
Expected: PASS (0 failures).

- [ ] **Step 5: Commit**

```bash
git add -A apps/extension deploy tests package.json
git commit -m "feat(extension)!: remove the side panel and local library in favor of the dock"
```

---

### Task 8: Version, dev build, and verification on real sites

**Files:**
- Modify: `apps/extension/manifest.json` (`version: "1.8.0"`)
- Modify: `docs/launch/roadmap.json` (P5.16 note), regenerate with `/usr/bin/node scripts/launch-dashboard.mjs`
- Create: `docs/beta/2026-09-27-extension-floating-dock.md` (what changed, how to test, screenshots)

- [ ] **Step 1: Build the dev extension**

Run: `bun run extension:build:dev` (or `/usr/bin/node deploy/build-extension.mjs --environment dev`)
Expected: a Foundkeep Dev build pointed at `https://dev.foundkeep.app`, output path printed.

- [ ] **Step 2: Verify on real sites in headed Chromium**

With the dev build loaded (`FOUNDKEEP_HEADLESS=false`), check and screenshot the dock collapsed, expanded and in review on github.com, x.com, youtube.com and a Notion page. Record whether the review iframe loaded on each (spec risk 1) and whether any site's styles leaked into the dock (risk 3). Save screenshots under `docs/beta/dock/`.

- [ ] **Step 3: Write the beta note and update the roadmap**

`docs/beta/2026-09-27-extension-floating-dock.md`: the user-visible change, the per-site results table from Step 2, the test commands and counts, and install steps for the dev build. In `docs/launch/roadmap.json` set P5.16's note to the verification result (keep `status: "doing"` until it ships to friends), then regenerate the dashboard.

- [ ] **Step 4: Run every suite**

Run: the extension suite from Task 7 Step 4, `cd apps/backend && ATLAS_DATA_DIR=$(mktemp -d) ~/.bun/bin/bun test`, and `cd apps/site && ~/.bun/bin/bunx tsc --noEmit`.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/manifest.json docs/beta docs/launch
git commit -m "chore(extension): 1.8.0 floating dock, verified on dev"
```

Shipping to friends (`ext-v1.8.0` GitHub release) and the Chrome Web Store 1.0.3 kit are separate steps that need Pritam's go-ahead after he tries the dev build.

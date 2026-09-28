# Instant saves and "Add details" — 2026-09-28

Extension **1.8.1**. Built and verified locally (dev build); not released to
friends or the Chrome Web Store yet.

1.8.0 moved the extension into an on-page dock, but every action — dock
buttons, the right-click menu, keyboard shortcuts and the X button — still
opened a review card asking where and how to save first. That step is gone.
Every action now saves straight to **My library** in the connected account,
and details are optional afterwards. An account is still required: a
signed-out dock only offers **Sign in to save**.

## What changed

- **Save page** saves in one click, with the page's details captured
  automatically: URL, title, site, description, author and dates, headings
  and readable text.
- **Highlight** saves selected text at once. With nothing selected it turns
  on highlighter mode — the dock shows `Select text to save · Esc to stop`,
  and every selection you make is saved and briefly flashed (drawn in the
  dock's own layer for under a second; the page is never marked). Esc or
  Highlight again turns it off.
- **Screenshot** goes straight to region selection. A small toolbar pinned to
  the tab's top-right corner offers **Selection** (active) · **Full page** ·
  **✕**. Drag to save a region, click Full page to save the whole page, or ✕ /
  Esc to cancel (`Selection cancelled.`). The dock hides during the capture.
  Screenshots now also store the page's URL, title, site, description,
  headings and readable text, so they are findable like saved pages.
- **Note** opens a small field in the dock: Enter saves, Shift+Enter adds a
  line, Esc closes it. The page is attached as before (notes preference).
- **Right-click items, keyboard shortcuts and the X button** save directly.
  `Alt+Shift+S` and `Alt+Shift+F` both open the screenshot corner toolbar;
  the right-click "Full-page screenshot" item captures the page directly. A
  right-click image save asks for the image site's permission inside that
  click (declining saves nothing).
- **After every save** the dock shows `✓ Saved to My library · Add details`
  for about five seconds; hovering or focusing it keeps it. **Add details**
  opens the old review card in an edit mode, pre-filled from the save: title,
  note, tags, folder (or a new one), and **Share to a collection**. The edits
  apply to the save just made:
  - not uploaded yet — the local record is updated and the pending upload
    carries the details;
  - already uploaded — the change is sent as an update to that capture
    (`PUT /api/mobile/captures/<remote id>`), and a share as a collection
    entry, and mirrored locally;
  - uploading right now — each edit bumps a details revision on the record;
    when the upload lands, any newer revision is sent as an update. A record
    with unsent details stays in the durable outbox, so no edit is lost to a
    service-worker restart or a dropped connection.
- **X button** now shows the FoundKeep mark (the bookmark with the folded
  corner and dot) as a thin outline at X's own icon size, and turns emerald
  once saved. Its label says "Save to FoundKeep" / "Saved to FoundKeep". Dev
  builds no longer add "Dev" text or widen the button; they show a small
  emerald dot on the icon instead.
- **Removed:** the before-save review, its per-tab drafts
  (`save-review.js`, the `save-review-*` messages, reopening a draft when a
  page reloads) and the fallback popup window with its nonce map.

## Security notes

- The details card is still an extension-origin page framed by the dock. It
  can only read and edit the one save the background granted it — a
  one-time grant bound to that save **and** that tab, minted when you click
  Add details and revoked when the card closes or the tab does. A page that
  frames the card itself, another tab, or a top-level tab at the card's URL
  gets nothing, and the page never sees the card's messages.
- The dock still never touches `chrome.storage` and ignores untrusted
  (page-synthesized) events; the screenshot toolbar and highlighter only act
  on trusted input.
- One trade-off to know: the note field now lives in the dock (the page's DOM,
  closed shadow root) rather than in the extension frame. Its key events are
  stopped at the dock so page shortcuts don't fire while typing, but a page
  listening to every key in the capture phase could still observe typing.

## How to test

1. Build the dev extension (`node deploy/build-extension.mjs --environment dev`)
   and reload **FoundKeep Dev** at `chrome://extensions`; refresh open x.com tabs.
2. On an article, click the toolbar icon, then **Save page**. Expect the
   `✓ Saved to My library · Add details` widget, and the save in the dev
   dashboard with readable text.
3. **Add details** → change the title, add a note and a tag, pick a folder →
   **Save details**. The dashboard shows the edits (try it once right after
   saving and once after the save has synced).
4. **Highlight** with and without a selection; in highlighter mode select two
   passages, then press Esc.
5. **Screenshot** → drag a region; again → **Full page**; again → **✕**.
6. **Note** → type, Shift+Enter, type, Enter.
7. Right-click a selection and an image; press `Alt+Shift+S`.
8. On x.com, click the FoundKeep mark on a post.

Automated coverage: `tests/extension-dock-flow.mjs`,
`tests/extension-dock-screenshot.mjs`, `tests/extension-dock-x.mjs`,
`tests/extension-review.mjs` (the details card) and
`tests/extension-details-tabs.mjs`.

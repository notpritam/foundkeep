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
- **Note** opens a small field next to the dock: Enter saves, Shift+Enter
  adds a line, Esc closes it. The page is attached as before (notes
  preference). The field is an extension frame (`note.html`), so the page
  cannot read what you type. A double or held Enter saves once.
- **Right-click items, keyboard shortcuts and the X button** save directly.
  `Alt+Shift+S` and `Alt+Shift+F` both open the screenshot corner toolbar;
  the right-click "Full-page screenshot" item captures the page directly.
  Pressing a screenshot shortcut again while a selection is open does not
  stack a second one. A right-click image save asks for the image site's
  permission inside that click (declining saves nothing); if Chrome cannot
  show that prompt there, a small FoundKeep window asks instead and finishes
  the save once you allow it.
- **After every save** the dock shows `✓ Saved to My library · Add details`
  for about five seconds; hovering or focusing it keeps it. **Add details**
  opens the old review card in an edit mode, pre-filled from the save: title,
  note, tags, folder (or a new one), and **Share to a collection**. The edits
  apply to the save just made:
  - not uploaded yet — the local record is updated and the pending upload
    carries the details;
  - already uploaded — the card starts from the server's current copy, and
    only the fields you changed are sent as an update to that capture
    (`PUT /api/mobile/captures/<remote id>`); title and note you did not
    touch repeat the server's current values, and folder and tags you did not
    touch are left out. If the server copy changes during the update
    (`capture_changed`), it is re-read and only your changes are re-applied.
    A share goes out as a collection entry. The local copy mirrors the result;
  - uploading right now — each edit bumps a details revision on the record
    and records which fields changed. When the upload lands, any edit it did
    not carry is sent as an update. An upload the server answers as a
    duplicate (an earlier attempt already committed) is not counted as
    carrying anything, so the edit still goes out.
  - A record with unsent details stays queued in the extension's outbox and
    is retried on the usual schedule (while the browser keeps this profile's
    extension storage). A permanent server refusal — for example a folder
    deleted meanwhile — marks the save as failed with that message rather
    than retrying forever.
- **X button** now shows the FoundKeep mark (the bookmark with the folded
  corner and dot) as a thin outline at X's own icon size, and turns emerald
  once saved. Its label says "Save to FoundKeep" / "Saved to FoundKeep", and
  on failure a generic "Couldn't save to FoundKeep" (the reason is shown in
  the dock, never written into x.com's page). A post already saved this
  browser session is recognized when X re-renders it, not saved twice. Dev
  builds no longer add "Dev" text or widen the button; they show a small
  emerald dot on the icon instead.
- **Hidden sites.** On an origin set to "Hide on this site", a save (X,
  right-click, keyboard) keeps the dock hidden and flashes ✓ on the toolbar
  icon instead.
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
- The note field is framed the same way as the card (`note.html`, a one-time
  grant per tab, messages only through the background), so keystrokes typed
  into it never reach the page — not even capture-phase listeners.
- The image-access window (`image-access.html`) is an ordinary extension page
  (not web-accessible) and only acts on a request the background issued.

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
7. Right-click a selection and an image; press `Alt+Shift+S` (and again while
   the toolbar is open: nothing stacks). Hide the dock on a site, then save
   from the right-click menu there: the toolbar icon flashes ✓.
8. On x.com, click the FoundKeep mark on a post.

Automated coverage (fix round 1 added the lost-response, server-edit,
conflict, card-error, strict-CSP, note-frame, image-window, stacking,
X-dedupe and hidden-site cases): `tests/extension-dock-flow.mjs`,
`tests/extension-dock-screenshot.mjs`, `tests/extension-dock-x.mjs`,
`tests/extension-review.mjs` (the details card) and
`tests/extension-details-tabs.mjs`.

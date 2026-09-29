#!/usr/bin/env /usr/bin/node
// Captures every state of the FoundKeep Chrome extension (apps/extension,
// 1.8.1) as real JPEG screenshots, driving the real unpacked extension the
// way tests/extension-dock-*.mjs do (trusted mouse/keyboard events via
// tests/helpers/dock-world.mjs, a stand-in backend for the fixture account).
// Writes files under deploy/dist/design/extension/ and a manifest.json for
// scripts/design/launchpad-publish.mjs.
//
//   /usr/bin/node scripts/design/capture-extension.mjs
//
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articlePage, xTimeline } from './lib/fixtures.mjs';
import {
  launchExtension, installBackend, signIn, signOut, extensionPage, summon, tabFor, startCapture,
  dockHandle, frameFor, dragSelect, sleep,
} from './lib/extension.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(REPO, 'deploy/dist/design/extension');
const ARTICLE = '/__design/article';
const PAD = 20;

await mkdir(OUT_DIR, { recursive: true });

// The Launchpad publisher matches artifacts by kind + name (see
// launchpad-publish.mjs), so every distinct state needs its own name — the
// naming convention from design/common.md bakes the state into the name.
const items = [];
const screensByLabel = new Map(); // label -> artifact name, for the flow steps
let n = 0;
const log = msg => console.log(msg);

/** Bounding box of one or more rects, padded and clamped to the viewport. */
function union(boxes, pad, viewport) {
  const live = boxes.filter(b => b && b.width > 0 && b.height > 0);
  if (!live.length) return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  let x0 = Math.min(...live.map(b => b.x)) - pad, y0 = Math.min(...live.map(b => b.y)) - pad;
  let x1 = Math.max(...live.map(b => b.x + b.width)) + pad, y1 = Math.max(...live.map(b => b.y + b.height)) + pad;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(viewport.width, x1); y1 = Math.min(viewport.height, y1);
  return { x: Math.floor(x0), y: Math.floor(y0), width: Math.ceil(x1 - x0), height: Math.ceil(y1 - y0) };
}

/**
 * Take a real JPEG screenshot (quality 80) of `page`, optionally clipped,
 * write it, and register a manifest item. `area`/`state` build the unique
 * artifact name per design/common.md: "Extension · <area> — <state>".
 */
async function capture(page, { kind, area, state, description, usage, category, clip, screenLabel }) {
  const name = `Extension · ${area} — ${state}`;
  const file = path.join(OUT_DIR, `${String(++n).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`);
  const shot = await page.screenshot({ type: 'jpeg', quality: 80, ...(clip ? { clip } : {}) });
  await writeFile(file, shot);
  items.push({ kind, name, state, variant: 'Current (real capture)', description, ...(usage ? { usage } : {}), ...(kind === 'component' ? { category: category || 'component' } : {}), image: file });
  if (kind === 'screen' && screenLabel) screensByLabel.set(screenLabel, name);
  log(`  [${kind}] ${name} (${(shot.length / 1024).toFixed(0)} KB)`);
  return file;
}

async function main() {
  // ===========================================================================
  // Session A: a realistic article page on the host-permitted origin, signed in.
  // ===========================================================================
  log('Session A: article page, signed in');
  const A = await launchExtension({ repo: REPO, allUrls: true, headless: true });
  try {
    const server = await installBackend(A.context, { origin: A.origin, pages: { [ARTICLE]: await articlePage(REPO) } });
    await signIn(A.worker);
    const ext = await extensionPage(A.context, A.worker);
    const web = await A.context.newPage();
    const url = A.origin + ARTICLE, pattern = url + '*';
    await web.goto(url);
    await web.evaluate(() => document.fonts.ready);
    const viewport = web.viewportSize();
    const dock = await dockHandle(web, A.extensionId);
    const cdp = await A.context.newCDPSession(web);
    await cdp.send('Animation.enable');
    // Park the mouse, and let the dock finish sliding (open 160 ms, tab 200 ms).
    const away = async () => { await web.mouse.move(200, 180); await sleep(260); };
    await away();

    const rect = selector => dock.evaluate(`__foundkeepDock.rect(${JSON.stringify(selector)})`);
    const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const hover = async selector => { const c = center(await rect(selector)); await web.mouse.move(c.x, c.y, { steps: 4 }); };
    const clipAround = async (selectors, extra = []) => union([...(await Promise.all(selectors.map(rect))), ...extra], PAD, viewport);
    const dockShot = async (state, description, selectors = ['.dock', '.toast', '.menu', '.local', '.tip'], extra = []) =>
      capture(web, { kind: 'component', area: 'Dock', state, description, clip: await clipAround(selectors, extra) });
    const screen = (state, description, screenLabel) => capture(web, { kind: 'screen', area: 'Screen', state, description, screenLabel });
    const ready = async ({ expand }) => {
      await web.reload();
      await web.evaluate(() => document.fonts.ready);
      await summon(ext, pattern, { expand });
      await web.bringToFront();
      await dock.until(`__foundkeepDock.state() === '${expand ? 'expanded' : 'collapsed'}'`);
      await away();
    };

    // --- Collapsed / expanded ------------------------------------------------
    await summon(ext, pattern, { expand: false });
    await web.bringToFront();
    await dock.until(`__foundkeepDock.state() === 'collapsed'`);
    await away();
    await dockShot('Collapsed pill', 'A bookmark tab tucked into the bottom edge, 16 px from the right: it slides up when it appears and rests 5 px below the edge. No drag grip; the dock no longer moves.', ['.dock']);
    await screen('Dock collapsed', 'Desktop view: the bookmark tab in the bottom edge of a real article page.', 'dock-collapsed');

    await hover('.pill');
    await dock.until(`(() => { const r = __foundkeepDock.rect('.dock'); return Math.round(r.y + r.height) === ${viewport.height}; })()`);
    await dockShot('Collapsed tab hover', 'Hover (or keyboard focus): the tab lifts flush with the edge. Click or Enter opens the toolbar.', ['.dock']);

    await dock.click('.pill');
    await dock.until(`__foundkeepDock.state() === 'expanded'`);
    await away();
    await dockShot('Expanded signed in', 'Icon-only: Save this page, Highlight, Screenshot, Note, Open library and ⋯. No labels and no second bookmark; each icon names itself in a tooltip.', ['.dock']);
    await screen('Dock expanded', 'Desktop view: the icon-only toolbar, signed in, over a real article.', 'dock-expanded');

    await hover('[data-action="savepage"]');
    await dock.until(`__foundkeepDock.rect('.tip').width > 0`);
    await sleep(160); // the tooltip's 120 ms fade-in
    await dockShot('Tooltip on hover', 'Hover an icon: after 450 ms a tooltip above it says what it does; moving along the toolbar switches it at once.');
    await away();

    await web.keyboard.press('Tab');
    await dock.until(`__foundkeepDock.focused() === 'highlight' && __foundkeepDock.rect('.tip').width > 0`);
    await sleep(160);
    await dockShot('Focus ring', 'Keyboard focus: the emerald focus ring (2 px, 1 px offset) with the tooltip shown at once.');

    // --- Dragged: floating wherever it is dropped -------------------------------
    // Collapse with a click on the page (a mouse user sees no focus ring).
    await web.mouse.click(200, 180);
    await dock.until(`__foundkeepDock.state() === 'collapsed'`);
    await away(); // let the tab finish sliding in before grabbing it
    const tabAt = center(await rect('.pill'));
    await web.mouse.move(tabAt.x, tabAt.y); await web.mouse.down();
    await web.mouse.move(460, 330, { steps: 12 }); await web.mouse.up();
    await dock.until(`__foundkeepDock.anchor()?.tucked === false`);
    await away();
    await dockShot('Floating tab', 'Dragged off the edge: a small rounded bookmark wherever it is dropped (press anywhere on the dock and move; a press that does not move is still a click). The spot is remembered across pages; drop it near the bottom edge to tuck it back in, or press Home on the focused tab.', ['.dock']);
    await dock.click('.pill');
    await dock.until(`__foundkeepDock.state() === 'expanded'`);
    await away();
    await dockShot('Floating toolbar', 'Opened from a floating tab: the toolbar grows from the tab\'s outer side at its height; menus, the note field and the details card open from that side too.', ['.dock']);
    await screen('Dock floating', 'Desktop view: the dock dragged over the article and opened there.', 'dock-floating');
    await web.keyboard.press('Escape');
    await dock.until(`__foundkeepDock.state() === 'collapsed'`);
    await dock.click('.pill'); await web.keyboard.press('Escape');
    await dock.until(`__foundkeepDock.state() === 'collapsed' && __foundkeepDock.focused() === 'pill'`);
    await web.keyboard.press('Home');
    await dock.until(`__foundkeepDock.anchor() === null`);
    await dock.click('.pill');
    await dock.until(`__foundkeepDock.state() === 'expanded'`);
    await away();

    // --- Highlighter mode + flash ---------------------------------------------
    await dock.click('[data-action="highlight"]');
    await dock.until('__foundkeepDock.highlighting() === true');
    await away();
    await dockShot('Highlighter mode on', 'Highlight with nothing selected: the button stays pressed and the status explains how to use and stop it.', ['.dock']);

    let flash = null;
    for (const target of ['#p2', '#p1', '#p4']) {
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
      await dragSelect(web, target);
      await dock.until(`__foundkeepDock.toast() !== ''`, 900, 10).catch(() => {});
      for (let i = 0; i < 20 && await web.evaluate(() => getSelection().toString() !== ''); i++) await sleep(10);
      const flashRect = await rect('.flash');
      if (flashRect.width > 0 && flashRect.height > 0) { flash = { target, flashRect }; break; }
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      await sleep(1200);
    }
    if (flash) {
      await capture(web, { kind: 'component', area: 'Highlighter flash', state: 'On the saved selection', description: 'Each selection saved in highlighter mode flashes emerald over its line boxes, drawn in the dock’s shadow root — the page DOM is never marked. Live it stays 350 ms and fades out by 1 s; held here at its first frame.', clip: await clipAround([], [flash.flashRect]) });
      await screen('Highlighter with flash', 'Desktop view: highlighter mode on, with the emerald flash over the just-saved selection.', 'highlight-flash');
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    } else {
      log('  NOTE: highlight flash could not be caught — skipping that tile.');
    }
    await web.keyboard.press('Escape');
    await dock.until('__foundkeepDock.highlighting() === false');

    // --- Screenshot corner toolbar -------------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="screenshot"]');
    await dock.until('!!window.__foundkeepCapture');
    await web.mouse.move(640, 420);
    const overlayRect = sel => dock.evaluate(`window.__foundkeepCapture.rect(${JSON.stringify(sel)})`);
    const bar = await overlayRect('.bar');
    await capture(web, { kind: 'component', area: 'Screenshot corner toolbar', state: 'Selection active', description: 'Pinned to the tab’s top-right corner: Selection (pressed) · Full page · ✕.', clip: union([bar], PAD, viewport) });
    const full = await overlayRect('[data-choice="fullpage"]');
    await web.mouse.move(full.x + full.width / 2, full.y + full.height / 2, { steps: 4 });
    await capture(web, { kind: 'component', area: 'Screenshot corner toolbar', state: 'Full page hover', description: 'Pointer over Full page (#1a1b1e hover fill).', clip: union([bar], PAD, viewport) });
    const start = { x: 330, y: 318 }, end = { x: 798, y: 556 };
    await web.mouse.move(start.x, start.y, { steps: 4 });
    await web.mouse.down();
    await web.mouse.move(end.x, end.y, { steps: 12 });
    const box = await overlayRect('.box');
    await capture(web, { kind: 'component', area: 'Screenshot corner toolbar', state: 'Drawing a region', description: 'Mouse held mid-drag: a 2 px emerald outline over a 14 % emerald fill. There is no size readout in 1.8.1.', clip: union([box], PAD, viewport) });
    await screen('Drawing a screenshot region', 'Desktop view: the crosshair veil, the corner toolbar, and a region mid-drag. The dock hides while selecting.', 'screenshot-drawing');
    await web.keyboard.press('Escape');
    await web.mouse.up();

    // Neutral status: "Selection cancelled."
    await dock.until(`__foundkeepDock.status() === 'Selection cancelled.'`);
    await away();
    await dockShot('Status neutral', '"Selection cancelled." after Esc or ✕ in the screenshot selector: muted text, nothing saved.', ['.dock']);

    // Error status: highlight shortcut with nothing selected.
    await web.evaluate(() => getSelection().removeAllRanges());
    const tab = await tabFor(ext, pattern);
    await startCapture(ext, tab, 'highlight', { trigger: 'keyboard' });
    await dock.until(`__foundkeepDock.status() === 'Select some text on the page first.'`);
    await away();
    await dockShot('Status error', 'The highlight shortcut with nothing selected: the reason in #f28b82, in the dock — never in the page.', ['.dock']);

    // --- Save page, Saved widget ------------------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="savepage"]');
    await dock.until(`__foundkeepDock.toast() !== ''`);
    await away();
    await capture(web, { kind: 'component', area: 'Saved widget', state: 'Default', description: 'Right after any save: "✓ Saved to My library · Add details", right-aligned 8 px above the dock. Fades after ~5 s.', clip: await clipAround(['.toast', '.dock']) });
    await screen('Just saved with the widget', 'Desktop view: the dock right after Save page, with the Saved widget showing.', 'just-saved');
    await hover('.toast [data-action="details"]');
    await capture(web, { kind: 'component', area: 'Saved widget', state: 'Hover', description: 'Hovering or focusing the widget keeps it; leaving re-arms a 2.5 s fade.', clip: await clipAround(['.toast', '.dock']) });

    let fading = null;
    for (let attempt = 0; attempt < 3 && !fading; attempt++) {
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
      const started = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cdp.off('Animation.animationStarted', on); reject(new Error('no fade')); }, 9000);
        const on = event => { if (event.animation.type === 'CSSTransition') { clearTimeout(timer); cdp.off('Animation.animationStarted', on); resolve(event.animation); } };
        cdp.on('Animation.animationStarted', on);
      });
      await away();
      try {
        const animation = await started;
        await cdp.send('Animation.seekAnimations', { animations: [animation.id], currentTime: 70 });
        const toastClip = await clipAround(['.toast', '.dock']);
        if (await dock.evaluate('__foundkeepDock.toast()') !== '') { fading = await capture(web, { kind: 'component', area: 'Saved widget', state: 'Fading', description: 'A real screenshot ~70 ms into the 200 ms opacity fade.', clip: toastClip }); }
      } catch { /* try again */ }
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      if (!fading) {
        await dock.until(`__foundkeepDock.toast() === ''`, 9000).catch(() => {});
        if (await dock.evaluate('__foundkeepDock.state()') !== 'expanded') { await dock.click('.pill'); await dock.until(`__foundkeepDock.state() === 'expanded'`); }
        await dock.click('[data-action="savepage"]');
        await dock.until(`__foundkeepDock.toast() !== ''`);
      }
    }
    if (!fading) log('  NOTE: Saved widget "fading" could not be caught this run — skipped.');

    // --- Add details card -------------------------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="savepage"]');
    await dock.until(`__foundkeepDock.toast() !== ''`);
    const releaseOrganization = server.hold('organization');
    await dock.click('.toast [data-action="details"]');
    const card = await frameFor(web, 'review.html');
    await card.waitForSelector('#detailsForm[data-ready="true"]');
    await card.waitForFunction(() => /Loading folders/.test(document.getElementById('detailsFeedback').textContent));
    await dock.until(`__foundkeepDock.state() === 'details'`);
    await web.mouse.move(120, 400);
    const cardClip = async () => union([await rect('.card'), await rect('.dock')], PAD, viewport);
    await capture(web, { kind: 'component', area: 'Add details card', state: 'Loading', description: 'Opened from "Add details": the save’s own fields are in; folders and collections are still loading from the server.', clip: await cardClip() });
    releaseOrganization();
    await card.waitForSelector('#detailsFolder option[value="f-reading"]', { state: 'attached' });
    await card.waitForFunction(() => document.getElementById('detailsFeedback').textContent === '');
    await web.mouse.move(120, 400);
    await capture(web, { kind: 'component', area: 'Add details card', state: 'Pre-filled', description: 'Ready: "Saved to My library", the title pre-filled from the page, keyboard focus on Title, starter and library tag suggestions.', clip: await cardClip() });
    await screen('Add details open', 'Desktop view: the Add details card open over the article, pre-filled.', 'add-details-open');
    await card.click('#detailsNewFolderToggle');
    await card.waitForSelector('#detailsNewFolder:not([hidden])');
    await web.mouse.move(120, 400);
    await capture(web, { kind: 'component', area: 'Add details card', state: 'New folder', description: '"New folder" reveals an inline name field and Create button; focus moves into the name.', clip: await cardClip() });
    await card.click('#detailsNewFolderToggle');
    await card.selectOption('#detailsCollection', 'col-design');
    await card.waitForSelector('#detailsShare:not([hidden])');
    await web.mouse.move(120, 400);
    await capture(web, { kind: 'component', area: 'Add details card', state: 'Collection share', description: 'Choosing a collection adds what is shared (title, link, text, tags) and its rules; the button becomes "Save and share". The card is capped at 600 px, so its body scrolls.', clip: await cardClip() });
    await card.click('#detailsSave');
    await dock.until(`__foundkeepDock.status() === 'Details saved'`);
    await away();
    await dockShot('Status Saved', '"Details saved" in emerald after the details card closes.', ['.dock']);

    // The error state: server refuses to list folders/collections.
    await dock.click('[data-action="savepage"]');
    await dock.until(`__foundkeepDock.toast() !== ''`);
    server.fail.organization = true; server.fail.collections = true;
    await dock.click('.toast [data-action="details"]');
    const failing = await frameFor(web, 'review.html');
    await failing.waitForFunction(() => /could not load/.test(document.getElementById('detailsFeedback').textContent));
    await web.mouse.move(120, 400);
    await capture(web, { kind: 'component', area: 'Add details card', state: 'Error', description: 'Folders and collections could not load: the reason, a Retry button, and the save can still go ahead without them.', clip: await cardClip() });
    server.fail.organization = false; server.fail.collections = false;
    await failing.click('#detailsCancel');
    await dock.until(`__foundkeepDock.state() === 'expanded'`);

    // --- Note field --------------------------------------------------------------
    await ready({ expand: true });
    const noteClip = async () => union([await rect('.note-card'), await rect('.dock')], PAD, viewport);
    const openNote = async () => {
      await dock.click('[data-action="note"]');
      const frame = await frameFor(web, 'note.html');
      await frame.waitForSelector('#noteForm[data-ready="true"]');
      await dock.until(`__foundkeepDock.focused() === 'note-card'`);
      await frame.waitForFunction(() => document.activeElement?.id === 'noteText');
      await away();
      return frame;
    };
    const savingNoteFrame = await openNote();
    await capture(web, { kind: 'component', area: 'Note field', state: 'Empty', description: 'Note opens an extension-origin field above the dock (the page never sees what is typed), focused, with its keyboard hint.', clip: await noteClip() });
    await screen('Note open', 'Desktop view: the note field open over the article.', 'note-open');
    await web.keyboard.type('Cite the 1885 Ebbinghaus study in the onboarding essay');
    await capture(web, { kind: 'component', area: 'Note field', state: 'Typing', description: 'Enter saves; Shift+Enter adds a line; Esc closes.', clip: await noteClip() });
    await web.keyboard.press('Shift+Enter');
    await web.keyboard.type('Pair it with the retention chart from this article');
    await web.keyboard.press('Shift+Enter');
    await web.keyboard.type('— ask Lena for the source data');
    await capture(web, { kind: 'component', area: 'Note field', state: 'Multi-line', description: 'Three rows of text; longer notes scroll inside the field.', clip: await noteClip() });
    // Saving: the fixture backend answers instantly, so hold the round trip
    // (inside the note frame's own context — an extension page, not the
    // isolated content-script world) long enough for a real screenshot of
    // "Saving…" before it resolves.
    await savingNoteFrame.evaluate(() => {
      const real = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = message =>
        message?.kind === 'note-save' ? new Promise(resolve => setTimeout(() => resolve(real(message)), 1200)) : real(message);
    });
    await web.keyboard.press('Enter');
    await savingNoteFrame.waitForFunction(() => document.getElementById('noteText').readOnly === true);
    await capture(web, { kind: 'component', area: 'Note field', state: 'Saving', description: 'Enter pressed: "Saving…", the field read-only until the save answers (usually a blink).', clip: await noteClip() });
    await dock.until(`__foundkeepDock.toast() !== ''`, 8000).catch(() => {});
    await ready({ expand: true });
    const errFrame = await openNote();
    await web.keyboard.type('Remember to send this to the team');
    await signOut(A.worker);
    await web.keyboard.press('Enter');
    await errFrame.waitForFunction(() => document.getElementById('noteFeedback').dataset.state === 'error');
    await away();
    await capture(web, { kind: 'component', area: 'Note field', state: 'Error', description: 'The save was refused (here: signed out meanwhile): the reason in the field and in the dock; the text stays so it can be retried.', clip: await noteClip() });
    await signIn(A.worker);
    await web.keyboard.press('Escape');

    // --- ⋯ menu -------------------------------------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="more"]');
    await dock.until(`__foundkeepDock.rect('[data-menu="more"]').height > 0`);
    await away();
    await dockShot('More menu every-site off', 'Show on every site · Hide on this site · Import browser bookmarks · Settings ↗. Opens above the dock (below it near the top).', ['.dock', '.menu']);
    await ext.evaluate(() => import('./dock-control.js').then(m => m.applyAlwaysOn(true)));
    await dock.until(`__foundkeepDock.text('[data-action="always-on"]') === 'Stop showing on every site'`);
    await dockShot('More menu every-site on', 'With "Show on every site" on, the first item turns it off.', ['.dock', '.menu']);
    await ext.evaluate(() => import('./dock-control.js').then(m => m.applyAlwaysOn(false)));
    await dock.until(`__foundkeepDock.text('[data-action="always-on"]') === 'Show on every site'`);
    await dock.click('[data-action="site"]');
    await dock.until(`__foundkeepDock.state() === 'hidden'`);
    await summon(ext, pattern, { expand: true });
    await web.bringToFront();
    await dock.until(`__foundkeepDock.state() === 'expanded'`);
    await dock.click('[data-action="more"]');
    await dock.until(`__foundkeepDock.text('[data-action="site"]') === 'Show on this site again' && __foundkeepDock.rect('[data-menu="more"]').height > 0`);
    await away();
    await dockShot('More menu hidden site', 'Summoned with the toolbar icon on a site where it was hidden: the second item brings it back.', ['.dock', '.menu']);
    await dock.click('[data-action="site"]');
    await sleep(300);

    // --- Account states -------------------------------------------------------------
    await signOut(A.worker);
    await ready({ expand: true });
    await dock.until(`__foundkeepDock.rect('[data-action="sign-in"]').height > 0`);
    await away();
    await dockShot('Expanded signed out', 'Signed out, the actions are replaced by a single "Sign in to save" (opens the login page).', ['.dock']);
    const addLocal = text => ext.evaluate(text => import('./db.js').then(db => db.addCapture({ type: 'note', noteText: text, createdAt: Date.now() })), text);
    await addLocal('Saved in 1.7.12 without an account');
    await summon(ext, pattern, { expand: true });
    await dock.until(`__foundkeepDock.text('.waiting') === '1 save from this browser is waiting — sign in to keep it'`);
    await away();
    await dockShot('Signed out with local saves waiting', 'Saves made without an account are counted above "Sign in to save".', ['.dock']);
    await signIn(A.worker);
    await summon(ext, pattern, { expand: true });
    await dock.until(`__foundkeepDock.rect('.local').height > 0`);
    await away();
    await dockShot('Local saves prompt', 'Signed in with saves still local: "1 save is only in this browser" · Move to My library · Later (snoozes a week).', ['.dock', '.local']);
    await dock.click('[data-action="local-later"]');
    await dock.until(`__foundkeepDock.rect('.local').height === 0`);

    // --- Windows ------------------------------------------------------------------
    const settings = await A.context.newPage();
    await settings.setViewportSize({ width: 380, height: 264 });
    await settings.goto(await A.worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
    await settings.evaluate(() => document.fonts.ready);
    await capture(settings, { kind: 'component', category: 'pattern', area: 'Windows', state: 'Show on every site', description: 'Opened from ⋯ → Show on every site (a 380×320 popup): asks before Chrome’s all-sites permission prompt.' });
    await settings.close();

    await web.bringToFront();
    const popupPromise = A.context.waitForEvent('page');
    const pageTab = await tabFor(ext, pattern);
    void ext.evaluate(tab => {
      chrome.permissions.request = () => Promise.reject(new Error('This function must be called during a user gesture'));
      chrome.permissions.contains = () => Promise.resolve(false);
      return import('./dock-control.js').then(m => m.startCapture(tab, 'save-image', { trigger: 'context', info: { menuItemId: 'save-image', srcUrl: 'https://images.example.com/forgetting-curve.png', pageUrl: tab.url } }));
    }, pageTab);
    const popup = await popupPromise;
    await popup.setViewportSize({ width: 400, height: 244 });
    await popup.waitForSelector('#allow:not([disabled])');
    await capture(popup, { kind: 'component', category: 'pattern', area: 'Windows', state: 'Image access', description: 'Right-click → Save image when Chrome cannot prompt from the menu: a 400×300 window names the image’s site and asks once.' });
    await popup.click('#cancel').catch(() => {});

    const importer = await A.context.newPage();
    await importer.setViewportSize({ width: 760, height: 660 });
    await importer.goto(await A.worker.evaluate(() => chrome.runtime.getURL('src/import.html')));
    await importer.waitForFunction(() => document.getElementById('connect').hidden === true && !document.getElementById('readBrowser').disabled);
    await capture(importer, { kind: 'component', category: 'pattern', area: 'Windows', state: 'Import page signed in', description: 'Opened from ⋯ → Import browser bookmarks (a full tab).' });
    await signOut(A.worker);
    await importer.reload();
    await importer.waitForFunction(() => document.getElementById('connect').hidden === false);
    await capture(importer, { kind: 'component', category: 'pattern', area: 'Windows', state: 'Import page signed out', description: 'Signed out: "Sign in to import." and the controls stay disabled.' });
    await signIn(A.worker);
    await importer.close();
  } finally {
    await A.close();
  }

  // ===========================================================================
  // Session B: an X timeline (twitter.js + the dock loaded as content scripts).
  // ===========================================================================
  log('Session B: X timeline');
  const B = await launchExtension({ repo: REPO, headless: true });
  try {
    const server = await installBackend(B.context, { origin: B.origin, xPages: { '/home': xTimeline() } });
    await signIn(B.worker);
    const web = await B.context.newPage();
    await web.goto('https://x.com/home');
    await web.bringToFront();
    const buttons = web.locator('article [data-state]');
    await buttons.nth(2).waitFor();
    await web.mouse.move(640, 760);
    const dock = await dockHandle(web, B.extensionId);
    const postClip = async (idx = 0) => { const r = await web.locator('article[data-testid="tweet"]').nth(idx).boundingBox(); return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) }; };

    await capture(web, { kind: 'component', area: 'X button', state: 'Idle', description: 'The FoundKeep mark as a thin outline at X’s own icon size, last in the action row. Grey matched to the post text.', clip: await postClip() });
    await capture(web, { kind: 'screen', area: 'Screen', state: 'X timeline idle', description: 'Desktop view: an X timeline with the idle FoundKeep button in each post’s action row.', screenLabel: 'x-idle' });
    const first = await buttons.nth(0).boundingBox();
    await web.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 4 });
    await web.waitForFunction(() => document.querySelector('article [data-state]').style.background.includes('0.1'));
    await capture(web, { kind: 'component', area: 'X button', state: 'Hover', description: 'Pointer over it: FoundKeep green on a 10 % green circle.', clip: await postClip() });

    server.preferencesDelay = 2000;
    await web.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
    await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state === 'saving');
    await sleep(200);
    await capture(web, { kind: 'component', area: 'X button', state: 'Saving', description: 'Clicked: green at 60 % opacity until the background answers (held here by a slow server).', clip: await postClip() });
    await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state === 'saved', null, { timeout: 10000 });
    server.preferencesDelay = 0;
    await web.mouse.move(640, 760);
    await web.waitForFunction(() => getComputedStyle(document.querySelector('article [data-state]')).color === 'rgb(76, 195, 138)');
    await capture(web, { kind: 'component', area: 'X button', state: 'Saved', description: 'Saved: emerald #4cc38a; a second click never saves a duplicate. The dock shows "Saved · Add details".', clip: await postClip() });
    await dock.until(`__foundkeepDock.toast() !== ''`, 8000).catch(() => {});
    await sleep(200);
    await capture(web, { kind: 'screen', area: 'Screen', state: 'X timeline saved', description: 'Desktop view: the same timeline with the first post’s button saved and the dock’s Saved widget showing.', screenLabel: 'x-saved' });

    await signOut(B.worker);
    const second = await buttons.nth(1).boundingBox();
    await web.mouse.click(second.x + second.width / 2, second.y + second.height / 2);
    await web.waitForFunction(() => document.querySelectorAll('article [data-state]')[1].dataset.state === 'error');
    await web.mouse.move(640, 760);
    await capture(web, { kind: 'component', area: 'X button', state: 'Error', description: 'The save was refused (here: signed out): X’s red for 2.5 s with a generic label; the reason appears in the dock, never in x.com’s DOM.', clip: await postClip(1) });
    await signIn(B.worker);
  } finally {
    await B.close();
  }

  // Session C: a dev build marks its button with a dot instead of text.
  log('Session C: dev build marker');
  const C = await launchExtension({ repo: REPO, headless: true, patchManifest: manifest => { manifest.action.default_title = 'FoundKeep Dev'; } });
  try {
    await installBackend(C.context, { origin: C.origin, xPages: { '/home': xTimeline() } });
    const web = await C.context.newPage();
    await web.goto('https://x.com/home');
    await web.locator('article [data-foundkeep-dev] button').nth(2).waitFor();
    await web.mouse.move(640, 760);
    const r = await web.locator('article[data-testid="tweet"]').nth(0).boundingBox();
    await capture(web, { kind: 'component', area: 'X button', state: 'Dev dot', description: 'A development build ("FoundKeep Dev") marks the icon with a 6 px emerald dot instead of text.', clip: { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) } });
  } finally {
    await C.close();
  }

  // ===========================================================================
  // Manifest + flow (the flow's steps reference the screens captured above).
  // ===========================================================================
  const scenarios = [
    { id: 'save', name: 'Save page → Saved → Add details', labels: ['dock-expanded', 'just-saved', 'add-details-open'] },
    { id: 'screenshot', name: 'Screenshot → select → Saved', labels: ['dock-expanded', 'screenshot-drawing', 'just-saved'] },
    { id: 'highlight', name: 'Highlight mode → select → Saved', labels: ['dock-expanded', 'highlight-flash', 'just-saved'] },
    { id: 'note', name: 'Note → Saved', labels: ['dock-expanded', 'note-open', 'just-saved'] },
  ].filter(s => s.labels.every(l => screensByLabel.has(l)))
   .map(({ labels, ...s }) => ({ ...s, steps: labels.map(l => screensByLabel.get(l)) }));
  const manifest = { items, flows: scenarios.length ? [{ name: 'Extension · Capture journeys', scenarios }] : [] };
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  log(`\nWrote ${items.length} items to ${manifestPath}`);
}

await main();

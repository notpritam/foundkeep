// Drives the real extension through every dock state and records each one:
// DOM snapshots (through the isolated-world test handles for the closed
// shadow roots, snapshotDocument for pages and extension frames) for the
// component galleries, and real screenshots for the screens. Every state is
// reached through the extension's own code paths — clicks, keys, the
// toolbar-icon summon, keyboard/context-menu startCapture, the background's
// messages — with a stand-in backend deciding only what the server answers.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { articlePage, xTimeline } from './fixtures.mjs';
import { snapshotDocument, toWebp } from './inpage.mjs';
import { documentSurface, shadowSurface, inlineFonts } from './surfaces.mjs';
import { union } from './gallery.mjs';
import {
  launchExtension, installBackend, signIn, signOut, appearance, extensionPage, summon, tabFor, startCapture,
  dockHandle, frameFor, dragSelect, sleep,
} from './extension.mjs';

const ARTICLE = '/__design/article';
const PAD = 24;

export async function captureAll({ repo, headless = true, log = () => {} }) {
  const manifest = JSON.parse(await readFile(path.join(repo, 'apps/extension/manifest.json'), 'utf8'));
  const out = { version: manifest.version, states: {}, screens: {}, sources: {}, notes: [] };
  const state = (component, entry) => { (out.states[component] ||= []).push(entry); log(`  ${component}: ${entry.title}`); };
  const fonts = async surface => {
    surface.fontsInline = await inlineFonts(surface.fonts, repo);
    for (const inner of surface.embedded || []) inner.fontsInline = await inlineFonts(inner.fonts, repo);
    return surface;
  };

  // -------------------------------------------------------------------------
  // Session A: an article on the host-permitted origin, signed in.
  // -------------------------------------------------------------------------
  log('Session A: article page');
  const A = await launchExtension({ repo, allUrls: true, headless });
  try {
    const server = await installBackend(A.context, { origin: A.origin, pages: { [ARTICLE]: await articlePage(repo) } });
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
    const away = () => web.mouse.move(200, 180);
    await away();
    const article = await fonts(await documentSurface(web));

    const snapDock = async ({ frames: override = {} } = {}) => {
      const raw = await dock.evaluate('__foundkeepDock.snapshot()');
      const frames = { ...override };
      for (const f of raw.frames) {
        if (frames[f.src]) continue;
        const frame = web.frames().find(x => x.url() === f.src);
        if (frame) frames[f.src] = await documentSurface(frame);
      }
      return fonts(await shadowSurface(web, raw, frames));
    };
    const snapOverlay = async () => fonts(await shadowSurface(web, await dock.evaluate('window.__foundkeepCapture.snapshot()')));
    const rect = selector => dock.evaluate(`__foundkeepDock.rect(${JSON.stringify(selector)})`);
    const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const hover = async selector => { const c = center(await rect(selector)); await web.mouse.move(c.x, c.y, { steps: 4 }); };
    const shoot = async (clip) => ({ png: (await web.screenshot({ type: 'png', ...(clip ? { clip } : {}) })).toString('base64'), clip: clip || { x: 0, y: 0, ...viewport } });
    const around = (surface, extra = []) => union([...surface.boxes, ...surface.frameBoxes, ...extra], PAD, viewport);
    const dockTile = (surface, title, caption, extra) => ({ title, caption, layers: [surface], clip: around(surface, extra), viewport });
    const ready = async ({ expand }) => {
      await web.reload();
      await web.evaluate(() => document.fonts.ready);
      await summon(ext, pattern, { expand });
      await web.bringToFront();
      await dock.until(`__foundkeepDock.state() === '${expand ? 'expanded' : 'collapsed'}'`);
      await away();
    };
    const cardTheme = async (card, theme) => {
      await appearance(A.worker, theme);
      await card.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    };

    // --- Collapsed and expanded -------------------------------------------
    await summon(ext, pattern, { expand: false });
    await web.bringToFront();
    await dock.until(`__foundkeepDock.state() === 'collapsed'`);
    const collapsed = await snapDock();
    state('dock', dockTile(collapsed, 'Collapsed pill', 'Default after the toolbar icon (or "Show on every site"): grip + FoundKeep mark, 16 px from the bottom-right corner.'));
    out.screens.collapsed = { shot: await shoot(), hotspots: [{ to: 'expanded', label: 'Open FoundKeep', rect: await rect('.pill') }] };

    await dock.click('.pill');
    await dock.until(`__foundkeepDock.state() === 'expanded'`);
    await away();
    const expanded = await snapDock();
    state('dock', dockTile(expanded, 'Expanded · signed in', 'Save page, Highlight, Screenshot, Note, Library and ⋯. Hover any control in this tile.'));
    out.screens.expanded = { shot: await shoot(), hotspots: [
      { to: 'saved', label: 'Save page', rect: await rect('[data-action="savepage"]') },
      { to: 'highlight', label: 'Highlight', rect: await rect('[data-action="highlight"]') },
      { to: 'screenshot', label: 'Screenshot', rect: await rect('[data-action="screenshot"]') },
      { to: 'note', label: 'Note', rect: await rect('[data-action="note"]') },
    ] };

    await web.keyboard.press('Tab');
    await dock.until(`__foundkeepDock.focused() === 'savepage'`);
    state('dock', dockTile(await snapDock(), 'Keyboard focus', 'Tab from the pill: the emerald focus ring (2 px, 1 px offset) on Save page.'));

    // --- Highlighter mode and its flash -------------------------------------
    await dock.click('[data-action="highlight"]');
    await dock.until('__foundkeepDock.highlighting() === true');
    await away();
    state('dock', dockTile(await snapDock(), 'Highlighter mode on', 'Highlight with nothing selected: the button stays pressed and the status says how to use and stop it.'));
    // Hold CSS animations at their first frame so the flash (opaque for
    // 350 ms, gone at 1 s) is at full strength for both the copy and the
    // screen; its own 1 s removal timer still runs.
    let flash = null;
    for (const target of ['#p2', '#p1', '#p4']) {
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
      await dragSelect(web, target);
      await dock.until(`__foundkeepDock.toast() !== ''`, 900, 10).catch(() => {});
      for (let i = 0; i < 20 && await web.evaluate(() => getSelection().toString() !== ''); i++) await sleep(10);
      const surface = await snapDock();
      const shot = await shoot();
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      if (surface.html.includes('class="flash"')) { flash = { surface, shot, target }; break; }
      await sleep(1200);
    }
    if (!flash) throw new Error('the highlight flash could not be caught');
    const flashBoxes = flash.surface.boxes.filter(b => b.height < 60 && b.width > 20 && b.y < viewport.height - 100);
    state('flash', { title: 'Flash on the saved selection', caption: 'Each selection saved in highlighter mode flashes emerald over its line boxes, drawn in the dock’s shadow root (the page DOM is never marked). Held at its first frame here; live it stays 350 ms and fades out by 1 s.', layers: [article, flash.surface], clip: union(flashBoxes, 28, viewport), viewport, freeze: true, backdrop: 'page' });
    state('flash', { title: 'In context', caption: 'The same moment on the whole page: the flash, highlighter mode in the dock, and the Saved widget for that selection.', layers: [article, flash.surface], clip: { x: 0, y: 0, ...viewport }, viewport, scale: 0.5, freeze: true, backdrop: 'page' });
    out.screens.highlight = { shot: flash.shot, hotspots: [{ to: 'saved', label: 'Saved', rect: union(flashBoxes, 4, viewport) }] };
    await web.keyboard.press('Escape');
    await dock.until('__foundkeepDock.highlighting() === false');

    // --- Screenshot selector -------------------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="screenshot"]');
    await dock.until('!!window.__foundkeepCapture');
    await web.mouse.move(640, 420);
    const selecting = await snapOverlay();
    const bar = await dock.evaluate(`window.__foundkeepCapture.rect('.bar')`);
    const full = await dock.evaluate(`window.__foundkeepCapture.rect('[data-choice="fullpage"]')`);
    await web.mouse.move(full.x + full.width / 2, full.y + full.height / 2, { steps: 4 });
    const fullHover = await snapOverlay();
    const start = { x: 330, y: 318 }, end = { x: 798, y: 556 };
    await web.mouse.move(start.x, start.y, { steps: 4 });
    await web.mouse.down();
    await web.mouse.move(end.x, end.y, { steps: 12 });
    const drawing = await snapOverlay();
    const box = await dock.evaluate(`window.__foundkeepCapture.rect('.box')`);
    out.screens.screenshot = { shot: await shoot(), hotspots: [{ to: 'saved', label: 'Release to save this region', rect: box }] };
    await web.keyboard.press('Escape');
    await web.mouse.up();
    const barClip = union([bar], 20, viewport);
    state('toolbar', { title: 'Selection active', caption: 'Pinned to the tab’s top-right corner: Selection (pressed) · Full page · ✕. Hover the buttons in this tile.', layers: [article, selecting], clip: barClip, viewport, backdrop: 'page' });
    state('toolbar', { title: 'Full page hovered', caption: 'Pointer over Full page (#1a1b1e hover fill).', layers: [article, fullHover], clip: barClip, viewport, backdrop: 'page' });
    state('toolbar', { title: 'Crosshair veil, ready', caption: 'The whole tab: a 15 % veil with a crosshair cursor, the hint pill, and the corner toolbar. The dock hides while selecting.', layers: [article, selecting], clip: { x: 0, y: 0, ...viewport }, viewport, scale: 0.5, backdrop: 'page' });
    state('toolbar', { title: 'Drawing a region', caption: 'Mouse held mid-drag: a 2 px emerald outline over a 14 % emerald fill. There is no size readout in 1.8.1.', layers: [article, drawing], clip: { x: 0, y: 0, ...viewport }, viewport, scale: 0.5, backdrop: 'page' });
    state('toolbar', { title: 'Drawing a region, close-up', caption: 'The selection box at full size.', layers: [article, drawing], clip: union([box], 36, viewport), viewport, backdrop: 'page' });

    // Esc cancels: a neutral status in the dock.
    await dock.until(`__foundkeepDock.status() === 'Selection cancelled.'`);
    await away();
    state('dock', dockTile(await snapDock(), 'Status · neutral', '"Selection cancelled." after Esc or ✕ in the screenshot selector: muted text, nothing saved.'));

    // A keyboard highlight with nothing selected: an error status.
    await web.evaluate(() => getSelection().removeAllRanges());
    const tab = await tabFor(ext, pattern);
    await startCapture(ext, tab, 'highlight', { trigger: 'keyboard' });
    await dock.until(`__foundkeepDock.status() === 'Select some text on the page first.'`);
    await away();
    state('dock', dockTile(await snapDock(), 'Status · error', 'The highlight shortcut with nothing selected: the reason in #f28b82, in the dock (never in the page).'));

    // --- Save page and the Saved widget ---------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="savepage"]');
    await dock.until(`__foundkeepDock.toast() !== ''`);
    await away();
    const saved = await snapDock();
    state('widget', dockTile(saved, 'Default', 'Right after any save: "✓ Saved to My library · Add details", right-aligned 8 px above the dock. Fades after ~5 s.'));
    out.screens.saved = { shot: await shoot(), hotspots: [{ to: 'details', label: 'Add details', rect: await rect('.toast [data-action="details"]') }] };
    await hover('.toast [data-action="details"]');
    const held = await snapDock();
    state('widget', dockTile(held, 'Hover (held)', 'Hovering or focusing the widget keeps it; leaving re-arms a 2.5 s fade.'));
    const toastClip = around(saved);
    let fading = null;
    for (let attempt = 0; attempt < 3 && !fading; attempt++) {
      // Freeze the fade's transition as it starts, seek it ~70 ms in (of
      // 200 ms) and screenshot before the widget's own hide timer.
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
        const shot = await shoot(toastClip);
        if (await dock.evaluate('__foundkeepDock.toast()') !== '') fading = shot;
      } catch { /* try again */ }
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      if (!fading) {
        await dock.until(`__foundkeepDock.toast() === ''`, 9000).catch(() => {});
        if (await dock.evaluate('__foundkeepDock.state()') !== 'expanded') { await dock.click('.pill'); await dock.until(`__foundkeepDock.state() === 'expanded'`); }
        await dock.click('[data-action="savepage"]');
        await dock.until(`__foundkeepDock.toast() !== ''`);
      }
    }
    if (fading) state('widget', { title: 'Fading', caption: 'A real screenshot ~70 ms into the 200 ms opacity fade (a static copy cannot hold a transition). The dock then collapses to its pill.', image: fading, viewport });
    else out.notes.push('Saved widget "fading": the 200 ms fade could not be caught on screen this run, so that tile is missing.');

    // --- Add details card -----------------------------------------------------
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
    const cardStates = [];
    const cardState = async (title, caption) => {
      const light = await snapDock();
      await cardTheme(card, 'dark');
      const dark = await snapDock();
      await cardTheme(card, 'system');
      cardStates.push({ title, caption, light, dark });
      log(`  card: ${title}`);
      return light;
    };
    await cardState('Loading', 'Opened from "Add details": the save’s own fields are in; folders and collections are still loading from the server.');
    releaseOrganization();
    await card.waitForSelector('#detailsFolder option[value="f-reading"]', { state: 'attached' });
    await card.waitForFunction(() => document.getElementById('detailsFeedback').textContent === '');
    await cardState('Pre-filled', 'Ready: "Saved to My library", the title pre-filled from the page, keyboard focus on Title, starter and library tag suggestions.');
    out.screens.details = { shot: await shoot(), hotspots: [] };
    await card.click('#detailsNewFolderToggle');
    await card.waitForSelector('#detailsNewFolder:not([hidden])');
    await web.mouse.move(120, 400);
    await cardState('New folder open', '"New folder" reveals an inline name field and Create button; focus moves into the name.');
    await card.click('#detailsNewFolderToggle');
    await card.fill('#detailsNote', 'Good framing of the forgetting curve — use it in the onboarding essay.');
    await card.click('#detailsTags .save-tag-suggestions button[aria-label="Add tag Memory"]');
    await card.selectOption('#detailsFolder', 'f-research');
    await card.focus('#detailsNote');
    await web.mouse.move(120, 400);
    await cardState('Filled in', 'A personal note, a tag chosen from the suggestions, and a folder.');
    await card.selectOption('#detailsCollection', 'col-design');
    await card.waitForSelector('#detailsShare:not([hidden])');
    await web.mouse.move(120, 400);
    await cardState('Share to a collection', 'Choosing a collection adds what is shared (title, link, text, tags) and its rules; the button becomes "Save and share". The card is capped at 600 px, so its body scrolls — scroll inside this tile.');
    await card.click('#detailsSave');
    await dock.until(`__foundkeepDock.status() === 'Details saved'`);
    await away();
    state('dock', dockTile(await snapDock(), 'Status · success', '"Details saved" in emerald after the details card closes.'));
    // The error state: the server cannot list folders or collections.
    await dock.click('[data-action="savepage"]');
    await dock.until(`__foundkeepDock.toast() !== ''`);
    server.fail.organization = true; server.fail.collections = true;
    await dock.click('.toast [data-action="details"]');
    const failing = await frameFor(web, 'review.html');
    await failing.waitForFunction(() => /could not load/.test(document.getElementById('detailsFeedback').textContent));
    await web.mouse.move(120, 400);
    const failed = await snapDock();
    await cardTheme(failing, 'dark');
    const failedDark = await snapDock();
    await cardTheme(failing, 'system');
    cardStates.push({ title: 'Error', caption: 'Folders and collections could not load: the reason, a Retry button, and the save can still go ahead without them.', light: failed, dark: failedDark });
    server.fail.organization = false; server.fail.collections = false;
    await failing.click('#detailsCancel');
    await dock.until(`__foundkeepDock.state() === 'expanded'`);
    for (const s of cardStates) {
      state('card', dockTile(s.light, `${s.title} · light`, s.caption));
    }
    for (const s of cardStates) state('card', { ...dockTile(s.dark, `${s.title} · dark`, 'The same state with FoundKeep’s appearance set to dark (the card follows the extension theme; the dock is always dark).'), group: 'Dark appearance' });

    // --- Note field -------------------------------------------------------------
    await ready({ expand: true });
    const openNote = async () => {
      await dock.click('[data-action="note"]');
      const frame = await frameFor(web, 'note.html');
      await frame.waitForSelector('#noteForm[data-ready="true"]');
      await dock.until(`__foundkeepDock.focused() === 'note-card'`);
      await frame.waitForFunction(() => document.activeElement?.id === 'noteText');
      await away();
      return frame;
    };
    const noteFrame = await openNote();
    state('note', dockTile(await snapDock(), 'Empty', 'Note opens an extension-origin field above the dock (the page never sees what is typed), focused, with its keyboard hint.'));
    await web.keyboard.type('Cite the 1885 Ebbinghaus study in the onboarding essay');
    state('note', dockTile(await snapDock(), 'Typing one line', 'Enter saves; Shift+Enter adds a line; Esc closes.'));
    await web.keyboard.press('Shift+Enter');
    await web.keyboard.type('Pair it with the retention chart from this article');
    await web.keyboard.press('Shift+Enter');
    await web.keyboard.type('— ask Lena for the source data');
    await web.keyboard.press('Shift+Enter');
    await web.keyboard.type('and check the 2015 replication');
    const lines = await snapDock();
    state('note', dockTile(lines, 'Several lines', 'Three rows of text; longer notes scroll inside the field.'));
    out.screens.note = { shot: await shoot(), hotspots: [{ to: 'saved', label: 'Enter saves the note', rect: lines.frameBoxes[0] }] };
    // Saving: press Enter (a keydown on the field, which is what note.js
    // listens to) and copy the frame in the same task, before the save
    // answers; the dock is copied just before.
    const rawDock = await dock.evaluate('__foundkeepDock.snapshot()');
    await noteFrame.evaluate(`window.__fkSnapshot = ${snapshotDocument.toString()}`);
    const savingRaw = await noteFrame.evaluate(() => {
      document.getElementById('noteText').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      return window.__fkSnapshot();
    });
    const noteDoc = lines.embedded[0];
    const savingDoc = { ...noteDoc, html: savingRaw.html, htmlAttrs: savingRaw.htmlAttrs, bodyAttrs: savingRaw.bodyAttrs };
    state('note', dockTile(await fonts(await shadowSurface(web, rawDock, { [rawDock.frames[0].src]: savingDoc })), 'Saving', 'Enter pressed: "Saving…", the field read-only until the save answers (usually a blink).'));
    await dock.until(`__foundkeepDock.toast() !== ''`);
    await ready({ expand: true });
    const failingNote = await openNote();
    await web.keyboard.type('Remember to send this to the team');
    await signOut(A.worker);
    await web.keyboard.press('Enter');
    await failingNote.waitForFunction(() => document.getElementById('noteFeedback').dataset.state === 'error');
    await away();
    state('note', dockTile(await snapDock(), 'Error', 'The save was refused (here: signed out meanwhile): the reason in the field and in the dock; the text stays so it can be retried.'));
    await signIn(A.worker);
    await web.keyboard.press('Escape');

    // --- ⋯ menu -----------------------------------------------------------------
    await ready({ expand: true });
    await dock.click('[data-action="more"]');
    await dock.until(`__foundkeepDock.rect('[data-menu="more"]').height > 0`);
    await away();
    state('dock', dockTile(await snapDock(), '⋯ menu · every-site off', 'Show on every site · Hide on this site · Import browser bookmarks · Settings ↗. Opens above the dock (below it near the top).'));
    await ext.evaluate(() => import('./dock-control.js').then(m => m.applyAlwaysOn(true)));
    await dock.until(`__foundkeepDock.text('[data-action="always-on"]') === 'Stop showing on every site'`);
    state('dock', dockTile(await snapDock(), '⋯ menu · every-site on', 'With "Show on every site" on, the first item turns it off.'));
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
    state('dock', dockTile(await snapDock(), '⋯ menu · hidden on this site', 'Summoned with the toolbar icon on a site where it was hidden: the second item brings it back.'));
    await dock.click('[data-action="site"]');
    await sleep(300);

    // --- Account states -----------------------------------------------------------
    await signOut(A.worker);
    await ready({ expand: true });
    await dock.until(`__foundkeepDock.rect('[data-action="sign-in"]').height > 0`);
    state('dock', dockTile(await snapDock(), 'Expanded · signed out', 'Signed out, the actions are replaced by a single "Sign in to save" (opens the login page).'));
    const addLocal = text => ext.evaluate(text => import('./db.js').then(db => db.addCapture({ type: 'note', noteText: text, createdAt: Date.now() })), text);
    await addLocal('Saved in 1.7.12 without an account');
    await summon(ext, pattern, { expand: true });
    await dock.until(`__foundkeepDock.text('.waiting') === '1 save from this browser is waiting — sign in to keep it'`);
    await away();
    state('dock', dockTile(await snapDock(), 'Signed out · 1 save waiting', 'Saves made without an account (1.7.12 allowed it) are counted above "Sign in to save" — singular copy.'));
    await addLocal('Another one from before');
    await summon(ext, pattern, { expand: true });
    await dock.until(`__foundkeepDock.text('.waiting') === '2 saves from this browser are waiting — sign in to keep them'`);
    await away();
    state('dock', dockTile(await snapDock(), 'Signed out · 2 saves waiting', 'Plural copy.'));
    await signIn(A.worker);
    await summon(ext, pattern, { expand: true });
    await dock.until(`__foundkeepDock.rect('.local').height > 0`);
    await away();
    state('dock', dockTile(await snapDock(), 'Saves only in this browser', 'Signed in with saves still local: "2 saves are only in this browser" · Move to My library · Later (snoozes a week).'));
    await dock.click('[data-action="local-later"]');
    await dock.until(`__foundkeepDock.rect('.local').height === 0`);

    // --- Small windows ------------------------------------------------------------
    const windowStates = [];
    const windowState = async (page, title, caption) => {
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(2, 2);
      const light = await fonts(await documentSurface(page));
      await appearance(A.worker, 'dark');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      const dark = await fonts(await documentSurface(page));
      await appearance(A.worker, 'system');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'system');
      windowStates.push({ title, caption, light, dark });
      log(`  windows: ${title}`);
    };
    // "Show on every site" (dock-settings.html) — a 380×320 popup window; the
    // viewport here approximates its content area.
    const settings = await A.context.newPage();
    await settings.setViewportSize({ width: 380, height: 264 });
    await settings.goto(await A.worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
    await windowState(settings, 'Show on every site', 'Opened from ⋯ → Show on every site (a 380×320 popup): asks before Chrome’s all-sites permission prompt.');
    await settings.close();
    // Image access (image-access.html): the real fallback path — Chrome could
    // not show the image-site prompt from the right-click, so a FoundKeep
    // window asks with a real click.
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
    await windowState(popup, 'Image access · ready', 'Right-click → Save image when Chrome cannot prompt from the menu: a 400×300 window names the image’s site and asks once.');
    await dock.until(`__foundkeepDock.status() === 'Allow access in the FoundKeep window to save this image.'`);
    await away();
    state('dock', dockTile(await snapDock(), 'Status · waiting on a window', 'Neutral status while the image-access window is open.'));
    await popup.click('#cancel');
    await dock.until(`/Allow access to the image/.test(__foundkeepDock.status())`);
    await away();
    state('dock', dockTile(await snapDock(), 'Status · error (long)', 'Declining in that window: a longer reason, truncated with an ellipsis at 260 px.'));
    const stale = await A.context.newPage();
    await stale.setViewportSize({ width: 400, height: 244 });
    await stale.goto(await A.worker.evaluate(() => chrome.runtime.getURL('src/image-access.html?request=expired')));
    await stale.waitForFunction(() => /no longer available/.test(document.getElementById('result').textContent));
    await windowState(stale, 'Image access · expired', 'The window outlived its request (10 minutes, or already answered).');
    await stale.close();
    // Import (import.html), signed in and signed out.
    const importer = await A.context.newPage();
    await importer.setViewportSize({ width: 760, height: 660 });
    await importer.goto(await A.worker.evaluate(() => chrome.runtime.getURL('src/import.html')));
    await importer.waitForFunction(() => document.getElementById('connect').hidden === true && !document.getElementById('readBrowser').disabled);
    await windowState(importer, 'Import · signed in', 'Opened from ⋯ → Import browser bookmarks (a full tab).');
    await signOut(A.worker);
    await importer.reload();
    await importer.waitForFunction(() => document.getElementById('connect').hidden === false);
    await windowState(importer, 'Import · signed out', 'Signed out: "Sign in to import." and the controls stay disabled.');
    await signIn(A.worker);
    await importer.close();
    for (const s of windowStates) state('windows', { title: `${s.title} · light`, caption: s.caption, layers: [s.light], clip: { x: 0, y: 0, ...s.light.viewport }, viewport: s.light.viewport, backdrop: 'page' });
    for (const s of windowStates) state('windows', { title: `${s.title} · dark`, caption: 'FoundKeep appearance set to dark.', layers: [s.dark], clip: { x: 0, y: 0, ...s.dark.viewport }, viewport: s.dark.viewport, backdrop: 'page', group: 'Dark appearance' });

    // Sources for foundations: the stylesheets as shipped.
    out.sources.dock = collapsed.rawCss = (await dock.evaluate('__foundkeepDock.snapshot()')).css;
    out.sources.selector = await readFile(path.join(repo, 'apps/extension/src/screenshot-overlay.js'), 'utf8').then(text => text.match(/<style>([\s\S]*?)<\/style>/)[1]);
    for (const [name, file] of [['note', 'note.css'], ['card', 'review.css'], ['theme', 'theme.css']]) out.sources[name] = await readFile(path.join(repo, 'apps/extension/src', file), 'utf8');
    out.sources.xButton = await readFile(path.join(repo, 'apps/extension/src/twitter.js'), 'utf8');

    // Screens → WebP, converted in the extension page.
    for (const screen of Object.values(out.screens)) screen.image = await webp(ext, screen.shot);
    for (const tile of out.states.widget.filter(t => t.image)) tile.image = await webp(ext, tile.image, tile.image.clip);
    out.viewport = viewport;
  } finally {
    await A.close();
  }

  // -------------------------------------------------------------------------
  // Session B: an X timeline (twitter.js + the dock load as content scripts).
  // -------------------------------------------------------------------------
  log('Session B: X timeline');
  const xStates = await captureX({ repo, headless, log, out });
  out.states.x = xStates;
  return out;
}

async function webp(page, shot, clip = shot.clip) {
  let quality = 0.86, image;
  do {
    image = await page.evaluate(toWebp, { png: shot.png, quality });
    quality -= 0.08;
  } while (image.webp.length * 0.75 > 560_000 && quality > 0.4);
  return { webp: image.webp, width: image.width, height: image.height, cssWidth: clip.width, cssHeight: clip.height, quality: Math.round((quality + 0.08) * 100) / 100, clip };
}

async function captureX({ repo, headless, log, out }) {
  const states = [];
  const add = entry => { states.push(entry); log(`  x: ${entry.title}`); };
  const B = await launchExtension({ repo, headless });
  try {
    const server = await installBackend(B.context, { origin: B.origin, xPages: { '/home': xTimeline(), '/home?theme=dark': xTimeline({ dark: true }) } });
    await signIn(B.worker);
    const ext = await extensionPage(B.context, B.worker);
    const web = await B.context.newPage();
    await web.goto('https://x.com/home');
    await web.bringToFront();
    const viewport = web.viewportSize();
    const buttons = web.locator('article [data-state]');
    await buttons.nth(2).waitFor();
    await web.mouse.move(640, 760);
    const dock = await dockHandle(web, B.extensionId);
    const postClip = async (n = 0) => {
      const r = await web.locator('article[data-testid="tweet"]').nth(n).boundingBox();
      return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    };
    const snap = async (title, caption, n = 0, group) => {
      const doc = await documentSurface(web);
      add({ title, caption, layers: [doc], clip: await postClip(n), viewport, backdrop: 'page', ...(group ? { group } : {}) });
      return doc;
    };
    await snap('Idle', 'The FoundKeep mark as a thin outline at X’s own icon size (18.75 px in a 34.75 px round hit area), last in the action row. Grey matched to the post text.');
    const shot = async () => ({ png: (await web.screenshot({ type: 'png' })).toString('base64'), clip: { x: 0, y: 0, ...viewport } });
    const first = await buttons.nth(0).boundingBox();
    out.screens.xIdle = { shot: await shot(), hotspots: [{ to: 'xSaved', label: 'Save to FoundKeep', rect: first }] };
    await web.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 4 });
    await web.waitForFunction(() => document.querySelector('article [data-state]').style.background.includes('0.1'));
    await snap('Hover', 'Pointer over it: FoundKeep green on a 10 % green circle.');
    // A slow preference read holds the save (and the button) at "saving".
    server.preferencesDelay = 2500;
    await web.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
    await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state === 'saving');
    await sleep(250);
    await snap('Saving', 'Clicked: green at 60 % opacity until the background answers (held here by a slow server).');
    await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state === 'saved', null, { timeout: 10000 });
    server.preferencesDelay = 0;
    await web.mouse.move(640, 760);
    await web.waitForFunction(() => getComputedStyle(document.querySelector('article [data-state]')).color === 'rgb(76, 195, 138)');
    await snap('Saved', 'Saved: emerald #4cc38a, and a second click never saves a duplicate. The dock shows "Saved · Add details".');
    await dock.until(`__foundkeepDock.toast() !== ''`, 8000);
    await sleep(250);
    out.screens.xSaved = { shot: await shot(), hotspots: [] };
    await signOut(B.worker);
    const second = await buttons.nth(1).boundingBox();
    await web.mouse.click(second.x + second.width / 2, second.y + second.height / 2);
    await web.waitForFunction(() => document.querySelectorAll('article [data-state]')[1].dataset.state === 'error');
    await web.mouse.move(640, 760);
    await snap('Error', 'The save was refused (here: signed out): X’s red for 2.5 s with a generic label; the reason appears in the dock, never in x.com’s DOM.', 1);
    await signIn(B.worker);
    await web.goto('https://x.com/home?theme=dark');
    await buttons.nth(2).waitFor();
    await web.mouse.move(640, 760);
    await snap('Idle · Lights out', 'On X’s dark theme the idle grey and accent switch to the dark palette (#a5aab2 / #4cc38a).', 0, 'X dark theme');
    const dark = await buttons.nth(0).boundingBox();
    await web.mouse.click(dark.x + dark.width / 2, dark.y + dark.height / 2);
    await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state === 'saved');
    await web.mouse.move(640, 760);
    await web.waitForFunction(() => getComputedStyle(document.querySelector('article [data-state]')).color === 'rgb(76, 195, 138)');
    await snap('Saved · Lights out', 'Already saved this session, so the same post is recognised rather than saved twice.', 0, 'X dark theme');
    for (const screen of [out.screens.xIdle, out.screens.xSaved]) screen.image = await webp(ext, screen.shot);
    out.xViewport = viewport;
  } finally {
    await B.close();
  }
  // Session C: a dev build (manifest title "FoundKeep Dev") marks its button.
  const C = await launchExtension({ repo, headless, patchManifest: manifest => { manifest.action.default_title = 'FoundKeep Dev'; } });
  try {
    await installBackend(C.context, { origin: C.origin, xPages: { '/home': xTimeline() } });
    const web = await C.context.newPage();
    await web.goto('https://x.com/home');
    await web.locator('article [data-foundkeep-dev] button').nth(2).waitFor();
    await web.mouse.move(640, 760);
    const viewport = web.viewportSize();
    const r = await web.locator('article[data-testid="tweet"]').nth(0).boundingBox();
    add({ title: 'Dev build', caption: 'A development build ("FoundKeep Dev") marks the icon with a 6 px emerald dot instead of text.', layers: [await documentSurface(web)], clip: { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) }, viewport, backdrop: 'page' });
  } finally {
    await C.close();
  }
  return states;
}

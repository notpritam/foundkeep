#!/usr/bin/env /usr/bin/node
// Captures every control in the extension's "Add details" card (review.html)
// in every state, light and dark, as one sheet per control for Launchpad.
// The controls are the card's own markup (review.html, save-details.js) and
// its own stylesheets (theme.css + review.css) on a static page added to a
// disposable copy of the extension. Hover, focus and pressed are forced with
// CDP (CSS.forcePseudoState), so nothing is redrawn by hand. Writes JPEGs and
// a manifest.json for scripts/design/launchpad-publish.mjs under
// deploy/dist/design/card-controls/.
//
//   /usr/bin/node scripts/design/capture-card-controls.mjs
//
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchExtension } from './lib/extension.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(REPO, 'deploy/dist/design/card-controls');
const PAGE = 'src/card-controls.html';

// --- Markup, as review.html and bindSaveTags() render it ----------------------
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const TITLE = 'The half-life of a good idea — The Margin';
const NOTE = 'Worth rereading before the Q4 planning doc: the part about spacing reviews.';
const titleField = (attrs = '', value = TITLE) => `<label class="field">Title<input maxlength="1000" placeholder="Give this save a useful name"${value ? ` value="${esc(value)}"` : ''} ${attrs}></label>`;
const noteField = (attrs = '', value = NOTE) => `<label class="field"><span>Personal note</span><textarea rows="3" maxlength="50000" placeholder="Why are you saving this?" ${attrs}>${value}</textarea></label>`;
const FOLDERS = ['Reading list', 'Research'];
const folderSelect = (attrs = '', selected = '') => `<label class="field"><select aria-label="Folder" ${attrs}><option value="">No folder</option>${FOLDERS.map(f => `<option${f === selected ? ' selected' : ''}>${f}</option>`).join('')}</select></label>`;
const collectionSelect = () => `<label class="field">Share to a collection<select><option value="">Don’t share</option><option>Design that works</option></select></label>`;
const folderHead = (expanded = false) => `<div class="destination-folder-head"><label class="field">Folder</label><button type="button" class="btn quiet" aria-expanded="${expanded}">New folder</button></div>`;
const newFolder = (status = '', tone = '') => `<div id="detailsNewFolder"><label class="field">New folder name<input maxlength="80" value="Essays"></label><button type="button" class="btn secondary">Create</button><p class="statusline" role="status"${tone ? ` data-tone="${tone}"` : ''}>${status}</p></div>`;
const chip = (name, { selected = false, attrs = '' } = {}) => selected
  ? `<button type="button" class="save-tag-chip selected" aria-label="Remove tag ${name}" ${attrs}>${name} ×</button>`
  : `<button type="button" class="save-tag-chip" aria-label="Add tag ${name}" ${attrs}>+ ${name}</button>`;
const STARTER = ['Read later', 'Inspiration', 'Work', 'Personal'];
function tags({ selected = [], typed = '', error = '', inputAttrs = '' } = {}) {
  const search = typed.toLowerCase();
  const suggestions = STARTER.filter(t => !selected.includes(t) && t.toLowerCase().includes(search));
  return `<fieldset class="save-tags-field"><legend>Personal tags</legend><div>`
    + `<div class="save-tag-selected"${selected.length ? '' : ' hidden'}>${selected.map(t => chip(t, { selected: true })).join('')}</div>`
    + `<div class="save-tag-entry"><input type="text" maxlength="820" autocomplete="off" placeholder="Add a tag…" aria-label="Add a personal tag"${typed ? ` value="${esc(typed)}"` : ''} ${inputAttrs}><button class="btn secondary" type="button">Add</button></div>`
    + `<div class="save-tag-suggestions">${suggestions.map(t => chip(t)).join('')}</div>`
    + `<p class="fine save-tag-error" role="status">${error}</p></div></fieldset>`;
}
const checkbox = (attrs = '') => `<label class="attach-source"><input type="checkbox" ${attrs}>Include the saved image</label>`;
const button = (kind, label, attrs = '') => `<button type="button" class="btn ${kind}" ${attrs}>${label}</button>`;
const foot = (inner, status = '', tone = '') => `<footer class="review-foot"><p class="statusline" role="status"${tone ? ` data-tone="${tone}"` : ''}>${status}</p>${inner}</footer>`;

// --- Sheets: one per control; columns are states, rows are light and dark ----
// `ctx`: where the control sits in the card — 'body' (the scrolling fields),
// 'foot' (the action bar) or 'head'. data-force="…" marks the node whose
// pseudo-classes are forced.
const HOVER = 'data-force="hover"', FOCUS = 'data-force="focus"', FOCUS_VISIBLE = 'data-force="focus focus-visible"', PRESSED = 'data-force="hover active"';
const SHEETS = [
  { key: 'text-field', title: 'Text field', width: 300, description: 'Title. theme.css .field input: 1 px --line border, 6 px radius, --bg fill, 10×12 padding; focus is a 2 px --accent outline 2 px out. The label is 14 px --ink here, while legends ("Personal tags") are 12 px --muted.', states: [
    ['Empty', titleField('', '')], ['Filled', titleField()], ['Hover', titleField(HOVER)], ['Focus', titleField(FOCUS)], ['Disabled', titleField('disabled')]] },
  { key: 'text-area', title: 'Text area', width: 300, description: 'Personal note: the same field styles as Title, 3 rows, resizable vertically.', states: [
    ['Empty', noteField('', '')], ['Filled', noteField()], ['Hover', noteField(HOVER)], ['Focus', noteField(FOCUS)], ['Disabled', noteField('disabled')]] },
  { key: 'dropdown', title: 'Dropdown', width: 300, description: 'Folder and "Share to a collection" are native <select>s with no FoundKeep styling: .field only styles input and textarea, so the border, radius, height and arrow are the browser\'s, and the open list is the operating system\'s menu (it cannot be screenshotted headless, and it cannot be styled).', states: [
    ['Default', folderSelect()], ['Selected', folderSelect('', 'Reading list')], ['Hover', folderSelect(HOVER)], ['Focus', folderSelect(FOCUS)], ['Disabled', folderSelect('disabled')], ['Collection', collectionSelect()]] },
  { key: 'folder-row', title: 'Folder row', width: 320, description: 'The Folder label with its "New folder" link, the dropdown, and the inline new-folder form (a --panel box with its own field, Create button and status line).', states: [
    ['Default', folderHead() + folderSelect()], ['New folder open', folderHead(true) + folderSelect() + newFolder()], ['Creating', folderHead(true) + folderSelect() + newFolder('Creating folder…')], ['Unavailable folder', folderHead() + `<label class="field"><select aria-label="Folder"><option>Unavailable folder — choose another</option><option value="">No folder</option></select></label>`]] },
  { key: 'button-primary', title: 'Button — primary', width: 190, ctx: 'foot', description: 'Save details. theme.css .btn.primary: --button fill, --on-button text, 6 px radius, 10×15 padding, 13 px/550; hover --button-hover; pressed moves down 1 px; disabled 50 % opacity.', states: [
    ['Default', button('primary', 'Save details')], ['Hover', button('primary', 'Save details', HOVER)], ['Focus', button('primary', 'Save details', FOCUS_VISIBLE)], ['Pressed', button('primary', 'Save details', PRESSED)], ['Disabled', button('primary', 'Save details', 'disabled')]] },
  { key: 'button-secondary', title: 'Button — secondary', width: 190, description: 'Add (tags) and Create (folder). .btn.secondary: --panel fill with a --line border; hover --hover.', states: [
    ['Default', button('secondary', 'Create')], ['Hover', button('secondary', 'Create', HOVER)], ['Focus', button('secondary', 'Create', FOCUS_VISIBLE)], ['Pressed', button('secondary', 'Create', PRESSED)], ['Disabled', button('secondary', 'Create', 'disabled')]] },
  { key: 'button-quiet', title: 'Button — quiet', width: 190, ctx: 'foot', description: 'Cancel, Retry and "New folder". .btn.quiet: no fill, --muted text; hover gets a --panel fill and --ink text.', states: [
    ['Default', button('quiet', 'Cancel')], ['Hover', button('quiet', 'Cancel', HOVER)], ['Focus', button('quiet', 'Cancel', FOCUS_VISIBLE)], ['Pressed', button('quiet', 'Cancel', PRESSED)], ['Disabled', button('quiet', 'Cancel', 'disabled')]] },
  { key: 'action-bar', title: 'Action bar', width: 340, ctx: 'foot-raw', description: 'The card footer: a status line above Cancel and Save details (which fills the rest of the row).', states: [
    ['Ready', foot(button('quiet', 'Cancel') + button('primary', 'Save details'))], ['Not changed yet', foot(button('quiet', 'Cancel') + button('primary', 'Save details', 'disabled'))], ['Error', foot(button('quiet', 'Retry') + button('quiet', 'Cancel') + button('primary', 'Save details', 'disabled'), 'Some folders or collections could not load. Retry, or save without them.', 'error')], ['Sharing', foot(button('quiet', 'Cancel') + button('primary', 'Save and submit for approval'))]] },
  { key: 'tag-chips', title: 'Tag chips', width: 170, description: 'Suggested tags (+ name) and chosen tags (name ×). .save-tag-chip: 8 px radius, 11 px text, 6×9 padding; hover turns the border and text --accent; chosen chips add an --accent-bg fill. Focus is the generic button ring (2 px --accent, 4 px out), which reads large on an 11 px chip.', states: [
    ['Suggested', chip('Read later')], ['Suggested hover', chip('Read later', { attrs: HOVER })], ['Suggested focus', chip('Read later', { attrs: FOCUS_VISIBLE })], ['Chosen', chip('Memory', { selected: true })], ['Chosen hover', chip('Memory', { selected: true, attrs: HOVER })], ['Chosen focus', chip('Memory', { selected: true, attrs: FOCUS_VISIBLE })]] },
  { key: 'tag-entry', title: 'Tag entry', width: 320, description: 'The whole tags control: chosen chips, the entry field with Add, suggestions filtered by what is typed, and the error line. The entry input sits outside .field, so it gets none of the text-field styling.', states: [
    ['Empty', tags()], ['With tags', tags({ selected: ['Memory', 'Reading'] })], ['Typing', tags({ selected: ['Memory'], typed: 'wor' })], ['Focus', tags({ inputAttrs: FOCUS })], ['Error', tags({ selected: ['Memory'], typed: 'a very long tag that goes past the forty character limit', error: 'Use 1–40 characters per tag, without line breaks.' })]] },
  { key: 'checkbox', title: 'Checkbox', width: 240, description: '"Include the saved image" when sharing to a collection: a native checkbox tinted with accent-color, 15 px.', states: [
    ['Unchecked', checkbox()], ['Checked', checkbox('checked')], ['Hover', checkbox(HOVER)], ['Focus', checkbox('data-force="focus focus-visible"')], ['Disabled', checkbox('disabled')]] },
  { key: 'text', title: 'Text styles', width: 300, ctx: 'body', description: 'The card header (10 px uppercase eyebrow over a 15 px/600 title), field labels, the Personal tags legend, fine print and the three status tones.', states: [
    ['Card header', `<header class="review-head" style="margin:-14px -14px 0"><p class="eyebrow">Saved to My library</p><h1>${TITLE}</h1></header>`],
    ['Label and legend', `<label class="field">Title</label><fieldset class="save-tags-field"><legend>Personal tags</legend></fieldset>`],
    ['Fine print', `<p class="fine">Public collection: anyone can read approved entries.</p><p class="fine">Your submission needs approval.</p>`],
    ['Status', `<p class="statusline">Loading folders and collections…</p><p class="statusline" data-tone="success">Details saved</p><p class="statusline" data-tone="error">FoundKeep could not load these details. Try again.</p>`]] },
  { key: 'disclosure', title: 'Disclosure', width: 300, description: '"View saved content": a native <details> with an 11 px --muted summary, opening an excerpt capped at 100 px.', states: [
    ['Closed', `<details id="detailsOriginal"><summary>View saved content</summary><p id="detailsExcerpt">In 1885 Hermann Ebbinghaus sat alone in a room memorising nonsense syllables…</p></details>`],
    ['Open', `<details id="detailsOriginal" open><summary>View saved content</summary><p id="detailsExcerpt">In 1885 Hermann Ebbinghaus sat alone in a room memorising nonsense syllables and testing himself at intervals. What he found has been rediscovered by every student since.</p></details>`]] },
];

function context(sheet, html) {
  if (sheet.ctx === 'foot') return `<footer class="review-foot" style="margin:-14px;border-top:0">${html}</footer>`;
  if (sheet.ctx === 'foot-raw') return `<div style="margin:-14px">${html}</div>`;
  return `<fieldset class="review-body" style="padding:0;overflow:visible"><div id="detailsContent">${html}</div></fieldset>`;
}
const page = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="review.css">
<style>
  html,body{background:#e6e7e9}
  body{padding:0}
  .sheet{display:inline-block;padding:28px 28px 32px;background:#e6e7e9}
  .sheet h2{margin:0 0 4px;font:600 16px/1.3 var(--font);color:#202020}
  .sheet .sub{margin:0 0 20px;max-width:760px;font:12px/1.5 var(--font);color:#5f6368}
  .grid{display:grid;gap:14px 14px;align-items:start}
  .col{font:600 10px/1.2 var(--font);letter-spacing:.08em;text-transform:uppercase;color:#5f6368;padding-left:2px}
  .rowlabel{font:600 10px/1.2 var(--font);letter-spacing:.08em;text-transform:uppercase;color:#5f6368;align-self:center}
  .row{display:contents}
  .tile{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:14px;min-width:0;align-self:stretch;overflow:hidden;font:14px/1.55 var(--font)}
  .tile #detailsContent > :first-child,.tile .field:first-child,.tile .save-tags-field:first-child{margin-top:0}
  .tile #detailsContent > .field:last-child,.tile .save-tags-field:last-child{margin-bottom:0}
</style></head><body>
${SHEETS.map(sheet => `<section class="sheet" data-sheet="${sheet.key}"><h2>Card control · ${sheet.title}</h2><p class="sub">${esc(sheet.description)}</p>
<div class="grid" style="grid-template-columns:52px repeat(${sheet.states.length}, ${sheet.width}px)">
  <span></span>${sheet.states.map(([label]) => `<span class="col">${label}</span>`).join('')}
  ${['light', 'dark'].map(theme => `<div class="row" data-row="${theme}"><span class="rowlabel">${theme === 'light' ? 'Light' : 'Dark'}</span>${sheet.states.map(([, html]) => `<div class="tile">${context(sheet, html)}</div>`).join('')}</div>`).join('')}
</div></section>`).join('\n')}
</body></html>`;

// The same markup in both rows, so a forced node in the light row has a twin
// in the dark row; forcing works per node.
const items = [];
async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const X = await launchExtension({ repo: REPO, extraFiles: { [PAGE]: page }, viewport: { width: 2200, height: 1400 } });
  try {
    const web = await X.context.newPage();
    await web.goto(`chrome-extension://${X.extensionId}/${PAGE}`);
    await web.evaluate(() => document.fonts.ready);
    // Dark rows take theme.css's own dark declarations (tokens + color-scheme).
    const applied = await web.evaluate(() => {
      const rule = [...document.styleSheets].flatMap(s => [...s.cssRules]).find(r => r.selectorText === ':root[data-theme="dark"]');
      document.querySelectorAll('[data-row="dark"]').forEach(row => { row.style.cssText = rule.style.cssText; });
      return !!rule;
    });
    if (!applied) throw new Error('theme.css has no :root[data-theme="dark"] rule');
    const cdp = await X.context.newCDPSession(web);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-force]' });
    for (const nodeId of nodeIds) {
      const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
      const force = attributes[attributes.indexOf('data-force') + 1].split(' ');
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: force });
    }
    let n = 0;
    for (const sheet of SHEETS) {
      const file = path.join(OUT_DIR, `${String(++n).padStart(2, '0')}-${sheet.key}.jpg`);
      await web.locator(`[data-sheet="${sheet.key}"]`).screenshot({ path: file, type: 'jpeg', quality: 85 });
      items.push({ kind: 'component', category: 'primitive', name: `Extension · Card control — ${sheet.title}`, state: sheet.states.map(([label]) => label).join(' · '),
        variant: 'Current (real markup and CSS)', description: sheet.description, image: file });
      console.log(`  ${sheet.title}: ${sheet.states.length} states × light/dark`);
    }
  } finally { await X.close(); }
  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ items }, null, 2));
  console.log(`Wrote ${items.length} sheets to ${path.join(OUT_DIR, 'manifest.json')}`);
}
await main();

// Five proposals for the extension's "Add details" card, live and working:
// type, pick a folder, add or remove tags, share to a collection. They use
// theme.css's tokens, so the toolbar's Theme switches them like the card.
// None of them uses a native <select>: every choice opens the same custom
// list (search, check for the current value, a create row at the end).
import { icon } from './icons.js';

export const DATA = {
  title: 'The half-life of a good idea',
  site: 'themargin.example',
  note: 'Worth rereading before the Q4 planning doc: the part about spacing reviews.',
  folders: ['Reading list', 'Research', 'Essays', 'Work'],
  tags: ['Memory', 'Reading', 'Read later', 'Inspiration', 'Work', 'Personal', 'Learning'],
  collections: [
    { title: 'Design that works', visibility: 'public', note: 'Public, needs approval' },
    { title: 'Team research', visibility: 'private', note: 'Private, members only' },
  ],
};
export const initialState = (overrides = {}) => ({ title: DATA.title, note: DATA.note, folder: 'Reading list', tags: ['Memory'], collection: null, tab: 'details', ...overrides });

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const collectionOf = title => DATA.collections.find(c => c.title === title);

// --- The shared list picker ------------------------------------------------------
function picker(kind, state, onChange) {
  const multi = kind === 'tags';
  const options = kind === 'folder' ? [{ value: null, label: 'No folder' }, ...DATA.folders.map(f => ({ value: f, label: f }))]
    : kind === 'tags' ? DATA.tags.map(t => ({ value: t, label: t }))
    : [{ value: null, label: 'Don’t share' }, ...DATA.collections.map(c => ({ value: c.title, label: c.title, icon: c.visibility === 'public' ? 'globe' : 'lock', meta: c.note }))];
  const selected = v => multi ? state.tags.includes(v) : state[kind] === v;
  const list = document.createElement('div');
  list.className = 'fkp-list'; list.setAttribute('role', 'listbox');
  const placeholder = { folder: 'Find a folder', tags: 'Find or create a tag', collection: 'Find a collection' }[kind];
  list.innerHTML = `<label class="fkp-search">${icon('search', 14)}<input placeholder="${placeholder}" aria-label="${placeholder}"></label><div class="fkp-options"></div>`;
  const input = list.querySelector('input'), box = list.querySelector('.fkp-options');
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const shown = options.filter(o => !q || o.label.toLowerCase().includes(q));
    const create = kind !== 'collection' && q && !options.some(o => o.label.toLowerCase() === q) ? input.value.trim() : '';
    box.innerHTML = shown.map((o, i) => `<button type="button" class="fkp-option" role="option" data-i="${options.indexOf(o)}" aria-selected="${selected(o.value)}">`
      + `${o.icon ? icon(o.icon, 15) : ''}<span class="fkp-option-label">${esc(o.label)}${o.meta ? `<small>${esc(o.meta)}</small>` : ''}</span>${icon('check', 15)}</button>`).join('')
      + (kind === 'folder' || create ? `<div class="fkp-sep"></div><button type="button" class="fkp-option create" data-create="${esc(create)}">${icon('plus', 15)}<span class="fkp-option-label">${create ? `Create “${esc(create)}”` : 'New folder'}</span></button>` : '');
  };
  box.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.dataset.create !== undefined) {
      const name = b.dataset.create || 'New folder';
      if (kind === 'tags') state.tags = [...state.tags, name]; else if (kind === 'folder') { DATA.folders.push(name); state.folder = name; }
      return onChange(true);
    }
    const o = options[Number(b.dataset.i)];
    if (multi) { state.tags = selected(o.value) ? state.tags.filter(t => t !== o.value) : [...state.tags, o.value]; onChange(false); draw(); }
    else { state[kind] = o.value; onChange(true); }
  });
  input.addEventListener('input', draw);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('button')?.click(); } });
  draw();
  return list;
}

// --- Mounting: re-render from state, one open list at a time ----------------------
function mount(variant, state, { open = null } = {}) {
  const root = document.createElement('div');
  root.className = `fkp fkp-${variant.id}`;
  let list = null;
  const close = () => { list?.remove(); list = null; root.querySelectorAll('[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); };
  const render = () => { close(); root.innerHTML = variant.html(state); };
  const openList = kind => {
    const anchor = root.querySelector(`[data-pick="${kind}"]`); if (!anchor) return;
    close();
    list = picker(kind, state, done => { if (done) render(); else { const keep = kind; render(); openList(keep); } });
    root.append(list);
    anchor.setAttribute('aria-expanded', 'true');
    const a = anchor.getBoundingClientRect(), r = root.getBoundingClientRect();
    list.style.top = `${a.bottom - r.top + 6}px`;
    list.style.left = `${Math.max(8, Math.min(a.left - r.left, r.width - list.offsetWidth - 8))}px`;
    list.querySelector('input').focus({ preventScroll: true });
  };
  root.addEventListener('input', e => { if (e.target.dataset.bind) state[e.target.dataset.bind] = e.target.value; });
  root.addEventListener('click', e => {
    const t = e.target.closest('button, [role="switch"]'); if (!t || list?.contains(t)) return;
    if (t.dataset.pick) { const was = t.getAttribute('aria-expanded') === 'true'; close(); if (!was) openList(t.dataset.pick); return; }
    if (t.dataset.remove) { state.tags = state.tags.filter(x => x !== t.dataset.remove); return render(); }
    if (t.dataset.folder !== undefined) { state.folder = t.dataset.folder || null; return render(); }
    if (t.dataset.tag) { state.tags = state.tags.includes(t.dataset.tag) ? state.tags.filter(x => x !== t.dataset.tag) : [...state.tags, t.dataset.tag]; return render(); }
    if (t.dataset.collection !== undefined) { state.collection = t.dataset.collection || null; return render(); }
    if (t.dataset.share) { state.collection = state.collection ? null : DATA.collections[0].title; return render(); }
    if (t.dataset.tab) { state.tab = t.dataset.tab; return render(); }
  });
  document.addEventListener('pointerdown', e => { if (list && !list.contains(e.target) && !e.target.closest?.('[data-pick]')) close(); }, true);
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && list) { e.stopPropagation(); close(); } });
  render();
  if (open) { const tryOpen = () => root.isConnected ? openList(open) : requestAnimationFrame(tryOpen); requestAnimationFrame(tryOpen); }
  return root;
}

// --- Shared pieces -----------------------------------------------------------------
const saved = (text = 'Saved to My library') => `<span class="fkp-saved">${icon('check', 14)}${text}</span>`;
const closeButton = '<button type="button" class="fkp-icon" data-tip="Close" aria-label="Close without saving">' + icon('close') + '</button>';
const title = (s, cls = '') => `<input class="fkp-title ${cls}" data-bind="title" value="${esc(s.title)}" aria-label="Title" placeholder="Add a title">`;
const note = (s, cls = '', rows = 3) => `<textarea class="fkp-note ${cls}" data-bind="note" rows="${rows}" aria-label="Note" placeholder="Add a note">${esc(s.note)}</textarea>`;
const tagChip = t => `<button type="button" class="fkp-chip on" data-remove="${esc(t)}" aria-label="Remove tag ${esc(t)}">${esc(t)}${icon('close', 12)}</button>`;
const primary = (label = 'Save details', cls = '') => `<button type="button" class="fkp-primary ${cls}">${label}</button>`;
/** When a collection is chosen: what the collection will show (the rest stays private). */
const shareFields = s => {
  const c = collectionOf(s.collection); if (!c) return '';
  return `<section class="fkp-share">
    <p class="fkp-caption">${icon(c.visibility === 'public' ? 'globe' : 'lock', 14)}${esc(c.note)}. Your note, folder and tags stay private.</p>
    <input class="fkp-field" value="${esc(s.title)}" aria-label="Title in collection" placeholder="Title in collection">
    <textarea class="fkp-field" rows="2" aria-label="Text in collection" placeholder="What should the collection see?"></textarea>
  </section>`;
};
const submitLabel = s => s.collection ? (collectionOf(s.collection)?.visibility === 'public' ? 'Save and submit' : 'Save and share') : 'Save details';

// --- 1. Quiet sheet ---------------------------------------------------------------------
const quiet = {
  id: 'v1', name: 'Quiet sheet',
  about: 'The title is edited in place like a heading; the note is a soft well. Folder, tags and sharing are one row of rounded pills that open the list picker. Close replaces Cancel.',
  html: s => `
    <header class="fkp-head">${saved()}${closeButton}</header>
    ${title(s)}<p class="fkp-site">${DATA.site}</p>
    ${note(s)}
    <div class="fkp-pills">
      <button type="button" class="fkp-pill" data-pick="folder" aria-haspopup="listbox">${icon('folder', 15)}${esc(s.folder || 'No folder')}${icon('chevron', 14)}</button>
      ${s.tags.map(tagChip).join('')}
      <button type="button" class="fkp-pill ghost" data-pick="tags" aria-haspopup="listbox">${icon('plus', 14)}Tag</button>
    </div>
    <button type="button" class="fkp-pill ghost fkp-share-pill" data-pick="collection" aria-haspopup="listbox">${icon('collection', 15)}${esc(s.collection || 'Share to a collection')}${icon('chevron', 14)}</button>
    ${shareFields(s)}
    <footer class="fkp-foot">${primary(submitLabel(s))}</footer>`,
};

// --- 2. Properties -----------------------------------------------------------------------
const properties = {
  id: 'v2', name: 'Properties',
  about: 'Title and note up top with no boxes until you point at them, then a quiet property list — Folder, Tags, Collection — where each value is the button that opens its picker. One full-width Save.',
  html: s => `
    <header class="fkp-head">${saved()}${closeButton}</header>
    ${title(s, 'bare')}
    ${note(s, 'bare', 2)}
    <dl class="fkp-props">
      <div><dt>${icon('folder', 15)}Folder</dt><dd><button type="button" class="fkp-value" data-pick="folder" aria-haspopup="listbox">${s.folder ? esc(s.folder) : '<span class="fkp-muted">None</span>'}</button></dd></div>
      <div><dt>${icon('tag', 15)}Tags</dt><dd class="fkp-wrap">${s.tags.map(tagChip).join('')}<button type="button" class="fkp-value add" data-pick="tags" data-tip="Add a tag" aria-label="Add a tag">${icon('plus', 14)}</button></dd></div>
      <div><dt>${icon('collection', 15)}Collection</dt><dd><button type="button" class="fkp-value" data-pick="collection" aria-haspopup="listbox">${s.collection ? esc(s.collection) : '<span class="fkp-muted">Not shared</span>'}</button></dd></div>
    </dl>
    ${shareFields(s)}
    <footer class="fkp-foot">${primary(submitLabel(s), 'full')}</footer>`,
};

// --- 3. Quick picks ---------------------------------------------------------------------
const quick = {
  id: 'v3', name: 'Quick picks',
  about: 'No dropdowns at all: your folders and suggested tags are one-tap choices, and sharing is a switch that reveals your collections. Fastest when you have a handful of folders.',
  html: s => `
    <header class="fkp-head">${saved()}${closeButton}</header>
    <input class="fkp-field fkp-strong" data-bind="title" value="${esc(s.title)}" aria-label="Title" placeholder="Add a title">
    ${note(s, 'fkp-field', 2)}
    <section class="fkp-group"><h3>Folder</h3><div class="fkp-choices">
      <button type="button" class="fkp-choice" data-folder="" aria-pressed="${!s.folder}">None</button>
      ${[...new Set([...(s.folder ? [s.folder] : []), ...DATA.folders])].slice(0, 2).map(f => `<button type="button" class="fkp-choice" data-folder="${esc(f)}" aria-pressed="${s.folder === f}">${esc(f)}</button>`).join('')}
      <button type="button" class="fkp-choice ghost" data-pick="folder" data-tip="New folder" aria-label="New folder">${icon('plus', 14)}</button>
    </div></section>
    <section class="fkp-group"><h3>Tags</h3><div class="fkp-choices">
      ${[...new Set([...s.tags, ...DATA.tags])].slice(0, Math.max(5, s.tags.length)).map(t => `<button type="button" class="fkp-choice" data-tag="${esc(t)}" aria-pressed="${s.tags.includes(t)}">${s.tags.includes(t) ? icon('check', 13) : ''}${esc(t)}</button>`).join('')}
      <button type="button" class="fkp-choice ghost" data-pick="tags" data-tip="Find or create a tag" aria-label="Find or create a tag">${icon('plus', 14)}</button>
    </div></section>
    <div class="fkp-switch-row"><span>${icon('collection', 15)}Share to a collection</span><button type="button" role="switch" class="fkp-switch" data-share="1" aria-checked="${!!s.collection}" aria-label="Share to a collection"><i></i></button></div>
    ${s.collection ? `<div class="fkp-choices fkp-indent">${DATA.collections.map(c => `<button type="button" class="fkp-choice" data-collection="${esc(c.title)}" aria-pressed="${s.collection === c.title}">${icon(c.visibility === 'public' ? 'globe' : 'lock', 13)}${esc(c.title)}</button>`).join('')}</div>${shareFields(s)}` : ''}
    <footer class="fkp-foot">${primary(submitLabel(s), 'full')}</footer>`,
};

// --- 4. Details and Share -----------------------------------------------------------------
const tabs = {
  id: 'v4', name: 'Details and share',
  about: 'The save itself heads the card. Sharing moves to its own tab, so Details stays small: note, folder, tags. The folder is a field-shaped trigger for the list picker; tags live inside one field.',
  html: s => `
    <header class="fkp-item"><span class="fkp-fav" aria-hidden="true">M</span><div class="fkp-item-text">${title(s, 'small')}<p class="fkp-site">${saved('Saved')}<span>${DATA.site}</span></p></div>${closeButton}</header>
    <div class="fkp-seg" role="tablist">
      <button type="button" role="tab" data-tab="details" aria-selected="${s.tab === 'details'}">Details</button>
      <button type="button" role="tab" data-tab="share" aria-selected="${s.tab === 'share'}">Share${s.collection ? '<i class="fkp-dot"></i>' : ''}</button>
    </div>
    ${s.tab === 'details' ? `
      <label class="fkp-label">Note${note(s, 'fkp-field', 3)}</label>
      <div class="fkp-label">Folder<button type="button" class="fkp-field fkp-trigger" data-pick="folder" aria-haspopup="listbox">${icon('folder', 15)}<span>${esc(s.folder || 'No folder')}</span>${icon('chevron', 15)}</button></div>
      <div class="fkp-label">Tags<div class="fkp-field fkp-tagfield">${s.tags.map(tagChip).join('')}<button type="button" class="fkp-inline-add" data-pick="tags" aria-haspopup="listbox">${icon('plus', 13)}Add tag</button></div></div>`
    : `
      <div class="fkp-cards">${DATA.collections.map(c => `<button type="button" class="fkp-card-option" data-collection="${esc(c.title)}" aria-pressed="${s.collection === c.title}">${icon(c.visibility === 'public' ? 'globe' : 'lock', 16)}<span><strong>${esc(c.title)}</strong><small>${esc(c.note)}</small></span>${icon('check', 16)}</button>`).join('')}
        <button type="button" class="fkp-card-option" data-collection="" aria-pressed="${!s.collection}">${icon('close', 16)}<span><strong>Don’t share</strong><small>Only you can see this save</small></span>${icon('check', 16)}</button></div>
      ${shareFields(s)}`}
    <footer class="fkp-foot">${primary(submitLabel(s), 'full')}</footer>`,
};

// --- 5. Icon row ----------------------------------------------------------------------------
const compact = {
  id: 'v5', name: 'Icon row',
  about: 'The most compact: a title line, a one-line note that grows, the chosen folder and tags as small chips, and one row of icon buttons (folder, tags, share) with tooltips. An icon turns emerald when it holds a value.',
  html: s => `
    <div class="fkp-line"><span class="fkp-tick" data-tip="Saved to My library">${icon('check', 14)}</span>${title(s, 'inline')}${closeButton}</div>
    ${note(s, 'line', 1)}
    ${s.folder || s.tags.length ? `<div class="fkp-picked">${s.folder ? `<span class="fkp-chip">${icon('folder', 12)}${esc(s.folder)}</span>` : ''}${s.tags.map(tagChip).join('')}</div>` : ''}
    <div class="fkp-bar">
      <button type="button" class="fkp-icon ${s.folder ? 'set' : ''}" data-pick="folder" data-tip="Folder" aria-label="Folder" aria-haspopup="listbox">${icon('folder', 18)}</button>
      <button type="button" class="fkp-icon ${s.tags.length ? 'set' : ''}" data-pick="tags" data-tip="Tags" aria-label="Tags" aria-haspopup="listbox">${icon('tag', 18)}</button>
      <button type="button" class="fkp-icon ${s.collection ? 'set' : ''}" data-pick="collection" data-tip="Share to a collection" aria-label="Share to a collection" aria-haspopup="listbox">${icon('collection', 18)}</button>
      <span class="fkp-spacer"></span>
      ${primary('Save', 'small')}
    </div>
    ${shareFields(s)}`,
};

export const VARIANTS = [quiet, properties, quick, tabs, compact];
export const proposal = (index, { state = {}, open = null } = {}) => mount(VARIANTS[index], initialState(state), { open });

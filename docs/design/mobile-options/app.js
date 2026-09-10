const screens = [
  ['welcome', '01 · Welcome', 'A clearer first impression: real saves, a short promise, and one obvious next step.'],
  ['sign-in', '02 · Sign in', 'Apple and Google first. Email stays available without crowding the first view.'],
  ['register', '03 · Create account', 'A short path into your collection, with familiar sign-in choices and concise legal copy.'],
  ['onboarding', '04 · Share guide', 'Show how to save from another app through a focused, visual first-run guide.'],
  ['gallery', '05 · Gallery', 'Keep your saves in focus. Scroll inside each phone to try the compact header.'],
  ['saved', '06 · Saved item', 'Preview, source and reading content with compact actions and related saves.'],
  ['new-note', '07 · New note', 'A quiet writing surface with folder and tag controls close to Save.'],
  ['organize', '08 · Folders & tags', 'Give a save a home, pick tags, and create a folder without losing your place.'],
  ['settings', '09 · Settings', 'Account, storage and preferences grouped for quick scanning.'],
  ['batch', '10 · Shared together', 'A group of files shared in one action, with individual previews and source details.'],
  ['empty', '11 · Empty collection', 'An inviting first-save state with a direct path to the Share guide or a new note.'],
  ['recover', '12 · Recovery', 'An uncluttered password-recovery form with room for the keyboard.'],
  ['recovery-code', '13 · Recovery code', 'A clear, calm step for keeping a recovery code. The code shown here is a placeholder.'],
  ['oauth', '14 · Sign-in return', 'A focused browser-to-app handoff with a visible way back if sign-in is interrupted.'],
];
const screenIds = new Set(screens.map(([id]) => id));
const directions = {
  a: { name: 'Alpine Light', tag: 'Recommended', detail: 'Bright surfaces. A little scenery. Glass where you navigate.', welcome: 'Good finds.\nAll together.' },
  b: { name: 'Glass Horizon', tag: 'More immersive', detail: 'Scenic depth, softer sheets and a more visual gallery.', welcome: 'Keep a little\nof what you love.' },
  c: { name: 'Quiet Collection', tag: 'More restrained', detail: 'An editorial gallery, crisp type and quietly frosted controls.', welcome: 'A place for\nyour good finds.' },
};
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', plus: '<path d="M12 4v16M4 12h16"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h14"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  folder: '<path d="M3 7V5h7l2 3h9v12H3Z"/>', link: '<path d="m9 15 6-6m-6 2-2 2a4 4 0 0 0 6 6l3-3m-1-3 2-2a4 4 0 0 0-6-6L8 7"/>',
  note: '<path d="M4 4h10M4 4v16h16v-9m-9 2 8-8 3 3-8 8-4 1Z"/>',
  share: '<path d="M12 15V2m-5 5 5-5 5 5M6 11H3v10h18V11h-3"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  check: '<path d="m5 12 5 5L20 7"/>', chevron: '<path d="m9 5 7 7-7 7"/>',
  file: '<path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 13h8m-8 4h6"/>',
  bell: '<path d="M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Zm5 4h4"/>',
  shield: '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5Z"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 0-10 6 6 0 0 1 11-1 5.5 5.5 0 0 1 0 11Z"/>',
  apple: '<path fill="currentColor" stroke="none" d="M17.4 12.4c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.9-.7s1.8.7 3 .7 1.9-1.1 2.6-2.1c.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.6ZM15.3 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.note}</svg>`;
const button = (label, dest, secondary = false, glyph = '') => `<button class="app-button ${secondary ? 'secondary' : ''}" data-go="${dest}">${glyph ? icon(glyph) : ''}<span>${label}</span>${!secondary && !glyph ? icon('arrow') : ''}</button>`;
const mark = () => '<div class="wordmark"><img src="assets/mark.png" width="25" height="25" alt="">Foundkeep</div>';
const top = (title, back = 'gallery', actions = '') => `<div class="app-top"><button class="icon-button" data-go="${back}" aria-label="Back">${icon('back')}</button><strong>${title}</strong><div class="top-actions">${actions}</div></div>`;
const action = (glyph, label, dest) => `<button class="icon-button" data-go="${dest}" aria-label="${label}">${icon(glyph)}</button>`;
const dock = (selected = 'gallery') => `<nav class="dock" aria-label="App navigation"><div class="dock-tabs"><button class="${selected === 'gallery' ? 'active' : ''}" data-go="gallery">${icon('grid')}<span>Gallery</span></button><button class="${selected === 'settings' ? 'active' : ''}" data-go="settings">${icon('user')}<span>You</span></button></div><button class="dock-add" data-go="new-note" aria-label="New note">${icon('plus')}</button></nav>`;
const legal = () => '<p class="legal">By continuing, you accept our <button data-local="Terms preview">Terms</button> and <button data-local="Privacy preview">Privacy</button>.</p>';
const sampleCard = (kind, title, img, meta, extra = '') => `<button class="save-card ${kind} ${extra}" data-go="saved">${img ? `<img src="assets/${img}" alt="${title}" loading="lazy">` : `<div class="note-cover"><span>NOTE TO SELF</span><p>Notice the little things.<br>They tend to become<br>the big ideas.</p>${icon('note')}</div>`}<div class="card-copy"><span class="card-source">${icon(kind === 'note' ? 'note' : 'link')}${meta}</span><strong>${title}</strong></div></button>`;
const folder = (name = 'Inspiration') => `<button class="folder-control" data-go="organize">${icon('folder')}<span>${name}</span><span class="trailing">${icon('chevron')}</span></button>`;
const line = (label, detail, glyph, dest = '', toggle = false) => `<button class="setting-row" ${dest ? `data-go="${dest}"` : toggle ? 'data-toggle aria-pressed="true"' : `data-local="${label} preview"`}><span class="row-icon">${icon(glyph)}</span><span><strong>${label}</strong>${detail ? `<small>${detail}</small>` : ''}</span>${toggle ? '<span class="switch" aria-hidden="true"></span>' : icon('chevron', 'end')}</button>`;

function welcome(v) {
  const collage = `<div class="welcome-art"><img class="scene" src="assets/${v === 'c' ? 'interior.jpg' : 'alpine.webp'}" alt="${v === 'c' ? 'A sunlit room' : 'Alpine mountains'}"><div class="little-save"><img src="assets/architecture.jpg" alt="Architectural detail"><div>${icon('link')}<strong>Spaces worth saving</strong><small>Design inspiration</small></div></div><div class="little-note">${icon('note')}<span>A thought<br>worth keeping.</span></div>${v === 'b' ? '<span class="saved-bubble">✓ Saved to your collection</span>' : ''}</div>`;
  return `<div class="welcome-layout">${mark()}${v === 'c' ? `<div class="welcome-copy"><h1>${directions[v].welcome.replace('\n', '<br>')}</h1><p>Save what catches your eye.<br>Find it when you need it.</p></div>${collage}` : `${collage}<div class="welcome-copy"><h1>${directions[v].welcome.replace('\n', '<br>')}</h1><p>Links, photos and thoughts.<br>One collection, wherever you go.</p></div>`}<div class="welcome-actions">${button('Get started', 'register')}<button class="text-link" data-go="sign-in">Already collecting? <b>Sign in</b></button></div></div>`;
}

function auth(v, registering = false) {
  const email = `<details class="email-option"><summary>Continue with email ${icon('chevron')}</summary><div class="email-fields">${registering ? '<label>Name<input placeholder="Your name" autocomplete="off"></label>' : ''}<label>Email<input type="email" placeholder="you@example.com" autocomplete="off"></label><label>Password<input type="password" placeholder="Your password" autocomplete="new-password"></label>${button(registering ? 'Create account' : 'Sign in', registering ? 'recovery-code' : 'gallery')}<button class="text-link" data-go="recover">Use a recovery code</button></div></details>`;
  return `${top('', 'welcome')}<div class="auth-layout">${v === 'b' ? '<div class="auth-photo"><img src="assets/alpine.webp" alt="Mountains above the clouds"><span>Your collection,<br>wherever you go.</span></div>' : mark()}<div class="auth-copy"><h1>${registering ? 'Make it yours.' : 'Welcome back.'}</h1><p>${registering ? 'A little home for everything you find.' : 'Your good finds are waiting for you.'}</p></div><div class="auth-panel">${button('Continue with Apple', registering ? 'onboarding' : 'oauth', true, 'apple')}${button('Continue with Google', registering ? 'onboarding' : 'oauth', true)}<div class="or"><span>or</span></div>${email}${legal()}</div><button class="text-link" data-go="${registering ? 'sign-in' : 'register'}">${registering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></div>`;
}

function onboarding(v) {
  return `${top('A quick introduction', 'welcome')}<div class="guide-layout"><p class="small-label">SAVE WITHOUT SWITCHING APPS</p><h1>See it.<br>Share it.<br>Keep it.</h1><div class="share-demo"><div class="demo-source"><img src="assets/architecture.jpg" alt="An article about architecture"><div><b>Spaces for a slower day</b><small>designnotes.example</small></div></div><div class="native-share"><span class="sheet-handle"></span><div class="share-apps"><div><span class="demo-app gray">${icon('link')}</span>Copy</div><div class="highlight"><img src="assets/mark.png" alt="">Foundkeep</div><div><span class="demo-app blue">${icon('more')}</span>More</div></div><p>Choose Foundkeep in the Share menu.</p></div></div><div class="guide-caption"><span class="step-number">1</span><div><b>Find something you love.</b><p>In Safari, Photos or Files, tap Share. Add Foundkeep to your favorites to keep it close.</p></div></div>${button('Try my first save', 'empty')}<button class="text-link" data-go="gallery">I’m ready — open my collection</button></div>`;
}

function gallery(v, empty = false) {
  return `<div class="collection-top"><div>${mark()}</div><div>${action('search', 'Search your collection', 'gallery')}${action('plus', 'Create a note', 'new-note')}</div></div><div class="gallery-heading"><p class="small-label">YOUR OWN LITTLE CORNER</p><h1>${v === 'c' ? 'The collection.' : v === 'b' ? 'A world of good finds.' : 'All your finds.'}</h1><p>${empty ? 'Your next good find belongs here.' : 'A little of everything you love.'}</p></div><div class="gallery-tools"><label class="search-input">${icon('search')}<input aria-label="Search sample collection" placeholder="Find something you saved"></label><div class="filter-line"><button class="filter active" data-filter="all">All saves</button><button class="filter" data-filter="link">Links</button><button class="filter" data-filter="note">Notes</button><button class="filter" data-go="organize">${icon('folder')}</button></div></div>${empty ? `<div class="empty-state"><div class="empty-art">${icon('grid')}<span>+</span></div><h2>Your first good find.</h2><p>Share a link, a photo or a thought.<br>We’ll keep it here for you.</p>${button('Show me how', 'onboarding')}<button class="text-link" data-go="new-note">Or start with a note</button></div>` : `<div class="gallery-grid">${sampleCard('link', 'Spaces for a slower day', 'interior.jpg', 'Design notes', 'featured')}${sampleCard('link', 'Somewhere to wander', 'alpine.webp', 'Field journal')}${sampleCard('note', 'A small reminder', null, 'Your note')}${sampleCard('link', 'Details worth noticing', 'architecture.jpg', 'Studio stories')}${sampleCard('link', 'By the water', 'stillwater.webp', 'Weekend plans')}${sampleCard('note', 'Ideas for the weekend', null, 'Your note')}</div><p class="gallery-end">6 finds · yours to keep</p>`}${dock()}`;
}

function saved(v) {
  const heading = '<div class="reader-heading"><span class="small-label">DESIGN NOTES · SAVED TODAY</span><h1>Spaces for<br>a slower day.</h1><p>A few quiet places to make room for thought.</p></div>';
  const cover = '<img class="reader-cover" src="assets/interior.jpg" alt="A sunlit interior with a calm material palette">';
  return `${top('Saved item', 'gallery', action('note', 'Edit and organize', 'organize') + action('share', 'Open original source', 'saved'))}<div class="reader-layout">${v === 'c' ? heading + cover : cover + heading}<div class="reader-tags"><button data-go="organize">${icon('folder')}Inspiration</button><button data-go="organize">#design</button></div><div class="reading-paper"><h2>A little more room.</h2><p>Good spaces give us somewhere to pause. A patch of sunlight, a well-worn chair, and the few things we choose to keep.</p><p>Collect the details that stay with you. Come back when you’re ready to make something of them.</p><button class="source-link" data-local="Original source preview">Original source ${icon('arrow')}</button></div><section class="related"><h2>A little connection</h2><p>More from your collection</p><div class="related-grid">${sampleCard('link', 'Details worth noticing', 'architecture.jpg', 'Shared tag: design')}${sampleCard('link', 'By the water', 'stillwater.webp', 'In Inspiration')}</div></section></div>`;
}

function note(v) {
  return `${top('New note', 'gallery', '<button class="save-text" data-go="gallery">Save</button>')}<div class="note-layout"><p class="small-label">A THOUGHT WORTH KEEPING</p><input class="note-title" aria-label="Note title" placeholder="Give it a title" value="A little reminder"><textarea class="note-editor" aria-label="Your note" spellcheck="false">Notice the little things.\n\nA color. A sentence. A place you want to come back to.\n\nSave it before it gets away.</textarea><div class="note-bottom">${folder('Personal')}<button class="add-tags" data-go="organize">${icon('plus')} Add tags</button><small>Only you can see this note.</small></div></div>`;
}

function organize(v) {
  return `${top('Organize', 'saved', '<button class="save-text" data-go="saved">Done</button>')}<div class="organize-layout"><div class="organize-preview"><img src="assets/interior.jpg" alt="Saved article"><div><small>SAVING TO YOUR COLLECTION</small><b>Spaces for a slower day</b></div></div><h1>A place for this.</h1><p>One folder. A few connections.</p><h2>Folder</h2><div class="folder-options">${['Inspiration', 'Reading', 'Personal', 'Unfiled'].map((name, i) => `<button class="folder-choice ${i === 0 ? 'chosen' : ''}" data-folder="${name}" aria-pressed="${i === 0}">${icon('folder')}<span>${name}</span>${i === 0 ? icon('check') : ''}</button>`).join('')}</div><button class="add-folder text-link" data-new-folder>${icon('plus')}New folder</button><h2>Tags <span>Connect ideas across folders</span></h2><div class="tag-options">${['design', 'spaces', 'weekend', 'to read', 'inspiration'].map((name, i) => `<button class="tag ${i < 2 ? 'chosen' : ''}" data-tag aria-pressed="${i < 2}">#${name}</button>`).join('')}</div><label class="tag-input">${icon('plus')}<input aria-label="New tag" placeholder="Create a tag…"><button data-add-tag>Add</button></label></div>`;
}

function settings(v) {
  return `<div class="collection-top">${mark()}${action('more', 'More settings', 'settings')}</div><div class="settings-layout"><h1>Your little world.</h1><div class="profile"><div class="avatar">J</div><div><h2>Jamie Morgan</h2><p>jamie@example.com</p></div><button class="icon-button" data-local="Account settings preview" aria-label="Account settings">${icon('chevron')}</button></div><div class="storage-card"><div><span>Collection storage</span><strong>24 <small>good finds</small></strong></div><div class="storage-track"><i></i></div><p>12.5 MB of 200 MB</p></div><h3>Make it your own</h3><div class="settings-group">${line('Capture-ready alerts', 'When your save is ready', 'bell', '', true)}${line('Saving from other apps', 'A quick guide to sharing', 'share', 'onboarding')}${line('Folders & tags', 'Keep your collection organized', 'folder', 'organize')}</div><h3>Your account</h3><div class="settings-group">${line('Privacy & data', '', 'shield')}${line('Help & support', '', 'user')}${line('Open on the web', 'foundkeep.app', 'link')}</div><button class="text-link sign-out" data-go="welcome">Sign out</button><p class="app-version">Foundkeep 1.0.0</p></div>${dock('settings')}`;
}

function batch(v) {
  return `${top('Shared together')}<div class="batch-layout"><span class="small-label">ONE MOMENT, THREE FINDS</span><h1>A little bundle<br>of inspiration.</h1><p>Shared from Files · Today, 9:41</p><div class="bundle-grid">${sampleCard('link', 'Spaces for a slower day', 'interior.jpg', 'Image')}${sampleCard('link', 'Details worth noticing', 'architecture.jpg', 'Image')}</div><button class="file-row" data-go="saved">${icon('file')}<div><b>Weekend reading.pdf</b><small>Document · 2.4 MB</small></div>${icon('chevron')}</button>${folder('Inspiration')}<button class="text-link" data-go="gallery">See all your saves</button></div>`;
}

function recovery(v, code = false) {
  return `${top(code ? 'One last thing' : 'Account recovery', code ? 'register' : 'sign-in')}<div class="recovery-layout">${mark()}<div class="recovery-symbol">${icon('shield')}</div><h1>${code ? 'Keep this<br>somewhere safe.' : 'Your collection<br>is still here.'}</h1><p>${code ? 'Save your recovery code in a password manager. You’ll need it if you forget your password.' : 'Use your recovery code to reset your password and get back to your finds.'}</p>${code ? `<div class="recovery-code">DEMO · NOT A REAL CODE</div><p class="small-copy">Example only — no account was created.</p>${button('Copy example code', 'recovery-code', true)}${button('I’ve saved it', 'onboarding')}` : `<div class="recovery-form"><label>Email<input type="email" placeholder="you@example.com" autocomplete="off"></label><label>Recovery code<input placeholder="Your saved recovery code" autocomplete="off"></label><label>New password<input type="password" placeholder="12 characters or more" autocomplete="new-password"></label>${button('Recover account', 'recovery-code')}<button class="text-link" data-go="sign-in">Back to sign in</button></div>`}</div>`;
}

function oauth(v) {
  return `${top('', 'sign-in')}<div class="handoff-layout">${mark()}<div class="handoff-art"><span>${icon('shield')}</span><div class="handoff-dots"><i></i><i></i><i></i></div><img src="assets/mark.png" alt="Foundkeep"></div><h1>Your collection<br>awaits.</h1><p>Finish signing in with Apple in your browser. You’ll return here automatically.</p><div class="handoff-notice">${icon('shield')}Your sign-in stays private.</div>${button('Preview successful return', 'gallery')}<button class="text-link" data-go="sign-in">Back to sign in</button></div>`;
}

const renderers = { welcome, 'sign-in': auth, register: v => auth(v, true), onboarding, gallery, saved, 'new-note': note, organize, settings, batch, empty: v => gallery(v, true), recover: recovery, 'recovery-code': v => recovery(v, true), oauth };
const select = document.querySelector('#screen');
select.innerHTML = screens.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
const params = new URLSearchParams(location.search);
let current = screens.some(([id]) => id === params.get('screen')) ? params.get('screen') : 'welcome';
let view = ['a', 'b', 'c'].includes(params.get('view')) ? params.get('view') : 'all';
let choices = {};
try { const saved = JSON.parse(localStorage.getItem('foundkeep-mobile-directions') || '{}'); for (const [key, value] of Object.entries(saved)) if (screenIds.has(key) && ['a', 'b', 'c'].includes(value)) choices[key] = value; } catch { /* Empty selections are fine. */ }
function persist() { try { localStorage.setItem('foundkeep-mobile-directions', JSON.stringify(choices)); } catch { toast('Browser storage is unavailable. Keep this tab open and use Send choices.'); } }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('visible'), 2800); }
function updateChoiceState() {
  document.querySelector('#choice-count').textContent = `${Object.keys(choices).length} / ${screens.length}`;
  document.querySelectorAll('[data-choose]').forEach(el => { const selected = choices[current] === el.dataset.choose; el.setAttribute('aria-pressed', String(selected)); el.textContent = selected ? '✓ Selected for this screen' : 'Choose this screen'; });
  document.querySelector('#choice-list').innerHTML = screens.map(([id, label]) => `<div class="choice-row"><span>${label}</span><div>${Object.entries(directions).map(([v, d]) => `<button data-choice-screen="${id}" data-choice-direction="${v}" aria-pressed="${choices[id] === v}" aria-label="${d.name} for ${label}">${v.toUpperCase()}</button>`).join('')}</div></div>`).join('');
}
function render(push = true) {
  select.value = current;
  if (push) history.replaceState(null, '', `?screen=${current}&view=${view}`);
  document.querySelectorAll('[data-view]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.view === view)));
  document.querySelector('#screen-description').textContent = screens.find(([id]) => id === current)[2];
  const variants = document.querySelector('#variants'); variants.dataset.view = view;
  variants.innerHTML = Object.entries(directions).filter(([v]) => view === 'all' || v === view).map(([v, d]) => `<article class="variant" data-variant="${v}"><div class="variant-title"><span class="variant-letter">${v.toUpperCase()}</span><div><h2>${d.name}</h2><p>${d.tag}</p></div><button data-all="${v}" class="all-button" aria-label="Choose ${d.name} for every screen">Use for all</button></div><p class="variant-description">${d.detail}</p><div class="phone theme-${v} screen-${current}"><div class="status-bar"><span>9:41</span><span class="island"></span><span class="status-symbols">▮▮▮ <span>◔</span> ▰</span></div><div class="app-scroll" tabindex="0" aria-label="${d.name} ${screens.find(([id]) => id === current)[1]} preview">${renderers[current](v)}</div><span class="home-indicator"></span></div><button class="choose-button" data-choose="${v}" aria-pressed="false">Choose this screen</button></article>`).join('');
  variants.querySelectorAll('.app-scroll').forEach(el => el.addEventListener('scroll', () => { el.closest('.phone').classList.toggle('scrolled', el.scrollTop > 100); }, { passive: true }));
  updateChoiceState();
}
select.addEventListener('change', () => { current = select.value; render(); });
document.querySelector('#next').addEventListener('click', () => { current = screens[(screens.findIndex(([id]) => id === current) + 1) % screens.length][0]; render(); });
document.querySelector('#review').addEventListener('click', () => document.querySelector('#choices').showModal());
document.addEventListener('click', event => {
  const el = event.target.closest('button'); if (!el) return;
  if (el.dataset.view) { view = el.dataset.view; render(); }
  if (el.dataset.go && renderers[el.dataset.go]) { current = el.dataset.go; render(); }
  if (el.dataset.local) toast(`${el.dataset.local}. This prototype doesn’t change your account.`);
  if (el.dataset.choose) { choices[current] = el.dataset.choose; persist(); updateChoiceState(); toast(`${directions[el.dataset.choose].name} selected for ${screens.find(([id]) => id === current)[1].slice(5)}.`); }
  if (el.dataset.all) { for (const [id] of screens) choices[id] = el.dataset.all; persist(); updateChoiceState(); toast(`${directions[el.dataset.all].name} selected for all 14 screens. You can still change individual screens.`); }
  if (el.dataset.choiceScreen) { choices[el.dataset.choiceScreen] = el.dataset.choiceDirection; persist(); updateChoiceState(); }
  if (el.hasAttribute('data-toggle') || el.hasAttribute('data-tag')) { const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', String(on)); el.classList.toggle('chosen', on); }
  if (el.dataset.folder) { el.parentElement.querySelectorAll('button').forEach(row => { row.classList.toggle('chosen', row === el); row.setAttribute('aria-pressed', String(row === el)); row.querySelector('.selection-check')?.remove(); const trailing = row.querySelector('svg:last-child'); if (trailing && row.querySelectorAll('svg').length > 1) trailing.remove(); if (row === el) row.insertAdjacentHTML('beforeend', icon('check', 'selection-check')); }); toast(`Preview folder: ${el.dataset.folder}`); }
  if (el.dataset.filter) { const phone = el.closest('.phone'); phone.querySelectorAll('[data-filter]').forEach(btn => btn.classList.toggle('active', btn === el)); phone.querySelectorAll('.gallery-grid > .save-card').forEach(card => { card.hidden = el.dataset.filter !== 'all' && !card.classList.contains(el.dataset.filter); }); }
  if (el.hasAttribute('data-new-folder')) { const label = document.createElement('label'); label.className = 'new-folder-form'; label.innerHTML = '<input aria-label="New folder name" placeholder="Folder name"><button>Create</button>'; el.replaceWith(label); label.querySelector('input').focus(); label.querySelector('button').onclick = () => { const name = label.querySelector('input').value.trim(); if (name) { const row = document.createElement('button'); row.className = 'folder-choice'; row.dataset.folder = name; row.textContent = name; label.closest('.organize-layout').querySelector('.folder-options').append(row); label.remove(); toast('Folder added to this preview.'); } }; }
  if (el.hasAttribute('data-add-tag')) { const input = el.parentElement.querySelector('input'); const name = input.value.trim().replace(/^#/, '').slice(0, 40); if (name) { const tag = document.createElement('button'); tag.className = 'tag chosen'; tag.dataset.tag = ''; tag.setAttribute('aria-pressed', 'true'); tag.textContent = `#${name}`; el.closest('.organize-layout').querySelector('.tag-options').append(tag); input.value = ''; } }
});
document.addEventListener('input', event => { if (event.target.matches('.search-input input')) { const q = event.target.value.toLowerCase(); event.target.closest('.phone').querySelectorAll('.gallery-grid .save-card').forEach(card => card.hidden = !card.textContent.toLowerCase().includes(q)); } });
document.querySelector('#send').addEventListener('click', async () => {
  const result = document.querySelector('#send-result');
  if (!Object.keys(choices).length) { result.textContent = 'Choose at least one screen first.'; return; }
  const btn = document.querySelector('#send'); btn.disabled = true;
  try { const response = await fetch('/choice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choices }) }); if (!response.ok) throw Error(); result.textContent = 'Choices saved for this Foundkeep thread. Tell me when you’re ready to apply them.'; document.querySelector('#save-status').textContent = 'Your choices have been sent. You can revise and send them again.'; }
  catch { result.textContent = 'Could not send. Your choices are still in this browser; tell me your preferred letters in chat.'; }
  finally { btn.disabled = false; }
});
window.addEventListener('popstate', () => { const p = new URLSearchParams(location.search); current = screenIds.has(p.get('screen')) ? p.get('screen') : 'welcome'; view = ['a', 'b', 'c'].includes(p.get('view')) ? p.get('view') : 'all'; render(false); });
render(false);

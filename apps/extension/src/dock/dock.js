(() => {
  if (window.top !== window || window.__foundkeepDock) return;
  // The FoundKeep dock: a classic content script rendering into a closed
  // shadow root. It holds no account data and never touches chrome.storage
  // (that sits next to credentials); every intent goes to the background as
  // a message, and every handler ignores untrusted (page-synthesized) events.
  //
  // Sections: markup & styles · rendering & position · highlighter mode ·
  // note frame · "Saved · Add details" widget · details card · input ·
  // background messages · test handle.
  //
  // Anything the user types (a note, details) lives in an extension-origin
  // frame the page can neither read nor drive — never in this page DOM.
  const EDGE = 16;
  const SAVED_TEXT = '✓ Saved to My library';
  const HIGHLIGHT_HINT = 'Select text to save · Esc to stop';
  const ICON = {
    grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
    mark: '<path d="M7 3h7.5L18 6.5V21l-6-4-6 4V4a1 1 0 0 1 1-1z"/><path d="M14.5 3v2.5a1 1 0 0 0 1 1H18"/><circle cx="9.6" cy="7.2" r="1.1" fill="currentColor" stroke="none"/>',
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
    button[aria-pressed="true"]{background:#163426;color:#4cc38a}
    .grip{cursor:grab;padding:0;width:24px;justify-content:center;color:#8a8f98}
    .grip:active{cursor:grabbing}
    .pill{padding:0 10px}
    .status{padding:0 10px;color:#8a8f98;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .actions{display:flex;align-items:center;gap:2px}
    .status[data-tone="ok"]{color:#4cc38a}.status[data-tone="error"]{color:#f28b82}
    .signin{display:flex;flex-direction:column;align-items:stretch;gap:2px}
    .waiting{padding:8px 10px 2px;color:#8a8f98;max-width:260px;white-space:normal;line-height:1.35}
    .menu{position:absolute;bottom:44px;right:0;display:flex;flex-direction:column;min-width:220px;padding:4px;background:#0f1011;border:1px solid #1d1f22;border-radius:12px}
    .menu button{width:100%}
    .menu.below{bottom:auto;top:44px}
    .note-card{position:fixed;width:320px;border:0;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.35);background:transparent;color-scheme:normal}
    .toast{position:fixed;display:flex;align-items:center;gap:0;padding:2px 2px 2px 12px;background:#0f1011;color:#d6d8db;border:1px solid #1d1f22;border-radius:10px;
      box-shadow:0 8px 28px rgba(0,0,0,.35);font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;transition:opacity .2s ease}
    .toast .saved{color:#4cc38a}
    .toast .sep{color:#8a8f98;padding:0 2px 0 6px}
    .toast button{height:30px;padding:0 10px;color:#f7f8f8}
    .toast.fading{opacity:0}
    .flash{position:fixed;pointer-events:none;background:rgba(76,195,138,.5);border-radius:2px;animation:foundkeep-flash 1s ease-in forwards}
    @keyframes foundkeep-flash{0%,35%{opacity:1}100%{opacity:0}}
    .card{position:fixed;width:380px;border:0;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);background:transparent;color-scheme:normal}
    @media (prefers-reduced-motion:reduce){.dock,.toast{transition:none}.flash{animation:none;opacity:.8}}`;

  // ---------------------------------------------------------------------------
  // Markup
  // ---------------------------------------------------------------------------
  const host = document.createElement('foundkeep-dock');
  host.style.cssText = 'all:initial;position:fixed;inset:auto;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="dock" hidden role="toolbar" aria-label="FoundKeep">
      <button class="grip" aria-label="Move FoundKeep dock" aria-description="Drag or use arrow keys to move. Press Home to reset.">${svg('grip')}</button>
      <button class="pill" data-action="expand" aria-label="Open FoundKeep" aria-expanded="false">${svg('mark')}</button>
      <div class="actions" hidden>
        <button data-action="savepage">${svg('savepage')}Save page</button>
        <button data-action="highlight" aria-pressed="false">${svg('highlight')}Highlight</button>
        <button data-action="screenshot">${svg('screenshot')}Screenshot</button>
        <button data-action="note" aria-expanded="false">${svg('note')}Note</button>
        <button data-action="library">${svg('library')}Library</button>
        <button data-action="more" aria-haspopup="menu" aria-label="More">${svg('more')}</button>
      </div>
      <div class="signin" hidden><span class="waiting" hidden></span><button data-action="sign-in">Sign in to save</button></div>
      <span class="status" role="status" hidden></span>
      <div class="menu" data-menu="more" role="menu" hidden>
        <button data-action="always-on" role="menuitem">Show on every site</button>
        <button data-action="site" role="menuitem">Hide on this site</button>
        <button data-action="import" role="menuitem">Import browser bookmarks</button>
        <button data-action="settings" role="menuitem">Settings ↗</button></div>
      <div class="local" hidden><span class="status"></span><button data-action="local-move">Move to My library</button><button data-action="local-later">Later</button></div>
    </div>
    <div class="toast" role="status" hidden><span class="saved">${SAVED_TEXT}</span><span class="sep" aria-hidden="true"> · </span><button data-action="details">Add details</button></div>
    <div class="flashes"></div>`;
  const $ = selector => root.querySelector(selector);
  const dockEl = $('.dock'), toastEl = $('.toast');
  let mode = 'hidden', dockState = null, frame = null, readyTimer = 0, dockReady = null, hello = 'pending';
  let pos = null; // {fx, fy} fractions of the viewport for the dock's top-left corner
  let highlighting = false, lastHighlight = null, flashCount = 0, toastTimer = 0, capturing = false, noteFrame = null, noteTimer = 0;

  const send = message => chrome.runtime.sendMessage(message).catch(() => null);

  // ---------------------------------------------------------------------------
  // Rendering & position
  // ---------------------------------------------------------------------------
  const isOpen = () => mode === 'expanded' || mode === 'details';
  function render() {
    dockEl.hidden = mode === 'hidden';
    const open = isOpen();
    const connected = !!dockState?.connected;
    $('.actions').hidden = !open || !connected;
    $('.signin').hidden = !open || connected;
    // I5: saves made without an account (1.7.12 allowed it) are still in this
    // browser; say so above "Sign in to save" instead of hiding them.
    const localOnly = dockState?.localOnly || 0;
    $('.waiting').hidden = connected || !(localOnly > 0);
    $('.waiting').textContent = localOnly === 1 ? '1 save from this browser is waiting — sign in to keep it' : `${localOnly} saves from this browser are waiting — sign in to keep them`;
    $('.pill').setAttribute('aria-expanded', String(open));
    const actions = dockState?.actions || {};
    for (const [action, enabled] of Object.entries(actions))
      for (const button of root.querySelectorAll(`[data-action="${action}"]`)) button.hidden = !enabled;
    $('[data-action="screenshot"]').hidden = !(actions.region || actions.fullpage);
    $('[data-action="always-on"]').textContent = dockState?.alwaysOn ? 'Stop showing on every site' : 'Show on every site';
    $('[data-action="site"]').textContent = dockState?.hiddenHere ? 'Show on this site again' : 'Hide on this site';
    const local = root.querySelector('.local');
    local.hidden = !open || !connected || !(dockState?.localOnly > 0);
    local.querySelector('.status').textContent = localOnly === 1 ? '1 save is only in this browser' : `${localOnly} saves are only in this browser`;
    local.querySelector('.status').hidden = false;
    if (!open || !connected) { closeMenus(); stopHighlighting(); closeNote(true, false); }
    place();
  }
  function closeMenus() { for (const menu of root.querySelectorAll('.menu')) menu.hidden = true; }
  function status(text, tone = '') {
    const el = $('.dock > .status'); el.hidden = !text; el.textContent = text; el.dataset.tone = tone;
    place(); // the dock's width changed: keep it anchored where it sits
  }
  function size() { const r = dockEl.getBoundingClientRect(); return { w: r.width || 48, h: r.height || 42 }; }
  // Shared by place() (render) and setPosition() (what gets persisted) so
  // the two can never clamp differently.
  function clamp(left, top) {
    const { w, h } = size();
    return { left: Math.min(Math.max(0, left), Math.max(0, innerWidth - w)), top: Math.min(Math.max(0, top), Math.max(0, innerHeight - h)) };
  }
  function place() {
    if (dockEl.hidden) { toastEl.hidden = true; return; }
    const { w, h } = size();
    const raw = pos ? { left: pos.fx * innerWidth, top: pos.fy * innerHeight } : { left: innerWidth - w - EDGE, top: innerHeight - h - EDGE };
    const { left, top } = clamp(raw.left, raw.top);
    dockEl.style.left = left + 'px'; dockEl.style.top = top + 'px';
    // Popovers open above the dock, or below it when it sits near the top.
    const below = top < 220;
    for (const el of root.querySelectorAll('.menu')) el.classList.toggle('below', below);
    if (frame) placeCard();
    if (noteFrame) placeNote();
    if (!toastEl.hidden) placeToast();
  }
  function setPosition(left, top, persist = true) {
    // Clamp before storing the fraction, not just before rendering: a drag
    // or arrow-key move that ends outside the viewport must persist where
    // the dock actually landed (the edge), not a fraction outside 0..1 that
    // the background's dock-position handler rejects.
    const clamped = clamp(left, top);
    pos = { fx: clamped.left / innerWidth, fy: clamped.top / innerHeight }; place();
    // The dock cannot touch chrome.storage directly (it would sit next to
    // account credentials); the background is the only trusted holder of
    // where the dock sits, so persistence goes through a message.
    if (persist) void send({ kind: 'dock-position', pos });
  }
  function setMode(next) {
    // Keep keyboard focus inside the dock when it was there already; never
    // pull it away from the page (e.g. when the dock collapses by itself).
    const hadFocus = !!root.activeElement;
    mode = next; render();
    if (next === 'collapsed' && hadFocus) $('.pill').focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Captures
  // ---------------------------------------------------------------------------
  // The background saves at once and answers here with dock-saved (the
  // widget) or dock-status (an error, or "Selection cancelled.").
  function capture(action, extra = {}) {
    if (action !== 'region' && !highlighting) status('Saving…');
    return send({ kind: 'dock-capture', action, ...extra }).then(result => {
      // The background normally reports first (dock-saved / dock-status);
      // only an answer it could not report itself is left to show here.
      if (!result?.ok && $('.dock > .status').textContent === 'Saving…') status(result?.error || '', result?.error ? 'error' : '');
      return result;
    });
  }
  const selectedText = () => { try { return getSelection()?.toString() || ''; } catch { return ''; } };

  // ---------------------------------------------------------------------------
  // Highlighter mode: Highlight with nothing selected. Every selection the
  // user then makes on the page (a trusted mouseup) is saved and briefly
  // flashed, until Esc or Highlight again. The flash is drawn in this shadow
  // root and removed within a second — the page's DOM is never marked.
  // ---------------------------------------------------------------------------
  function startHighlighting() {
    highlighting = true; lastHighlight = null;
    $('[data-action="highlight"]').setAttribute('aria-pressed', 'true');
    status(HIGHLIGHT_HINT);
  }
  function stopHighlighting() {
    if (!highlighting) return;
    highlighting = false;
    $('[data-action="highlight"]').setAttribute('aria-pressed', 'false');
    if ($('.dock > .status').textContent === HIGHLIGHT_HINT) status('');
  }
  function flash(range) {
    flashCount++;
    const layer = $('.flashes');
    for (const r of [...range.getClientRects()].slice(0, 60)) {
      if (r.width < 1 || r.height < 1) continue;
      const mark = document.createElement('div');
      mark.className = 'flash';
      Object.assign(mark.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      layer.append(mark);
      setTimeout(() => mark.remove(), 1000);
    }
  }
  document.addEventListener('mouseup', event => {
    if (!event.isTrusted || !highlighting || event.composedPath().includes(host)) return;
    // The selection settles after mouseup's default action.
    setTimeout(() => {
      if (!highlighting) return;
      const selection = getSelection();
      if (!selection?.rangeCount || !selection.toString().trim()) return;
      const range = selection.getRangeAt(0);
      const key = [range.startContainer, range.startOffset, range.endContainer, range.endOffset];
      if (lastHighlight && key.every((part, i) => part === lastHighlight[i])) return;
      lastHighlight = key;
      flash(range);
      void capture('highlight').then(result => {
        if (result && !result.ok) return stopHighlighting();
        // Saved: let go of the selection (if it is still this one) so the
        // flash reads clearly and the next selection starts fresh.
        const now = getSelection();
        if (result?.ok && now?.rangeCount && now.getRangeAt(0).startContainer === key[0] && now.getRangeAt(0).startOffset === key[1]) now.removeAllRanges();
      });
    }, 0);
  }, true);

  // ---------------------------------------------------------------------------
  // Note frame: note.html, an extension page framed next to the dock (like
  // the details card), so the page never sees what is typed. Enter saves,
  // Shift+Enter adds a line, Esc closes — handled inside the frame, which
  // reaches this dock only through the background (note-frame relay).
  // ---------------------------------------------------------------------------
  const composing = () => !!noteFrame;
  function openComposer() { closeMenus(); stopHighlighting(); status(''); void send({ kind: 'dock-note' }); }
  function placeNote() {
    const d = dockEl.getBoundingClientRect(), h = Math.min(Number(noteFrame.dataset.height || 132), innerHeight - 24);
    noteFrame.style.height = h + 'px';
    noteFrame.style.left = Math.min(Math.max(8, d.right - 320), innerWidth - 328) + 'px';
    const above = d.top - h - 8;
    noteFrame.style.top = (above >= 8 ? above : Math.min(d.bottom + 8, innerHeight - h - 8)) + 'px';
  }
  function openNote(url) {
    closeNote(false, false);
    const note = noteFrame = document.createElement('iframe');
    note.className = 'note-card'; note.src = url; note.title = 'Write a FoundKeep note'; note.dataset.height = '132';
    // As with the card: a second document in this frame means someone
    // navigated it, so close it rather than keep framing it.
    let loads = 0;
    note.addEventListener('load', () => {
      if (noteFrame !== note || ++loads < 2) return;
      closeNote(); status('Note closed. Nothing was saved.');
    });
    root.append(note); placeNote();
    $('[data-action="note"]').setAttribute('aria-expanded', 'true');
    noteTimer = setTimeout(() => { closeNote(); status('FoundKeep could not open a note field on this page.', 'error'); }, 3000);
  }
  function closeNote(notify = true, focusBack = true) {
    clearTimeout(noteTimer);
    if (!noteFrame) return;
    const focused = root.activeElement === noteFrame;
    noteFrame.remove(); noteFrame = null;
    $('[data-action="note"]').setAttribute('aria-expanded', 'false');
    if (notify) void send({ kind: 'dock-note-closed' });
    if (focused && focusBack && !$('[data-action="note"]').hidden) $('[data-action="note"]').focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // "✓ Saved to My library · Add details" — shown after every save, near the
  // dock. Fades after ~5 s; hovering or focusing it keeps it.
  // ---------------------------------------------------------------------------
  const TOAST_MS = 5000;
  function placeToast() {
    const d = dockEl.getBoundingClientRect(), t = toastEl.getBoundingClientRect();
    const above = d.top - t.height - 8;
    toastEl.style.left = Math.max(8, d.right - t.width) + 'px';
    toastEl.style.top = (above >= 8 ? above : Math.min(d.bottom + 8, innerHeight - t.height - 8)) + 'px';
  }
  function showToast() {
    toastEl.classList.remove('fading'); toastEl.hidden = false; placeToast();
    armToast(TOAST_MS);
  }
  function armToast(ms) {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl.matches(':hover') || root.activeElement === $('[data-action="details"]')) return;
      toastEl.classList.add('fading');
      toastTimer = setTimeout(hideToast, 200);
    }, ms);
  }
  function hideToast() {
    clearTimeout(toastTimer); toastEl.hidden = true; toastEl.classList.remove('fading');
    // Back to the pill once the moment has passed, unless the dock is busy.
    if (mode === 'expanded' && !highlighting && !composing() && !frame && [...root.querySelectorAll('.menu')].every(menu => menu.hidden)) setMode('collapsed');
  }
  toastEl.addEventListener('mouseenter', () => { clearTimeout(toastTimer); toastEl.classList.remove('fading'); });
  toastEl.addEventListener('focusin', () => { clearTimeout(toastTimer); toastEl.classList.remove('fading'); });
  toastEl.addEventListener('mouseleave', () => { if (!toastEl.hidden) armToast(2500); });
  toastEl.addEventListener('focusout', () => { if (!toastEl.hidden) armToast(2500); });

  // ---------------------------------------------------------------------------
  // Details card: review.html in its edit mode, an extension-origin frame the
  // page can neither read nor drive. It talks to this dock only through the
  // background, which checks the card's one-time grant for this tab.
  // ---------------------------------------------------------------------------
  function placeCard() {
    const d = dockEl.getBoundingClientRect(), h = Number(frame.dataset.height || 420);
    const height = Math.min(h, innerHeight - 24);
    const left = Math.min(Math.max(8, d.right - 380), innerWidth - 388);
    const above = d.top - height - 8;
    frame.style.left = left + 'px'; frame.style.height = height + 'px';
    frame.style.top = (above >= 8 ? above : Math.min(d.bottom + 8, innerHeight - height - 8)) + 'px';
  }
  function openCard(url) {
    closeCard(false);
    clearTimeout(toastTimer); toastEl.hidden = true;
    closeNote(true, false); stopHighlighting(); closeMenus(); status('');
    const card = frame = document.createElement('iframe');
    card.className = 'card'; card.src = url; card.title = 'Add details to your FoundKeep save'; card.dataset.height = '420';
    // C1 / R16: review.html loads exactly once per card. A page can still
    // try to navigate this frame; a second load means the card slot now
    // shows something else, so close it instead of framing it.
    let loads = 0;
    card.addEventListener('load', () => {
      if (frame !== card || ++loads < 2) return;
      closeCard(); setMode('expanded'); status('Details closed. Your save is kept.');
    });
    root.append(card); setMode('details'); placeCard();
    // Only for a card that never loaded at all: a card that loaded reports
    // ready even when it shows an error, so its own message stays on screen.
    readyTimer = setTimeout(() => { closeCard(); setMode('expanded'); status('FoundKeep could not open details on this page. Edit this save in your library.', 'error'); }, 3000);
  }
  // M4: a card that had keyboard focus hands it back to the pill when it
  // closes, instead of dropping it on the page's <body>.
  function closeCard(notify = true) {
    clearTimeout(readyTimer);
    if (!frame) return;
    const focused = root.activeElement === frame;
    frame.remove(); frame = null;
    if (notify) void send({ kind: 'dock-details-closed' });
    if (focused) $('.pill').focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Input — trusted user input only: a page script cannot synthesize a save.
  // ---------------------------------------------------------------------------
  root.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const button = event.target.closest?.('button[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'expand') return void setMode(mode === 'collapsed' ? 'expanded' : mode === 'details' ? 'details' : 'collapsed');
    if (action === 'more') { const menu = $('[data-menu="more"]'); const open = menu.hidden; closeMenus(); menu.hidden = !open; return; }
    closeMenus();
    if (action === 'details') { hideToastOnly(); return void send({ kind: 'dock-details' }); }
    if (action === 'highlight') {
      if (highlighting) return void stopHighlighting();
      closeNote(true, false);
      return void (selectedText().trim() ? capture('highlight') : startHighlighting());
    }
    if (action === 'note') return void (composing() ? closeNote() : openComposer());
    closeNote(true, false); stopHighlighting(); status('');
    if (action === 'savepage') return void capture('savepage');
    if (action === 'screenshot') return void capture(dockState?.actions?.region === false ? 'fullpage' : 'region');
    if (['library', 'settings', 'import', 'sign-in'].includes(action)) return void send({ kind: 'dock-open', target: action });
    if (action === 'always-on') return void send({ kind: 'dock-always-on', enabled: !dockState?.alwaysOn });
    if (action === 'site') { const hiding = !dockState?.hiddenHere; return void send({ kind: 'dock-site', hidden: hiding }).then(() => { if (hiding) setMode('hidden'); }); }
    if (action === 'local-move' || action === 'local-later') return void send({ kind: 'dock-local', choice: action === 'local-move' ? 'move' : 'later' });
  });
  function hideToastOnly() { clearTimeout(toastTimer); toastEl.hidden = true; }
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
    if (event.key === 'Home') { event.preventDefault(); pos = null; void send({ kind: 'dock-position', reset: true }); place(); }
  });
  // Esc closes the innermost thing first: the note field, then highlighter
  // mode, then the expanded dock.
  document.addEventListener('keydown', event => {
    if (!event.isTrusted || event.key !== 'Escape') return;
    if (composing()) { closeNote(); return; }
    if (highlighting) { stopHighlighting(); return; }
    if (mode === 'expanded') setMode('collapsed');
  }, true);
  document.addEventListener('pointerdown', event => {
    // Clicks on a screenshot selection (while the dock is hidden for it) are
    // part of the capture, not a click away from the dock.
    if (!event.isTrusted || mode !== 'expanded' || highlighting || composing() || capturing || event.composedPath().includes(host)) return;
    setMode('collapsed');
  }, true);
  document.addEventListener('fullscreenchange', () => { host.style.display = document.fullscreenElement ? 'none' : ''; });
  addEventListener('resize', place);

  // ---------------------------------------------------------------------------
  // Background messages
  // ---------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.kind === 'dock-ping') { respond({ ok: true }); return; }
    switch (message?.kind) {
      // R1: the toolbar icon toggles the dock — collapse when already
      // expanded, but never while the details card is open.
      case 'dock-show': {
        if (message.toggle && mode === 'expanded') { setMode('collapsed'); break; }
        const apply = () => {
          if (mode === 'hidden') setMode(message.expand ? 'expanded' : 'collapsed');
          else if (message.expand && mode === 'collapsed') setMode('expanded');
        };
        // On origins whose tab.url the background cannot read (x.com is
        // matched only by a static content_scripts entry), this dock's own
        // dock-hello is the only source of dockState; wait for it (bounded,
        // see dockReady below) instead of rendering a blind signed-out view.
        if (dockState) apply(); else void dockReady.then(apply);
        break;
      }
      case 'dock-collapse': if (mode === 'expanded') setMode('collapsed'); break;
      // A result to show. On a "Hide on this site" origin the dock stays
      // hidden and says so (shown:false), so the background flashes the
      // toolbar badge instead. dockState may still be on its way.
      case 'dock-saved':
      case 'dock-status': {
        const decide = () => {
          if (mode === 'hidden' && dockState?.hiddenHere) return respond({ shown: false });
          if (message.kind === 'dock-saved') {
            if (mode === 'hidden') setMode('collapsed');
            if (!highlighting) status('');
            showToast();
          } else {
            if (mode === 'hidden') setMode('expanded');
            status(message.text || '', message.tone || '');
          }
          respond({ shown: true });
        };
        if (dockState || mode !== 'hidden') decide(); else void dockReady.then(decide);
        return true;
      }
      case 'dock-note-open':
        if (mode === 'hidden') setMode('expanded');
        openNote(message.url);
        respond({ ok: true }); break;
      case 'dock-note-frame': {
        if (!noteFrame) break;
        if (message.type === 'ready') { clearTimeout(noteTimer); noteFrame.focus({ preventScroll: true }); }
        if (message.type === 'resize' && Number.isFinite(message.height)) { noteFrame.dataset.height = String(Math.min(Math.max(80, message.height), 320)); placeNote(); }
        if (message.type === 'done') closeNote();
        break;
      }
      case 'dock-details-open':
        if (mode === 'hidden') setMode('expanded');
        openCard(message.url);
        respond({ ok: true }); break;
      // C1 / R16: the card's ready/resize/done, relayed by the background
      // only after it verified the card's grant for this tab. There is no
      // window 'message' listener — the page shares that channel.
      case 'dock-details-frame': {
        if (!frame) break;
        // M4: move keyboard focus into the card (review.js puts it on its
        // first field) once it can take it.
        if (message.type === 'ready') { clearTimeout(readyTimer); frame.focus({ preventScroll: true }); }
        if (message.type === 'resize' && Number.isFinite(message.height)) { frame.dataset.height = String(Math.min(Math.max(160, message.height), 600)); placeCard(); }
        if (message.type === 'done') { closeCard(); setMode('expanded'); if (message.saved === true) status('Details saved', 'ok'); }
        break;
      }
      // I1: a hidden dock must not keep keyboard focus — Esc has to reach the
      // page (e.g. the screenshot selection injected right after this).
      case 'dock-hide': if (root.activeElement) root.activeElement.blur(); capturing = true; host.style.visibility = 'hidden'; break;
      case 'dock-unhide': capturing = false; host.style.visibility = ''; break;
      case 'dock-state': dockState = message.state; render(); break;
      // Fix round 1: a tab-URL-independent patch so every open dock updates
      // its ⋯ menu the moment always-on changes elsewhere.
      case 'dock-always-on-changed': dockState = { ...dockState, alwaysOn: message.alwaysOn }; render(); break;
    }
  });

  // ---------------------------------------------------------------------------
  // Test handle — isolated world only; the page cannot see it.
  // ---------------------------------------------------------------------------
  window.__foundkeepDock = {
    state: () => mode,
    rect: selector => { const r = root.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 }; },
    position: () => { const r = dockEl.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top) }; },
    focused: () => root.activeElement?.className || root.activeElement?.dataset?.action || null,
    visible: () => host.style.visibility !== 'hidden' && host.style.display !== 'none',
    status: () => $('.dock > .status')?.textContent || '',
    text: selector => root.querySelector(selector)?.textContent ?? null,
    attr: (selector, name) => root.querySelector(selector)?.getAttribute(name) ?? null,
    toast: () => toastEl.hidden ? '' : toastEl.textContent,
    highlighting: () => highlighting,
    composing,
    flashes: () => flashCount,
    // 'pending' until this dock's own dock-hello round trip settles, then
    // 'answered' (state applied) or 'failed' (M10).
    hello: () => hello,
    // Design review (scripts/design/dock-review.mjs): a static copy of this
    // shadow root — its stylesheet and markup, with hover and keyboard focus
    // marked as data-fk-* attributes (a copy cannot carry :hover or :focus),
    // plus the viewport boxes of what is showing and of any framed card or
    // note field. Reads nothing but this root.
    snapshot: () => {
      const copy = document.createElement('div');
      for (const node of root.childNodes) copy.append(node.cloneNode(true));
      const copies = copy.querySelectorAll('*');
      root.querySelectorAll('*').forEach((el, i) => {
        if (el.matches(':hover')) copies[i].setAttribute('data-fk-hover', '');
        if (el !== root.activeElement) return;
        copies[i].setAttribute('data-fk-focus', '');
        if (el.matches(':focus-visible')) copies[i].setAttribute('data-fk-focus-visible', '');
      });
      copy.querySelector('style')?.remove();
      const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      return {
        css: CSS, html: copy.innerHTML, viewport: { width: innerWidth, height: innerHeight },
        boxes: [...root.querySelectorAll('.dock, .toast, .menu, .card, .note-card, .flash')].map(box).filter(r => r.width && r.height),
        frames: [...root.querySelectorAll('iframe')].map(f => ({ src: f.src, ...box(f) })),
      };
    },
  };
  document.documentElement.append(host);
  void send({ kind: 'dock-position' }).then(stored => { pos = stored || null; place(); });
  // helloRequest keeps its own .then so a reply that arrives after
  // dockReady's 2s bound still updates dockState and re-renders.
  const helloRequest = send({ kind: 'dock-hello' });
  helloRequest.then(state => {
    if (!state) { hello = 'failed'; return; }
    dockState = state; if (state.show && mode === 'hidden') setMode('collapsed'); else render();
    hello = 'answered';
  });
  // Fix round 1: a service worker that's asleep or wedged can leave that
  // round trip open indefinitely; dock-show waits at most 2s for it.
  dockReady = Promise.race([helloRequest, new Promise(resolve => setTimeout(resolve, 2000))]);
})();

(() => {
  if (window.top !== window || window.__foundkeepDock) return;
  // The FoundKeep dock: a classic content script rendering into a closed
  // shadow root. It holds no account data and never touches chrome.storage
  // (that sits next to credentials); every intent goes to the background as
  // a message, and every handler ignores untrusted (page-synthesized) events.
  //
  // Sections: markup & styles · rendering · highlighter mode ·
  // note frame · "Saved · Add details" widget · details card · input ·
  // tooltips · background messages · test handle.
  //
  // Anything the user types (a note, details) lives in an extension-origin
  // frame the page can neither read nor drive — never in this page DOM.
  const SAVED_TEXT = '✓ Saved to My library';
  const HIGHLIGHT_HINT = 'Select text to save · Esc to stop';
  // One rounded 24px set: 1.75 stroke, round caps and joins, and no sharp
  // corner anywhere — every corner and notch is drawn as a curve.
  const ICON = {
    mark: '<path d="M9 3h4.4a2 2 0 0 1 1.4.6l2.6 2.6a2 2 0 0 1 .6 1.4v11.5a1 1 0 0 1-1.56.83L13 17.67Q12 17 11 17.67l-3.44 2.29A1 1 0 0 1 6 19.13V6a3 3 0 0 1 3-3z"/><path d="M14 3.4V6a1.5 1.5 0 0 0 1.5 1.5h2.1"/><circle cx="9.7" cy="7.4" r="1.2" fill="currentColor" stroke="none"/>',
    savepage: '<path d="M9 3h6a3 3 0 0 1 3 3v13.13a1 1 0 0 1-1.56.83L13 17.67Q12 17 11 17.67l-3.44 2.29A1 1 0 0 1 6 19.13V6a3 3 0 0 1 3-3z"/>',
    highlight: '<path d="M14.3 4.2a2.2 2.2 0 0 1 3.1 0l2.4 2.4a2.2 2.2 0 0 1 0 3.1l-6.1 6.1a2.2 2.2 0 0 1-3.1 0l-2.4-2.4a2.2 2.2 0 0 1 0-3.1z"/><path d="m8.5 13.4-2.3 2.3a1.4 1.4 0 0 0-.36.62L5.4 18.6l2.28-.44a1.4 1.4 0 0 0 .62-.36l2.3-2.3"/><path d="M13.5 20.5h6"/>',
    screenshot: '<path d="M4 8.5V7a3 3 0 0 1 3-3h1.5M15.5 4H17a3 3 0 0 1 3 3v1.5M20 15.5V17a3 3 0 0 1-3 3h-1.5M8.5 20H7a3 3 0 0 1-3-3v-1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="2.2"/>',
    note: '<path d="M11.5 4.5H7.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-4"/><path d="M17.3 4.2a2 2 0 0 1 2.8 2.8l-6.1 6.1a2 2 0 0 1-.93.52l-2.2.55a.5.5 0 0 1-.6-.6l.55-2.2a2 2 0 0 1 .52-.93z"/>',
    // The same notebook as My library in the web sidebar.
    library: '<rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8.5 3.5v17M12 8.5h4M12 12h4"/>',
    more: '<circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  const FONT = 'font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif';
  // Collapsed, the dock is a bookmark tab tucked into the bottom edge (it
  // rests 5px below the edge and rises on hover), or a small floating
  // bookmark wherever it was dragged; open, an icon-only toolbar in the same
  // place (16px above the edge when tucked). Drag either by any part of it.
  const CSS = `
    :host{all:initial}
    .dock{position:fixed;box-sizing:border-box;touch-action:none;user-select:none;-webkit-user-select:none;max-width:calc(100vw - 32px);display:flex;align-items:center;gap:2px;padding:4px;background:#0f1011;color:#d6d8db;
      border:1px solid #1d1f22;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.35);${FONT};animation:fk-open .16s ease-out}
    .dock[data-mode="collapsed"]{padding:0;border-radius:12px;animation:fk-pop .16s ease-out}
    .tucked[data-mode="collapsed"]{border-bottom:0;border-radius:12px 12px 0 0;box-shadow:0 -4px 16px rgba(0,0,0,.2);
      transform:translateY(5px);transition:transform .15s ease;animation:fk-tab .2s ease-out}
    .tucked[data-mode="collapsed"]:hover,.tucked[data-mode="collapsed"]:focus-within{transform:none}
    .dock.dragging{transition:none;cursor:grabbing}
    .dock.dragging button{cursor:grabbing}
    .dock[hidden],[hidden]{display:none!important}
    button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;min-width:36px;padding:0 12px;border-radius:10px;
      cursor:pointer;color:inherit;white-space:nowrap;transition:background-color .12s ease,color .12s ease}
    button:hover{background:#1a1b1e;color:#f7f8f8}
    button:focus-visible{outline:2px solid #4cc38a;outline-offset:1px}
    button[aria-pressed="true"]{background:#163426;color:#4cc38a}
    .actions button[aria-expanded="true"]{background:#1a1b1e;color:#f7f8f8}
    .pill{width:44px;height:36px;padding:0;border-radius:11px}
    .tucked .pill{height:32px;padding:0 0 5px;border-radius:12px 12px 0 0}
    .actions{display:flex;align-items:center;gap:2px}
    .actions button{width:36px;padding:0}
    .status{padding:0 10px;color:#8a8f98;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .status[data-tone="ok"]{color:#4cc38a}.status[data-tone="error"]{color:#f28b82}
    .signin{display:flex;flex-direction:column;align-items:stretch;gap:2px}
    .signin button{color:#f7f8f8}
    .waiting{padding:8px 10px 2px;color:#8a8f98;max-width:260px;white-space:normal;line-height:1.35}
    .menu{position:absolute;bottom:48px;right:0;display:flex;flex-direction:column;min-width:220px;padding:4px;background:#0f1011;border:1px solid #1d1f22;border-radius:14px;
      box-shadow:0 8px 28px rgba(0,0,0,.35)}
    .menu.below{bottom:auto;top:48px}
    .menu.start{right:auto;left:0}
    .menu button{width:100%;justify-content:flex-start}
    .tip{position:fixed;padding:6px 9px;background:#1c1d21;color:#f7f8f8;border:1px solid #2a2c31;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.3);
      font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;pointer-events:none;animation:fk-tip .12s ease-out}
    .note-card{position:fixed;width:320px;border:0;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.35);background:transparent;color-scheme:normal}
    .toast{position:fixed;display:flex;align-items:center;gap:0;padding:2px 2px 2px 12px;background:#0f1011;color:#d6d8db;border:1px solid #1d1f22;border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,.35);${FONT};white-space:nowrap;transition:opacity .2s ease}
    .toast .saved{color:#4cc38a}
    .toast .sep{color:#8a8f98;padding:0 2px 0 6px}
    .toast button{height:30px;padding:0 10px;color:#f7f8f8}
    .toast.fading{opacity:0}
    .flash{position:fixed;pointer-events:none;background:rgba(76,195,138,.5);border-radius:2px;animation:foundkeep-flash 1s ease-in forwards}
    @keyframes foundkeep-flash{0%,35%{opacity:1}100%{opacity:0}}
    @keyframes fk-open{from{opacity:0;transform:translateY(6px)}}
    @keyframes fk-tab{from{transform:translateY(100%)}}
    @keyframes fk-pop{from{opacity:0;transform:scale(.9)}}
    @keyframes fk-tip{from{opacity:0;transform:translateY(2px)}}
    .card{position:fixed;width:380px;border:0;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.4);background:transparent;color-scheme:normal}
    @media (prefers-reduced-motion:reduce){.dock,.toast,.tip,button{transition:none;animation:none}.flash{animation:none;opacity:.8}}`;

  // ---------------------------------------------------------------------------
  // Markup
  // ---------------------------------------------------------------------------
  const host = document.createElement('foundkeep-dock');
  host.style.cssText = 'all:initial;position:fixed;inset:auto;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'closed' });
  // Icon-only controls: aria-label names each one, data-tip is the tooltip.
  const tool = (action, tip, extra = '') => `<button data-action="${action}" aria-label="${tip}" data-tip="${tip}"${extra}>${svg(action)}</button>`;
  root.innerHTML = `<style>${CSS}</style>
    <div class="dock" hidden role="toolbar" aria-label="FoundKeep">
      <button class="pill" data-action="expand" aria-label="Open FoundKeep" aria-expanded="false">${svg('mark')}</button>
      <div class="actions" hidden>
        ${tool('savepage', 'Save this page')}
        ${tool('highlight', 'Highlight text to save it', ' aria-pressed="false"')}
        ${tool('screenshot', 'Take a screenshot')}
        ${tool('note', 'Write a note', ' aria-expanded="false"')}
        ${tool('library', 'Open your library')}
        ${tool('more', 'More options', ' aria-haspopup="menu" aria-expanded="false"')}
      </div>
      <div class="signin" hidden><span class="waiting" hidden></span><button data-action="sign-in">${svg('mark')}Sign in to save</button></div>
      <span class="status" role="status" hidden></span>
      <div class="menu" data-menu="more" role="menu" hidden>
        <button data-action="always-on" role="menuitem">Show on every site</button>
        <button data-action="site" role="menuitem">Hide on this site</button>
        <button data-action="import" role="menuitem">Import browser bookmarks</button>
        <button data-action="settings" role="menuitem">Settings ↗</button></div>
      <div class="local" hidden><span class="status"></span><button data-action="local-move">Move to My library</button><button data-action="local-later">Later</button></div>
    </div>
    <div class="toast" role="status" hidden><span class="saved">${SAVED_TEXT}</span><span class="sep" aria-hidden="true"> · </span><button data-action="details">Add details</button></div>
    <div class="tip" aria-hidden="true" hidden></div>
    <div class="flashes"></div>`;
  const $ = selector => root.querySelector(selector);
  const dockEl = $('.dock'), toastEl = $('.toast'), tipEl = $('.tip');
  let mode = 'hidden', dockState = null, frame = null, readyTimer = 0, dockReady = null, hello = 'pending';
  let highlighting = false, lastHighlight = null, flashCount = 0, toastTimer = 0, capturing = false, noteFrame = null, noteTimer = 0;
  let tipTimer = 0, tipFor = null, tipWarmUntil = 0;
  // Where the dock sits: null (the default, tucked into the bottom edge 16px
  // from the right) or { side, dx, tucked, fy } — the near edge ('left' or
  // 'right') and the gap to it as a fraction of the width, and either tucked
  // into the bottom edge or centred at fy of the height. Kept by the
  // background (dock-position), never in this page.
  let anchor = null, drag = null, suppressClick = false;

  const send = message => chrome.runtime.sendMessage(message).catch(() => null);

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const isOpen = () => mode === 'expanded' || mode === 'details';
  function render() {
    dockEl.hidden = mode === 'hidden';
    dockEl.dataset.mode = mode;
    const open = isOpen();
    const connected = !!dockState?.connected;
    // The bookmark tab is the collapsed dock; open, the toolbar replaces it.
    $('.pill').hidden = open;
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
  function closeMenus() { for (const menu of root.querySelectorAll('.menu')) menu.hidden = true; $('[data-action="more"]').setAttribute('aria-expanded', 'false'); }
  function status(text, tone = '') {
    const el = $('.dock > .status'); el.hidden = !text; el.textContent = text; el.dataset.tone = tone;
    place(); // the dock's width changed: move what sits next to it
  }
  const EDGE = 16, SNAP = 32;
  const where = () => anchor || { side: 'right', dx: EDGE / innerWidth, tucked: true, fy: null };
  function place() {
    if (dockEl.hidden) { toastEl.hidden = true; return; }
    if (!drag?.moving) {
      // Layout size (offset*), not the box: an animation may be scaling it.
      const a = where(); dockEl.classList.toggle('tucked', a.tucked);
      const w = dockEl.offsetWidth, h = dockEl.offsetHeight, gap = a.dx * innerWidth;
      const left = Math.min(Math.max(0, a.side === 'right' ? innerWidth - gap - w : gap), Math.max(0, innerWidth - w));
      dockEl.style.left = left + 'px';
      if (a.tucked && mode === 'collapsed') { dockEl.style.top = 'auto'; dockEl.style.bottom = '0'; }
      else {
        const top = a.tucked ? innerHeight - EDGE - h : a.fy * innerHeight - h / 2;
        dockEl.style.bottom = 'auto'; dockEl.style.top = Math.min(Math.max(0, top), Math.max(0, innerHeight - h)) + 'px';
      }
      // The ⋯ menu opens away from the nearest edges.
      const d = dockBox();
      for (const menu of root.querySelectorAll('.menu')) { menu.classList.toggle('below', d.top < 220); menu.classList.toggle('start', a.side === 'left'); }
    }
    placeAttached();
  }
  // What opens next to the dock follows it, even mid-drag.
  function placeAttached() {
    if (frame) placeCard();
    if (noteFrame) placeNote();
    if (!toastEl.hidden) placeToast();
  }
  const shown = el => !!el && el.getClientRects().length > 0;
  // The dock's vertical slide (appearing, or the tab's hover lift) right now.
  const shift = () => new DOMMatrixReadOnly(getComputedStyle(dockEl).transform).m42 || 0;
  // Where the dock rests, from the position it was given and its layout size
  // — never mid-animation — so a toast placed while it slides or pops in
  // never ends up over it.
  function dockBox() {
    const w = dockEl.offsetWidth, h = dockEl.offsetHeight, left = parseFloat(dockEl.style.left) || 0;
    const top = dockEl.style.top === 'auto' ? innerHeight - h : parseFloat(dockEl.style.top) || 0;
    return { left, right: left + w, top, bottom: top + h };
  }
  // Cards, the note field and the toast line up with the dock's outer side.
  const alignX = (d, width) => Math.min(Math.max(8, where().side === 'left' ? d.left : d.right - width), innerWidth - width - 8);
  // Where a dock box of this size and position should stay: its nearer side,
  // and tucked if its bottom is within `snap` of the bottom edge.
  function anchorFor(box, snap) {
    const side = box.left + box.width / 2 > innerWidth / 2 ? 'right' : 'left';
    const dx = Math.max(0, side === 'right' ? innerWidth - box.left - box.width : box.left) / innerWidth;
    const tucked = box.top + box.height >= innerHeight - snap;
    return { side, dx, tucked, fy: tucked ? null : Math.min(Math.max(0, (box.top + box.height / 2) / innerHeight), 1) };
  }
  function setAnchor(next) {
    anchor = next; place();
    // The dock cannot touch chrome.storage (it would sit next to account
    // credentials); the background keeps where it sits.
    void send(next ? { kind: 'dock-position', anchor: next } : { kind: 'dock-position', reset: true });
  }
  // Keyboard focus lands on the tab when collapsed, else the first control.
  function focusHome() {
    const target = [$('.pill'), ...root.querySelectorAll('.actions > button, .signin > button')].find(shown);
    target?.focus({ preventScroll: true });
  }
  function setMode(next) {
    // Keep keyboard focus inside the dock when it was there already; never
    // pull it away from the page (e.g. when the dock collapses by itself).
    const hadFocus = !!root.activeElement;
    mode = next; hideTip();
    // The tab has no room for a message, and it would be stale on reopening.
    if (!isOpen()) status('');
    render();
    if (hadFocus && next !== 'hidden' && (next === 'collapsed' || !shown(root.activeElement))) focusHome();
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
    const d = dockBox(), h = Math.min(Number(noteFrame.dataset.height || 132), innerHeight - 24);
    noteFrame.style.height = h + 'px';
    noteFrame.style.left = alignX(d, 320) + 'px';
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
    const d = dockBox(), t = toastEl.getBoundingClientRect();
    const above = d.top - t.height - 8;
    toastEl.style.left = alignX(d, t.width) + 'px';
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
    const d = dockBox(), h = Number(frame.dataset.height || 420);
    const height = Math.min(h, innerHeight - 24);
    const left = alignX(d, 380);
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
  // M4: a card that had keyboard focus hands it back to the dock when it
  // closes, instead of dropping it on the page's <body>.
  function closeCard(notify = true) {
    clearTimeout(readyTimer);
    if (!frame) return;
    const focused = root.activeElement === frame;
    frame.remove(); frame = null;
    if (notify) void send({ kind: 'dock-details-closed' });
    if (focused) focusHome();
  }

  // ---------------------------------------------------------------------------
  // Input — trusted user input only: a page script cannot synthesize a save.
  // ---------------------------------------------------------------------------
  root.addEventListener('click', event => {
    if (!event.isTrusted) return;
    hideTip();
    if (suppressClick) { suppressClick = false; return; } // the end of a drag, not a click
    const button = event.target.closest?.('button[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'expand') return void setMode(mode === 'collapsed' ? 'expanded' : mode === 'details' ? 'details' : 'collapsed');
    if (action === 'more') { const menu = $('[data-menu="more"]'); const open = menu.hidden; closeMenus(); menu.hidden = !open; button.setAttribute('aria-expanded', String(open)); return; }
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
  // ---------------------------------------------------------------------------
  // Tooltips: each icon-only control says what it does on hover (after a
  // short delay, then at once while moving along the toolbar) and on
  // keyboard focus. Never over a menu, card or note field above the dock.
  // ---------------------------------------------------------------------------
  const TIP_DELAY = 450, TIP_WARM = 500;
  function tipText(button) {
    if (button.dataset.action === 'highlight' && highlighting) return 'Stop highlighting';
    if (button.dataset.action === 'note' && composing()) return 'Close note';
    return button.dataset.tip;
  }
  function showTip(button, now = false) {
    if (tipFor === button) return;
    clearTimeout(tipTimer); tipFor = button;
    const open = () => {
      if (!isOpen() || !shown(button) || frame || noteFrame || !$('[data-menu="more"]').hidden) return hideTip();
      tipEl.textContent = tipText(button); tipEl.hidden = false;
      const b = button.getBoundingClientRect(), t = tipEl.getBoundingClientRect(), top = b.top - shift();
      tipEl.style.left = Math.min(Math.max(8, b.left + b.width / 2 - t.width / 2), innerWidth - t.width - 8) + 'px';
      tipEl.style.top = (top - t.height - 8 >= 8 ? top - t.height - 8 : b.bottom + 8) + 'px';
    };
    if (now || Date.now() < tipWarmUntil) open(); else tipTimer = setTimeout(open, TIP_DELAY);
  }
  function hideTip() {
    clearTimeout(tipTimer); tipFor = null;
    if (!tipEl.hidden) tipWarmUntil = Date.now() + TIP_WARM;
    tipEl.hidden = true;
  }
  root.addEventListener('pointerover', event => {
    const button = event.isTrusted && event.pointerType !== 'touch' && event.target.closest?.('[data-tip]');
    if (button) showTip(button);
  });
  root.addEventListener('pointerout', event => {
    const button = event.target.closest?.('[data-tip]');
    if (button && !button.contains(event.relatedTarget)) hideTip();
  });
  root.addEventListener('focusin', event => {
    const button = event.target.closest?.('[data-tip]');
    if (button?.matches(':focus-visible')) showTip(button, true); else hideTip();
  });
  root.addEventListener('focusout', hideTip);
  // Drag: press anywhere on the dock and move past a small threshold; a press
  // that doesn't move is still a click. Dropped within SNAP of the bottom
  // edge it tucks back in; anywhere else it floats there.
  // A press is followed on the window (the pointer leaves a 44px tab at
  // once); capturing it on the dock right away would retarget the click.
  dockEl.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (!event.isTrusted || event.button !== 0 || drag || event.target.closest?.('.menu')) return;
    const d = dockBox();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: event.clientX - d.left, dy: event.clientY - d.top, moving: false };
    addEventListener('pointermove', dragMove, true);
    addEventListener('pointerup', endDrag, true);
    addEventListener('pointercancel', endDrag, true);
  });
  function dragMove(event) {
    if (!drag || !event.isTrusted || event.pointerId !== drag.id) return;
    if (!drag.moving) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
      drag.moving = true; dockEl.setPointerCapture(drag.id);
      hideTip(); closeMenus(); dockEl.classList.add('dragging'); dockEl.classList.remove('tucked');
    }
    const w = dockEl.offsetWidth, h = dockEl.offsetHeight;
    const left = Math.min(Math.max(0, event.clientX - drag.dx), Math.max(0, innerWidth - w));
    const top = Math.min(Math.max(0, event.clientY - drag.dy), Math.max(0, innerHeight - h));
    dockEl.style.bottom = 'auto'; dockEl.style.left = left + 'px'; dockEl.style.top = top + 'px';
    placeAttached();
  }
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    removeEventListener('pointermove', dragMove, true);
    removeEventListener('pointerup', endDrag, true);
    removeEventListener('pointercancel', endDrag, true);
    const moved = drag.moving; drag = null;
    if (!moved) return;
    dockEl.classList.remove('dragging');
    if (dockEl.hasPointerCapture(event.pointerId)) dockEl.releasePointerCapture(event.pointerId);
    const d = dockBox();
    setAnchor(anchorFor({ left: d.left, top: d.top, width: d.right - d.left, height: d.bottom - d.top }, SNAP));
    // The click that follows this pointerup belongs to the drag.
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  }
  // Keyboard: with the tab focused, arrows move it 16px (Shift: 64px) and
  // Home puts it back in its corner.
  $('.pill').addEventListener('keydown', event => {
    if (!event.isTrusted) return;
    if (event.key === 'Home') { event.preventDefault(); return void setAnchor(null); }
    const step = event.shiftKey ? 64 : 16;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const d = dockBox(), width = d.right - d.left, height = d.bottom - d.top;
    const left = Math.min(Math.max(0, d.left + delta[0]), innerWidth - width), top = Math.min(Math.max(0, d.top + delta[1]), innerHeight - height);
    setAnchor(anchorFor({ left, top, width, height }, 1));
  });
  // Esc closes the innermost thing first: the note field, then highlighter
  // mode, then the expanded dock.
  document.addEventListener('keydown', event => {
    if (!event.isTrusted || event.key !== 'Escape') return;
    hideTip();
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
            // The collapsed tab has no room for a message: open the toolbar.
            if (mode === 'hidden' || mode === 'collapsed') setMode('expanded');
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
    position: () => { const r = dockBox(); return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) }; },
    anchor: () => anchor,
    rect: selector => { const r = root.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 }; },
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
        boxes: [...root.querySelectorAll('.dock, .toast, .menu, .tip, .card, .note-card, .flash')].map(box).filter(r => r.width && r.height),
        frames: [...root.querySelectorAll('iframe')].map(f => ({ src: f.src, ...box(f) })),
      };
    },
  };
  document.documentElement.append(host);
  // helloRequest keeps its own .then so a reply that arrives after
  // dockReady's 2s bound still updates dockState and re-renders.
  void send({ kind: 'dock-position' }).then(stored => { anchor = stored || null; place(); });
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

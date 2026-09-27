(() => {
  if (window.top !== window || window.__foundkeepDock) return;
  const EDGE = 16;
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
  let mode = 'hidden', dockState = null, frame = null, readyTimer = 0, collapseTimer = 0, dockReady = null;
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
  // Shared by place() (render) and setPosition() (what gets persisted) so
  // the two can never clamp differently.
  function clamp(left, top) {
    const { w, h } = size();
    return { left: Math.min(Math.max(0, left), Math.max(0, innerWidth - w)), top: Math.min(Math.max(0, top), Math.max(0, innerHeight - h)) };
  }
  function place() {
    if (dockEl.hidden) return;
    const { w, h } = size();
    const raw = pos ? { left: pos.fx * innerWidth, top: pos.fy * innerHeight } : { left: innerWidth - w - EDGE, top: innerHeight - h - EDGE };
    const { left, top } = clamp(raw.left, raw.top);
    dockEl.style.left = left + 'px'; dockEl.style.top = top + 'px';
    if (frame) placeCard();
  }
  function setPosition(left, top, persist = true) {
    // Clamp before storing the fraction, not just before rendering: a drag
    // or arrow-key move that ends outside the viewport must persist where
    // the dock actually landed (the edge), not a fraction outside 0..1 that
    // the background's dock-position handler rejects — which silently drops
    // the update and leaves the previous (or default) position in storage.
    const clamped = clamp(left, top);
    pos = { fx: clamped.left / innerWidth, fy: clamped.top / innerHeight }; place();
    // The dock cannot touch chrome.storage directly (it would sit next to
    // account credentials); the background is the only trusted holder of
    // where the dock sits, so persistence goes through a message.
    if (persist) void send({ kind: 'dock-position', pos });
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
    const card = frame = document.createElement('iframe');
    card.className = 'card'; card.src = url; card.title = 'Review your FoundKeep save'; card.dataset.height = '420';
    // C1 / R16: review.html loads exactly once per card. A page can still
    // reach this frame (window.frames includes it, closed shadow root or
    // not) and navigate it; a second load means the card slot now shows
    // something other than review.html, so close it instead of framing it.
    let loads = 0;
    card.addEventListener('load', () => {
      if (frame !== card || ++loads < 2) return;
      closeReview(); setMode('expanded'); status('Review closed. Save again to reopen it.');
    });
    root.append(card); setMode('review'); placeCard();
    readyTimer = setTimeout(() => { closeReview(); setMode('expanded'); void send({ kind: 'dock-review-fallback' }); }, 3000);
  }
  // M4: a card that had keyboard focus hands it back to the pill when it
  // closes, instead of dropping it on the page's <body>.
  function closeReview() {
    clearTimeout(readyTimer);
    const focused = !!frame && root.activeElement === frame;
    frame?.remove(); frame = null;
    if (focused) $('.pill').focus({ preventScroll: true });
  }
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
    if (event.key === 'Home') { event.preventDefault(); pos = null; void send({ kind: 'dock-position', reset: true }); place(); }
  });
  document.addEventListener('keydown', event => {
    if (event.isTrusted && event.key === 'Escape' && mode === 'expanded') setMode('collapsed');
  }, true);
  document.addEventListener('pointerdown', event => {
    if (event.isTrusted && mode === 'expanded' && !event.composedPath().includes(host)) setMode('collapsed');
  }, true);
  document.addEventListener('fullscreenchange', () => { host.style.display = document.fullscreenElement ? 'none' : ''; });
  addEventListener('resize', place);
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.kind === 'dock-ping') { respond({ ok: true }); return; }
    switch (message?.kind) {
      // R1: the toolbar icon toggles the dock — collapse when already
      // expanded, but never while a review card is open.
      case 'dock-show': {
        if (message.toggle && mode === 'expanded') { setMode('collapsed'); break; }
        const apply = () => {
          if (mode === 'hidden') setMode(message.expand ? 'expanded' : 'collapsed');
          else if (message.expand && mode === 'collapsed') setMode('expanded');
        };
        // Product race (found chasing a flake in the x.com hide test):
        // summonDock() on an origin whose tab.url is redacted (x.com is
        // matched only by a static content_scripts entry, not
        // host_permissions — see dock-control.js) skips its usual
        // dock-state refresh, since it cannot safely recompute hiddenHere
        // without a trustworthy origin. On those origins the only source
        // of dockState is this script's own dock-hello round trip below,
        // which a fast external summonDock({expand:true}) call (e.g. from
        // an extension page immediately after injection) can win the race
        // against. Rendering 'expanded' while dockState is still null reads
        // connected as false and hides .actions entirely — an empty-looking
        // dock a real click can then land past, hitting document's
        // pointerdown-outside handler and collapsing it right back down.
        // Wait for the same dockReady promise dock-hello already set up
        // instead of rendering blind — but dockReady is bounded (see below):
        // a sleeping/restarting/erroring service worker must never leave a
        // toolbar-icon summon showing no dock at all.
        if (dockState) apply(); else void dockReady.then(apply);
        break;
      }
      case 'dock-collapse': if (mode === 'expanded') setMode('collapsed'); break;
      case 'dock-review-open': if (mode === 'hidden') setMode('expanded'); openReview(message.url); break;
      case 'dock-review-close': finishReview(message.saved === true); break;
      // C1 / R16: the card's ready/resize/done, relayed by the background
      // only after it verified the card belongs to this tab. There is no
      // window 'message' listener any more — the page shares that channel.
      case 'dock-review-frame': {
        if (!frame) break;
        // M4: move keyboard focus into the card (review.js puts it on its
        // first field) once it can actually take it.
        if (message.type === 'ready') { clearTimeout(readyTimer); frame.focus({ preventScroll: true }); }
        if (message.type === 'resize' && Number.isFinite(message.height)) { frame.dataset.height = String(Math.min(Math.max(160, message.height), 560)); placeCard(); }
        if (message.type === 'done') finishReview(message.saved === true);
        break;
      }
      case 'dock-hide': host.style.visibility = 'hidden'; break;
      case 'dock-unhide': host.style.visibility = ''; break;
      case 'dock-status': if (mode === 'hidden') setMode('expanded'); status(message.text || '', message.tone || ''); break;
      case 'dock-state': dockState = message.state; render(); break;
      // Fix round 1: a tab-URL-independent patch so every open dock updates
      // its ⋯ menu the moment always-on changes elsewhere (its own toggle,
      // dock-settings.html, or a permission revoked out from under it) —
      // never touches hiddenHere, which is per-origin and unrelated.
      case 'dock-always-on-changed': dockState = { ...dockState, alwaysOn: message.alwaysOn }; render(); break;
    }
  });

  window.__foundkeepDock = {
    state: () => mode,
    rect: selector => { const r = root.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 }; },
    position: () => { const r = dockEl.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top) }; },
    focused: () => root.activeElement?.className || root.activeElement?.dataset?.action || null,
    visible: () => host.style.visibility !== 'hidden' && host.style.display !== 'none',
    status: () => $('.dock > .status')?.textContent || '',
    text: selector => root.querySelector(selector)?.textContent ?? null,
  };
  document.documentElement.append(host);
  void send({ kind: 'dock-position' }).then(stored => { pos = stored || null; place(); });
  // hello is kept as its own variable (not fire-and-forget) so its .then
  // below is attached to the real request itself, not to the bounded
  // dockReady race further down — a reply that arrives late (after
  // dockReady's 2s bound already let 'dock-show' proceed with dockState
  // still null) must still land: it updates dockState and re-renders
  // whenever it actually shows up, however late that is.
  const hello = send({ kind: 'dock-hello' });
  hello.then(state => { if (!state) return; dockState = state; if (state.show && mode === 'hidden') setMode('collapsed'); else render(); });
  // Fix round 1: send()'s catch(() => null) only covers an outright
  // rejection — a service worker that's asleep, mid-restart, or wedged can
  // leave this round trip open indefinitely, which used to mean a
  // toolbar-icon summon (case 'dock-show' above) showed no dock at all.
  // dockReady now resolves on whichever comes first: the real reply, or a
  // 2s timeout with nothing. Either way 'dock-show' gets to render — with
  // dockState possibly still null, which renders the same signed-out/
  // limited view a genuinely disconnected account gets.
  dockReady = Promise.race([hello, new Promise(resolve => setTimeout(resolve, 2000))]);
})();

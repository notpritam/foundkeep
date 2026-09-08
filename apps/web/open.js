(() => {
  const raw = new URLSearchParams(location.search).get('path') || 'collection';
  const capture = /^capture\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const allowed = new Set(['login', 'register', 'recover', 'collection', 'settings', 'new-note']);
  const path = allowed.has(raw) || capture.test(raw) ? raw : 'collection';
  document.querySelector('#open-app').href = `foundkeep://${path}`;
  const browser = document.querySelector('#open-browser');
  browser.href = ['login', 'register', 'recover'].includes(path)
    ? `auth.html?mode=${path === 'register' ? 'signup' : path}`
    : 'dashboard.html';
})();

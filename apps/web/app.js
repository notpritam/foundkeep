const saveButton = document.querySelector('#demoSave');
const resetButton = document.querySelector('#demoReset');

function setDemoSaved(saved) {
  document.querySelector('#demoEmpty').hidden = saved;
  document.querySelector('#demoSaved').hidden = !saved;
  document.querySelector('#demoCount').textContent = saved ? '1 item' : '0 items';
  document.querySelector('#demo-selection').classList.toggle('is-saved', saved);
  saveButton.disabled = saved;
  document.querySelector('#demoStatus').textContent = saved
    ? 'Highlight saved in this illustration. Your Atlas library has not changed.'
    : 'Try it here. This demo does not save to your Atlas library.';
  // Move focus to the next useful action when its previous control disappears.
  (saved ? resetButton : saveButton).focus({ preventScroll: true });
}

saveButton?.addEventListener('click', () => setDemoSaved(true));
resetButton?.addEventListener('click', () => setDemoSaved(false));

document.querySelector('#copyExtensions')?.addEventListener('click', async () => {
  const status = document.querySelector('#copyStatus');
  try {
    await navigator.clipboard.writeText('chrome://extensions');
    status.textContent = 'Copied. Paste it into Chrome’s address bar.';
  } catch {
    status.textContent = 'Copy chrome://extensions from the step above and paste it into Chrome’s address bar.';
  }
});

// A Web Store install button is shown only when a verified public listing is configured.
import('./customer.js?v=1.5.0').then(({ customerConfig }) => customerConfig()).then(config => {
  if (!config.storeUrl) return;
  const install = document.querySelector('[data-extension-install]');
  if (!install) return;
  install.href = config.storeUrl;
  install.removeAttribute('download');
  install.target = '_blank';
  install.rel = 'noopener noreferrer';
  install.textContent = 'Add to Chrome';
  document.querySelector('.download-note').textContent = 'Chrome on your computer · Chrome Web Store · Manual ZIP installation also available below';
  const manual = document.createElement('a');
  manual.href = 'atlas-extension.zip'; manual.download = 'atlas-extension.zip';
  manual.className = 'text-link local-install-choice'; manual.textContent = 'Download ZIP for manual installation';
  install.after(manual);
}).catch(() => { /* Manual ZIP installation remains available without configuration. */ });

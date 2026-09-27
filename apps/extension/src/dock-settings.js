import { applyAlwaysOn } from './dock-control.js';

document.getElementById('enable').addEventListener('click', async () => {
  const result = document.getElementById('result');
  try {
    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
    const on = granted && await applyAlwaysOn(true);
    result.textContent = on
      ? 'The dock now appears on every site. You can hide it per site from its menu.'
      : 'Permission was not granted. The dock still appears when you click the FoundKeep icon.';
    if (on) setTimeout(() => window.close(), 1500);
  } catch (error) {
    result.textContent = 'Something went wrong turning this on: ' + (error?.message || 'Please try again.');
  }
});
document.getElementById('cancel').addEventListener('click', () => window.close());

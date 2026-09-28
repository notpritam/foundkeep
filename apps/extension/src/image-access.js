// The fallback for a right-click image save whose permission prompt Chrome
// could not show from the service worker: a real click here asks for the
// image's site, then the background completes the save (dock-control.js).
const $ = id => document.getElementById(id);
let origin = null, busy = false;
const say = (text, state = '') => { $('result').textContent = text; $('result').dataset.state = state; };

chrome.runtime.sendMessage({ kind: 'image-access-get' }).then(result => {
  if (!result?.ok) throw new Error(result?.error);
  origin = result.origin;
  $('imageOrigin').textContent = new URL(origin).host;
  $('allow').disabled = false;
}).catch(() => say('This request is no longer available. Right-click the image and choose Save image again.', 'error'));

$('allow').addEventListener('click', async () => {
  if (!origin || busy) return;
  busy = true; $('allow').disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
    say(granted ? 'Saving…' : 'Access was not allowed, so the image was not saved.', granted ? '' : 'error');
    const result = await chrome.runtime.sendMessage({ kind: 'image-access-done', granted });
    if (!granted) { setTimeout(() => window.close(), 1500); return; }
    if (!result?.ok) throw new Error(result?.error || 'FoundKeep could not save this image. Try again.');
    window.close();
  } catch (error) {
    say(error.message, 'error');
  } finally { busy = false; }
});
$('cancel').addEventListener('click', () => { void chrome.runtime.sendMessage({ kind: 'image-access-done', granted: false }).finally(() => window.close()); });

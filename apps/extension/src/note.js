// The dock's note field (note.html). Framed by the dock inside the page, but
// an extension page: the page cannot read keystrokes typed here, script it,
// or see its messages. It talks to the dock only through the background,
// which checks this frame's grant for `tabId` (capture-details.js).
const $ = id => document.getElementById(id);
const tabId = Number(new URLSearchParams(location.search).get('tab'));
const text = $('noteText'), feedback = $('noteFeedback');
let saving = false, finished = false;

// Never window.parent.postMessage: the parent is the web page.
const post = data => void chrome.runtime.sendMessage({ kind: 'note-frame', tabId, ...data }).catch(() => {});
function finish(saved) {
  if (finished) return;
  finished = true;
  post({ type: 'done', saved });
}
function say(value, state = '') { feedback.textContent = value; feedback.dataset.state = state; }

text.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); if (!saving) finish(false); return; }
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  // A held key auto-repeats, and a quick second press can land while the
  // first save is still running: one Enter, one note.
  if (event.repeat || saving || finished || !text.value.trim()) return;
  saving = true; text.readOnly = true; say('Saving…');
  void chrome.runtime.sendMessage({ kind: 'note-save', tabId, text: text.value })
    .then(result => {
      if (!result?.ok) throw new Error(result?.error || 'FoundKeep could not save this note. Try again.');
      say(''); finish(true);
    })
    .catch(error => { say(error.message, 'error'); saving = false; text.readOnly = false; text.focus(); });
});
new ResizeObserver(() => post({ type: 'resize', height: Math.ceil($('noteForm').getBoundingClientRect().height) })).observe($('noteForm'));
window.addEventListener('focus', () => { if (!text.disabled) text.focus({ preventScroll: true }); });
// Ready once the background confirms this frame's grant; the dock then moves
// keyboard focus into it.
void chrome.runtime.sendMessage({ kind: 'note-open', tabId }).then(result => {
  if (!result?.ok) throw new Error(result?.error);
  text.disabled = false;
  $('noteForm').dataset.ready = 'true';
  text.focus({ preventScroll: true });
  post({ type: 'ready' });
}).catch(() => say('This note field is no longer available. Choose Note in the FoundKeep dock again.', 'error'));

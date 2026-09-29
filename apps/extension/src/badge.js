// Feedback on the toolbar icon: a short badge flash (no notifications
// permission needed). Used when the dock cannot show a result — a page it
// cannot run on, or a site where it is hidden ("Hide on this site").
import { getEffectivePreferences } from './preferences.js';

export async function flash(ok, label) {
  await chrome.action.setBadgeBackgroundColor({ color: ok ? '#0d7a50' : '#ad3b35' });
  await chrome.action.setBadgeText({ text: ok ? '✓' : '!' });
  if (!ok && label) console.error('[atlas]', label);
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}
/** Errors always flash; success only when the success-feedback preference is on. */
export async function configuredFlash(ok, label) {
  const success = await getEffectivePreferences().then(state => state.preferences.feedback.success, () => true);
  if (!ok || success) await flash(ok, label);
}

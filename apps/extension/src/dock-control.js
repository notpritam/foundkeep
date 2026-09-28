import { CUSTOMER_ORIGIN } from './product.js';
import { captureBinding, getCloudStatus, importLocalCaptures } from './cloud.js';
import { drainQueue } from './capture.js';
import { getEffectivePreferences, capturePreferenceKey, captureDisabledMessage } from './preferences.js';
import { performCapture } from './capture-actions.js';
import { rememberSave, grantDetails, revokeDetails } from './capture-details.js';

const HIDDEN_KEY = 'foundkeep-dock-hidden-origins', ALWAYS_KEY = 'foundkeep-dock-always-on', LOCAL_KEY = 'foundkeep-dock-local-prompt';
// R10: the dock content script can never touch chrome.storage (it sits next
// to account credentials); this is the one background-side holder of where
// the dock sits on screen, reached only through the dock-position message.
const DOCK_POSITION_KEY = 'foundkeep-dock-position';
const DOCK_FILE = 'src/dock/dock.js';
// Task 5: the opt-in "show on every site" content script — registered only
// while chrome.permissions.contains({origins:['<all_urls>']}) is true, since
// the optional_host_permissions grant (requested from dock-settings.html;
// content scripts cannot request permissions themselves) is what actually
// lets it run anywhere. persistAcrossSessions:true keeps the registration
// across browser restarts without needing to re-run reconcileAlwaysOn — that
// still runs on onStartup/onInstalled/permissions.onRemoved to unregister it
// again if the permission was ever revoked out from under it.
const REGISTRATION = { id: 'foundkeep-dock', matches: ['http://*/*', 'https://*/*'], js: [DOCK_FILE], runAt: 'document_idle', allFrames: false, persistAcrossSessions: true };
// Fix round 1: a dock already open when always-on is toggled (from its own
// ⋯ menu, or from dock-settings.html) has no other way to learn the value
// changed — nothing re-sends it a full dock-state, and the toggle itself
// only opens a popup or flips storage. Push a tiny, tab-URL-independent
// patch to every open tab instead of waiting for the next dock-hello/reload.
// chrome.tabs.* is available from both the background and an extension page
// (applyAlwaysOn runs in dock-settings.html's own page context when the
// permission prompt succeeds there), so this works from either caller.
async function notifyAlwaysOnChanged(alwaysOn) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(t => chrome.tabs.sendMessage(t.id, { kind: 'dock-always-on-changed', alwaysOn }).catch(() => {})));
}
export async function applyAlwaysOn(enabled) {
  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  const on = enabled && granted;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [REGISTRATION.id] });
  if (on && !existing.length) await chrome.scripting.registerContentScripts([REGISTRATION]);
  if (!on && existing.length) await chrome.scripting.unregisterContentScripts({ ids: [REGISTRATION.id] });
  const previous = (await chrome.storage.local.get(ALWAYS_KEY))[ALWAYS_KEY] === true;
  await chrome.storage.local.set({ [ALWAYS_KEY]: on });
  if (on !== previous) await notifyAlwaysOnChanged(on);
  return on;
}
export async function reconcileAlwaysOn() {
  await applyAlwaysOn((await chrome.storage.local.get(ALWAYS_KEY))[ALWAYS_KEY] === true);
}
export const dashboardUrl = path => CUSTOMER_ORIGIN + path;
const scriptable = url => /^https?:\/\//i.test(url || '') && !/^https:\/\/chromewebstore\.google\.com\//.test(url) && !/^https:\/\/chrome\.google\.com\/webstore/.test(url);
const originOf = url => { try { return new URL(url).origin; } catch { return null; } };

// `originHint` is `sender.url` when a message triggered this (the top-frame
// content script's own URL, always visible) — pages matched only by a
// content_scripts entry and not host_permissions (x.com) have their tab.url
// redacted by chrome.tabs.get/query, so falling back to tab?.url only helps
// when there is no sender (summonDock's own chrome.tabs.get lookup).
export async function dockState(tab, originHint) {
  const [{ preferences }, cloud, stored] = await Promise.all([getEffectivePreferences(), getCloudStatus(), chrome.storage.local.get([HIDDEN_KEY, ALWAYS_KEY, LOCAL_KEY])]);
  const hidden = stored[HIDDEN_KEY] || [], origin = originOf(originHint ?? tab?.url);
  const hiddenHere = !!origin && hidden.includes(origin), alwaysOn = stored[ALWAYS_KEY] === true;
  const later = stored[LOCAL_KEY]?.laterUntil || 0;
  const c = preferences.capture;
  const connected = cloud.status === 'connected' && !!cloud.account?.id;
  return {
    connected,
    actions: { savepage: c.bookmark, highlight: c.highlight, region: c.region, fullpage: c.fullPage, note: c.note },
    // "Later" only snoozes the signed-in move prompt; a signed-out dock always
    // says how many saves are waiting for an account (I5).
    alwaysOn, hiddenHere, localOnly: connected && Date.now() < later ? 0 : cloud.localOnly || 0, show: alwaysOn && !hiddenHere,
  };
}
// A dock that is already there answers a ping; this works on x.com and on
// always-on pages, where the extension may lack a scripting grant.
const hasDock = tabId => chrome.tabs.sendMessage(tabId, { kind: 'dock-ping' }).then(r => r?.ok === true, () => false);
export async function summonDock(tabId, { expand = false, toggle = false } = {}) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return false;
  // x.com is matched by a static content_scripts entry, not host_permissions,
  // so chrome.tabs.get() redacts tab.url there — scriptable(tab.url) would
  // always read as false and skip a dock that is already on the page. Ping
  // first; only fall back to checking scriptability (and injecting) when no
  // dock answers.
  if (!await hasDock(tabId)) {
    if (!scriptable(tab.url)) return false;
    try { await chrome.scripting.executeScript({ target: { tabId }, files: [DOCK_FILE] }); }
    catch { return false; }
  }
  // x.com redacts tab.url here (it's matched by a static content_scripts
  // entry, not host_permissions) — dockState(tab) would then compute a null
  // origin and say hiddenHere:false, overwriting the correct value dock.js
  // already has from its own dock-hello (which used sender.url). Only push
  // a fresh dock-state when the URL this background sees is trustworthy;
  // otherwise the dock keeps whatever origin-dependent state it already has.
  if (tab.url) await chrome.tabs.sendMessage(tabId, { kind: 'dock-state', state: await dockState(tab) }).catch(() => {});
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-show', expand, toggle }).catch(() => {});
  return true;
}
async function refreshState(tab, originHint) { await chrome.tabs.sendMessage(tab.id, { kind: 'dock-state', state: await dockState(tab, originHint) }).catch(() => {}); }
const GRANT_MESSAGE = 'Click the FoundKeep icon on this page to allow capture.';
const IMAGE_ACCESS_MESSAGE = 'Allow access to the image’s site to save its original file, then try again.';
// Everything except an X post and a note that leaves the page out reads or
// scripts the page itself (assertCaptureTab, executeScript).
const needsPage = (action, extra) => action !== 'tweet' && !(action === 'note' && !extra.attachPage);
async function tell(tab, message) {
  const shown = await summonDock(tab.id).catch(() => false);
  if (shown) await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => {});
  return shown;
}
// A right-click image save downloads the original from the image's own site,
// which needs that exact origin's permission. Ask inside the click that
// started the save (the context-menu event is the user gesture), before
// anything awaits. 'unavailable' means Chrome could not show the prompt here;
// the download is then attempted anyway (it works for images their site
// serves to any origin).
function requestImageAccess(srcUrl) {
  let origin;
  try { origin = new URL(srcUrl).origin + '/*'; } catch { return Promise.resolve('denied'); }
  try {
    return Promise.resolve(chrome.permissions.request({ origins: [origin] })).then(granted => granted ? 'granted' : 'denied', () => 'unavailable');
  } catch { return Promise.resolve('unavailable'); }
}
// Every capture saves instantly, straight into the connected account's
// library — no destination step first. Resolves { ok: true, capture } once
// the save is committed (the dock then offers "Add details"), { ok: false,
// cancelled: true } when a screenshot selection was cancelled, or { ok:
// false, error } when the capture could not run (disabled, signed out, no
// page grant) — callers decide what to do with that (the X button shows its
// error state). Either way the dock says what happened when it can.
export async function startCapture(tab, action, extra = {}) {
  const imageAccess = action === 'save-image' ? requestImageAccess(extra.info?.srcUrl) : null;
  let record;
  try {
    // M3: refuse a capture method turned off in preferences.
    const { preferences } = await getEffectivePreferences();
    if (!preferences.capture[capturePreferenceKey(action)]) throw new Error(captureDisabledMessage(action));
    if (!(await captureBinding()).cloudAccountId) throw new Error('Sign in to FoundKeep to save.');
    // M1: without host access or an activeTab grant (x.com before an icon
    // click: matched only by a static content_scripts entry) Chrome redacts
    // the tab's url and refuses scripting. Say what to do.
    if (needsPage(action, extra) && !(await chrome.tabs.get(tab.id).catch(() => null))?.url) throw new Error(GRANT_MESSAGE);
    const access = imageAccess ? await imageAccess : undefined;
    if (access === 'denied') throw new Error(IMAGE_ACCESS_MESSAGE);
    record = await performCapture(action, { tab, trigger: 'dock', ...extra, ...(access ? { imageAccess: access } : {}) });
  } catch (error) {
    const message = error?.message || 'FoundKeep could not save this. Try again.';
    await tell(tab, { kind: 'dock-status', text: message, tone: 'error' });
    return { ok: false, error: message };
  }
  // I1: a screenshot selection cancelled on the page (✕, Esc, or leaving the
  // tab) saves nothing; the dock says so in a neutral tone — never "Saved".
  if (!record) {
    await tell(tab, { kind: 'dock-status', text: 'Selection cancelled.', tone: '' });
    return { ok: false, cancelled: true };
  }
  await rememberSave(tab.id, record.id).catch(() => {});
  const shown = await tell(tab, { kind: 'dock-saved' });
  return { ok: true, shown, capture: { id: record.id, type: record.type, cloudStatus: record.cloudStatus } };
}
export async function handleDockMessage(msg, sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || sender.url?.startsWith(chrome.runtime.getURL(''))) return { ok: false };
  const tab = sender.tab;
  switch (msg.kind) {
    case 'dock-hello': return dockState(tab, sender.url);
    case 'dock-capture': {
      if (!['savepage', 'highlight', 'region', 'fullpage', 'note'].includes(msg.action)) return { ok: false };
      if (msg.action !== 'note') return startCapture(tab, msg.action);
      if (typeof msg.text !== 'string' || !msg.text.trim() || msg.text.length > 50000) return { ok: false, error: 'Write a note of up to 50,000 characters.' };
      const { preferences } = await getEffectivePreferences();
      return startCapture(tab, 'note', { text: msg.text, attachPage: preferences.notes.attachSource });
    }
    // "Add details" in the dock's Saved widget: frame the details card for
    // this tab's last save (capture-details.js grants it to this tab only).
    case 'dock-details': {
      const url = await grantDetails(tab.id);
      if (!url) {
        await chrome.tabs.sendMessage(tab.id, { kind: 'dock-status', text: 'That save is no longer available here.', tone: 'error' }, { frameId: 0 }).catch(() => {});
        return { ok: false };
      }
      await chrome.tabs.sendMessage(tab.id, { kind: 'dock-details-open', url }, { frameId: 0 });
      return { ok: true };
    }
    case 'dock-details-closed': await revokeDetails(tab.id); return { ok: true };
    case 'dock-open': {
      const target = { library: dashboardUrl('/dashboard'), settings: dashboardUrl('/dashboard/settings'), 'sign-in': dashboardUrl('/login'), import: chrome.runtime.getURL('src/import.html') }[msg.target];
      if (!target) return { ok: false };
      await chrome.tabs.create({ url: target, index: tab.index + 1 }); return { ok: true };
    }
    case 'dock-site': {
      const origin = originOf(sender.url); if (!origin) return { ok: false };
      const list = new Set((await chrome.storage.local.get(HIDDEN_KEY))[HIDDEN_KEY] || []);
      msg.hidden ? list.add(origin) : list.delete(origin);
      await chrome.storage.local.set({ [HIDDEN_KEY]: [...list] }); await refreshState(tab, sender.url); return { ok: true };
    }
    case 'dock-always-on': {
      // Content scripts cannot call chrome.permissions.request themselves —
      // that needs a page context, hence the small popup window. Turning it
      // off needs no such prompt, so it's applied directly.
      if (msg.enabled === true) {
        await chrome.windows.create({ url: chrome.runtime.getURL('src/dock-settings.html'), type: 'popup', width: 380, height: 320, focused: true });
        return { ok: true };
      }
      await applyAlwaysOn(false); await refreshState(tab, sender.url); return { ok: true };
    }
    case 'dock-local': {
      const cloud = await getCloudStatus();
      if (msg.choice === 'later') await chrome.storage.local.set({ [LOCAL_KEY]: { laterUntil: Date.now() + 7 * 86_400_000 } });
      else if (msg.choice === 'move' && cloud.account?.id) { await importLocalCaptures({ confirmed: true, accountId: cloud.account.id }); void drainQueue(); }
      else return { ok: false };
      await refreshState(tab); return { ok: true };
    }
    case 'dock-position': {
      // Only a genuine top-frame content script may read or write where the
      // dock sits — never an extension page, and never a subframe. This
      // never touches atlasCustomer or any other cloud/account storage key.
      if (msg.reset === true) {
        await chrome.storage.local.remove(DOCK_POSITION_KEY);
        return { ok: true };
      }
      if (msg.pos !== undefined) {
        const { fx, fy } = msg.pos || {};
        if (!Number.isFinite(fx) || !Number.isFinite(fy) || fx < 0 || fx > 1 || fy < 0 || fy > 1) return { ok: false };
        await chrome.storage.local.set({ [DOCK_POSITION_KEY]: { fx, fy } });
        return { ok: true };
      }
      const stored = await chrome.storage.local.get(DOCK_POSITION_KEY);
      return stored[DOCK_POSITION_KEY] || null;
    }
    default: return { ok: false };
  }
}

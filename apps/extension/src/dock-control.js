import { CUSTOMER_ORIGIN } from './product.js';
import { readSaveReview, stageSaveReview, clearSaveReview } from './save-review.js';
import { getCloudStatus, importLocalCaptures } from './cloud.js';
import { drainQueue } from './capture.js';
import { getEffectivePreferences, capturePreferenceKey, captureDisabledMessage } from './preferences.js';

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
// Resolves true once a review is actually showing — framed in the dock, or
// the fallback popup — and false if neither could open (M2).
export async function openReview(tab) {
  if (await summonDock(tab.id, { expand: true })) {
    const opened = await chrome.tabs.sendMessage(tab.id, { kind: 'dock-review-open', url: chrome.runtime.getURL('src/review.html?tab=' + tab.id) })
      .then(reply => reply?.ok === true, () => false);
    if (opened) return true;
  }
  return openFallbackReview(tab.id);
}
// nonce -> { tabId, popupTabId?, windowId? }. Kept in chrome.storage.session
// rather than a module-level Map: an MV3 service worker can be torn down and
// restarted by Chrome at any point (e.g. between opening the fallback popup
// and it being confirmed), which would silently wipe an in-memory Map;
// session storage survives that and is the same value regardless of which
// realm reads it. The nonce is generated and written *before*
// chrome.windows.create, then carried in the popup's own URL, so a slow
// write can never race the popup's first message — reviewTabFor only needs
// the entry to exist by the time it's asked about that exact nonce, which is
// guaranteed since nothing can know the nonce before this function picks it.
const POPUP_MAP_KEY = 'foundkeep-dock-popup-map';
async function popupMap() { return (await chrome.storage.session.get(POPUP_MAP_KEY))[POPUP_MAP_KEY] || {}; }
async function setPopupMap(map) { await chrome.storage.session.set({ [POPUP_MAP_KEY]: map }); }
async function findOpenPopup(tabId) {
  const map = await popupMap();
  let changed = false;
  let found = null;
  for (const [nonce, entry] of Object.entries(map)) {
    if (entry.tabId !== tabId) continue;
    const stillOpen = entry.popupTabId ? await chrome.tabs.get(entry.popupTabId).then(() => true, () => false) : true;
    if (stillOpen && !found) { found = entry; continue; }
    delete map[nonce]; changed = true;
  }
  if (changed) await setPopupMap(map);
  return found;
}
export async function openFallbackReview(tabId) {
  const existing = await findOpenPopup(tabId);
  if (existing) { if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {}); return true; }
  const nonce = crypto.randomUUID();
  const map = await popupMap();
  map[nonce] = { tabId };
  await setPopupMap(map);
  // review.html is use_dynamic_url in the manifest, and chrome.runtime.getURL()
  // returns that per-session dynamic-host form here. A framed load (openReview,
  // from a matching http(s) page's own content script) resolves that URL fine,
  // but chrome.windows.create has no such matching-page initiator and cannot
  // load the dynamic-host URL at all (the popup ends up on chrome-error://
  // chromewebdata) — so this one call site needs the plain extension-id URL.
  const url = `chrome-extension://${chrome.runtime.id}/src/review.html?tab=${tabId}&window=1&popup=${nonce}`;
  try {
    const win = await chrome.windows.create({ url, type: 'popup', width: 380, height: 560, focused: true });
    const fresh = await popupMap();
    if (fresh[nonce]) { fresh[nonce] = { tabId, popupTabId: win.tabs?.[0]?.id, windowId: win.id }; await setPopupMap(fresh); }
    return true;
  } catch {
    const fresh = await popupMap(); delete fresh[nonce]; await setPopupMap(fresh);
    return false;
  }
}
// Drop a popup's reservation once its tab closes — belt and suspenders for
// findOpenPopup's own liveness check, and keeps storage from accumulating
// entries for popups the user closed without confirming or cancelling.
chrome.tabs.onRemoved.addListener(async tabId => {
  const map = await popupMap();
  let changed = false;
  for (const [nonce, entry] of Object.entries(map)) if (entry.popupTabId === tabId) { delete map[nonce]; changed = true; }
  if (changed) await setPopupMap(map);
});
export async function reviewTabFor(sender) {
  // A framed card must belong to the tab it sits in; a popup must carry the
  // nonce openFallbackReview minted for that exact tab (unguessable, and
  // recorded before the popup could possibly have loaded far enough to ask).
  const url = new URL(sender.url), tab = Number(url.searchParams.get('tab'));
  if (!Number.isInteger(tab)) return null;
  if (url.searchParams.get('window') === '1') {
    const nonce = url.searchParams.get('popup');
    if (!nonce) return null;
    const map = await popupMap();
    return map[nonce]?.tabId === tab ? tab : null;
  }
  return sender.tab?.id === tab ? tab : null;
}
export async function withDockHidden(tabId, run) {
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-hide' }).catch(() => {});
  try { return await run(); } finally { await chrome.tabs.sendMessage(tabId, { kind: 'dock-unhide' }).catch(() => {}); }
}
async function refreshState(tab, originHint) { await chrome.tabs.sendMessage(tab.id, { kind: 'dock-state', state: await dockState(tab, originHint) }).catch(() => {}); }
const GRANT_MESSAGE = 'Click the FoundKeep icon on this page to allow capture.';
// Everything except an X post and a note that leaves the page out reads or
// scripts the page itself at confirm (assertCaptureTab, executeScript).
const needsPage = (action, extra) => action !== 'tweet' && !(action === 'note' && !extra.attachPage);
async function showError(tab, text) {
  await summonDock(tab.id, { expand: true })
    .then(shown => shown && chrome.tabs.sendMessage(tab.id, { kind: 'dock-status', text, tone: 'error' }).catch(() => {}))
    .catch(() => {});
}
// Returns { ok: true } once the review is open (framed or the fallback
// popup), or { ok: false, error } if the capture cannot start (disabled,
// no page grant, signed out, another review in progress, or no review could
// open) — the caller decides what to do with that (e.g. saveTweet forwards
// it so the X button's own error state still works). Either way the dock
// shows the error itself when it can.
export async function startCapture(tab, action, extra = {}) {
  try {
    // M3: refuse a capture method turned off in preferences now, not at Save.
    const { preferences } = await getEffectivePreferences();
    if (!preferences.capture[capturePreferenceKey(action)]) throw new Error(captureDisabledMessage(action));
    // M1: without host access or an activeTab grant (x.com before an icon
    // click: matched only by a static content_scripts entry) Chrome redacts
    // the tab's url and refuses scripting, so every page capture would fail
    // at confirm with "The page changed during capture…". Say what to do now.
    if (needsPage(action, extra) && !(await chrome.tabs.get(tab.id).catch(() => null))?.url) throw new Error(GRANT_MESSAGE);
    await stageSaveReview({ action, tab, trigger: 'dock', ...extra });
  } catch (error) {
    await showError(tab, error.message);
    // M2: the draft in the way may have no visible review left (its popup
    // closed with the window's X, or an earlier open failed) — bring it back
    // instead of blocking every capture on this tab until it expires.
    if (error.code === 'review-in-progress') await openReview(tab).catch(() => false);
    return { ok: false, error: error.message };
  }
  if (!await openReview(tab).catch(() => false)) {
    // Nobody can see this draft; don't let it block the next capture.
    await clearSaveReview(tab.id).catch(() => {});
    const message = 'FoundKeep could not open the save review. Try again.';
    await showError(tab, message);
    return { ok: false, error: message };
  }
  return { ok: true };
}
export async function handleDockMessage(msg, sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || sender.url?.startsWith(chrome.runtime.getURL(''))) return { ok: false };
  const tab = sender.tab;
  switch (msg.kind) {
    case 'dock-hello': {
      const state = await dockState(tab, sender.url);
      if (await readSaveReview(tab.id)) void openReview(tab).catch(() => {});
      return state;
    }
    case 'dock-capture': {
      if (!['savepage', 'highlight', 'region', 'fullpage', 'note'].includes(msg.action)) return { ok: false };
      const { preferences } = await getEffectivePreferences();
      const extra = msg.action === 'note' ? { text: '', attachPage: preferences.notes.attachSource } : {};
      return startCapture(tab, msg.action, extra);
    }
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
    case 'dock-review-fallback': if (await readSaveReview(tab.id)) await openFallbackReview(tab.id); return { ok: true };
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

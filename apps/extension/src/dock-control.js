import { CUSTOMER_ORIGIN } from './product.js';
import { readSaveReview, stageSaveReview } from './save-review.js';
import { getCloudStatus } from './cloud.js';
import { getEffectivePreferences } from './preferences.js';

const HIDDEN_KEY = 'foundkeep-dock-hidden-origins', ALWAYS_KEY = 'foundkeep-dock-always-on', LOCAL_KEY = 'foundkeep-dock-local-prompt';
// R10: the dock content script can never touch chrome.storage (it sits next
// to account credentials); this is the one background-side holder of where
// the dock sits on screen, reached only through the dock-position message.
const DOCK_POSITION_KEY = 'foundkeep-dock-position';
const DOCK_FILE = 'src/dock/dock.js';
export const dashboardUrl = path => CUSTOMER_ORIGIN + path;
const scriptable = url => /^https?:\/\//i.test(url || '') && !/^https:\/\/chromewebstore\.google\.com\//.test(url) && !/^https:\/\/chrome\.google\.com\/webstore/.test(url);
const originOf = url => { try { return new URL(url).origin; } catch { return null; } };

export async function dockState(tab) {
  const [{ preferences }, cloud, stored] = await Promise.all([getEffectivePreferences(), getCloudStatus(), chrome.storage.local.get([HIDDEN_KEY, ALWAYS_KEY, LOCAL_KEY])]);
  const hidden = stored[HIDDEN_KEY] || [], origin = originOf(tab?.url);
  const hiddenHere = !!origin && hidden.includes(origin), alwaysOn = stored[ALWAYS_KEY] === true;
  const later = stored[LOCAL_KEY]?.laterUntil || 0;
  const c = preferences.capture;
  return {
    connected: cloud.status === 'connected' && !!cloud.account?.id,
    actions: { savepage: c.bookmark, highlight: c.highlight, region: c.region, fullpage: c.fullPage, note: c.note },
    alwaysOn, hiddenHere, localOnly: Date.now() < later ? 0 : cloud.localOnly || 0, show: alwaysOn && !hiddenHere,
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
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-state', state: await dockState(tab) }).catch(() => {});
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-show', expand, toggle }).catch(() => {});
  return true;
}
export async function openReview(tab) {
  if (!await summonDock(tab.id, { expand: true })) return openFallbackReview(tab.id);
  await chrome.tabs.sendMessage(tab.id, { kind: 'dock-review-open', url: chrome.runtime.getURL('src/review.html?tab=' + tab.id) });
}
// popup tab id -> reviewed tab id. Kept in chrome.storage.session rather than
// a module-level Map: an MV3 service worker can be torn down and restarted by
// Chrome at any point (e.g. between opening the fallback popup and it being
// confirmed), which would silently wipe an in-memory Map; session storage
// survives that and is the same value regardless of which realm reads it.
const POPUP_MAP_KEY = 'foundkeep-dock-popup-map';
export async function openFallbackReview(tabId) {
  // review.html is use_dynamic_url in the manifest, and chrome.runtime.getURL()
  // returns that per-session dynamic-host form here. A framed load (openReview,
  // from a matching http(s) page's own content script) resolves that URL fine,
  // but chrome.windows.create has no such matching-page initiator and cannot
  // load the dynamic-host URL at all (the popup ends up on chrome-error://
  // chromewebdata) — so this one call site needs the plain extension-id URL.
  const url = `chrome-extension://${chrome.runtime.id}/src/review.html?tab=${tabId}&window=1`;
  const win = await chrome.windows.create({ url, type: 'popup', width: 380, height: 560, focused: true });
  const popupTab = win.tabs?.[0];
  if (popupTab) {
    const map = (await chrome.storage.session.get(POPUP_MAP_KEY))[POPUP_MAP_KEY] || {};
    map[popupTab.id] = tabId;
    await chrome.storage.session.set({ [POPUP_MAP_KEY]: map });
  }
}
export async function reviewTabFor(sender) {
  // A framed card must belong to the tab it sits in; a popup must be one we opened.
  const url = new URL(sender.url), tab = Number(url.searchParams.get('tab'));
  if (!Number.isInteger(tab)) return null;
  if (url.searchParams.get('window') === '1') {
    const map = (await chrome.storage.session.get(POPUP_MAP_KEY))[POPUP_MAP_KEY] || {};
    return map[sender.tab?.id] === tab ? tab : null;
  }
  return sender.tab?.id === tab ? tab : null;
}
export async function withDockHidden(tabId, run) {
  await chrome.tabs.sendMessage(tabId, { kind: 'dock-hide' }).catch(() => {});
  try { return await run(); } finally { await chrome.tabs.sendMessage(tabId, { kind: 'dock-unhide' }).catch(() => {}); }
}
async function refreshState(tab) { await chrome.tabs.sendMessage(tab.id, { kind: 'dock-state', state: await dockState(tab) }).catch(() => {}); }
export async function startCapture(tab, action, extra = {}) {
  try { await stageSaveReview({ action, tab, trigger: 'dock', ...extra }); await openReview(tab); }
  catch (error) {
    if (!await summonDock(tab.id, { expand: true })) throw error;
    await chrome.tabs.sendMessage(tab.id, { kind: 'dock-status', text: error.message, tone: 'error' }).catch(() => {});
  }
}
export async function handleDockMessage(msg, sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || sender.url?.startsWith(chrome.runtime.getURL(''))) return { ok: false };
  const tab = sender.tab;
  switch (msg.kind) {
    case 'dock-hello': {
      const state = await dockState(tab);
      if (await readSaveReview(tab.id)) void openReview(tab);
      return state;
    }
    case 'dock-capture': {
      if (!['savepage', 'highlight', 'region', 'fullpage', 'note'].includes(msg.action)) return { ok: false };
      const { preferences } = await getEffectivePreferences();
      const extra = msg.action === 'note' ? { text: '', attachPage: preferences.notes.attachSource } : {};
      await startCapture(tab, msg.action, extra); return { ok: true };
    }
    case 'dock-open': {
      const target = { library: dashboardUrl('/dashboard'), settings: dashboardUrl('/dashboard/settings'), 'sign-in': dashboardUrl('/login'), import: chrome.runtime.getURL('src/import.html') }[msg.target];
      if (!target) return { ok: false };
      await chrome.tabs.create({ url: target, index: tab.index + 1 }); return { ok: true };
    }
    case 'dock-site': {
      const origin = originOf(tab.url); if (!origin) return { ok: false };
      const list = new Set((await chrome.storage.local.get(HIDDEN_KEY))[HIDDEN_KEY] || []);
      msg.hidden ? list.add(origin) : list.delete(origin);
      await chrome.storage.local.set({ [HIDDEN_KEY]: [...list] }); await refreshState(tab); return { ok: true };
    }
    case 'dock-review-fallback': if (await readSaveReview(tab.id)) await openFallbackReview(tab.id); return { ok: true };
    // dock-always-on and dock-local are added in Tasks 5 and 6.
    case 'dock-always-on': case 'dock-local': return { ok: false };
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

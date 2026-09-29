import { CUSTOMER_ORIGIN } from './product.js';
import { captureBinding, getCloudStatus, importLocalCaptures, onCloudChange } from './cloud.js';
import { drainQueue } from './capture.js';
import { getEffectivePreferences, capturePreferenceKey, captureDisabledMessage } from './preferences.js';
import { performCapture } from './capture-actions.js';
import { rememberSave, grantDetails, revokeDetails, grantNote, revokeNote } from './capture-details.js';
import { configuredFlash } from './badge.js';
import * as db from './db.js';

const HIDDEN_KEY = 'foundkeep-dock-hidden-origins', ALWAYS_KEY = 'foundkeep-dock-always-on', LOCAL_KEY = 'foundkeep-dock-local-prompt';
// R10: the dock content script can never touch chrome.storage (it sits next
// to account credentials); this is the one background-side holder of where
// the dock sits on screen, reached only through the dock-position message.
const DOCK_ANCHOR_KEY = 'foundkeep-dock-anchor';
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
    // Saves that have not reached the library yet: shown as a quiet count on
    // the dock's Library button.
    pending: connected ? (cloud.pending || 0) + (cloud.failed || 0) : 0,
  };
}
// When sync status changes, open docks get the new count (not the whole,
// tab-specific state). Debounced: one sync can announce several times.
let pendingTimer = 0;
onCloudChange(() => {
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(async () => {
    const cloud = await getCloudStatus().catch(() => null);
    if (!cloud) return;
    const count = cloud.status === 'connected' && cloud.account?.id ? (cloud.pending || 0) + (cloud.failed || 0) : 0;
    for (const tab of await chrome.tabs.query({})) chrome.tabs.sendMessage(tab.id, { kind: 'dock-pending', count }, { frameId: 0 }).catch(() => {});
  }, 400);
});
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
const SCREENSHOT_BUSY = 'A screenshot is already in progress on this page.';
// Everything except an X post and a note that leaves the page out reads or
// scripts the page itself (assertCaptureTab, executeScript).
const needsPage = (action, extra) => action !== 'tweet' && !(action === 'note' && !extra.attachPage);
// Show a result in the tab's dock. Resolves whether the dock showed it: a
// dock on a "Hide on this site" origin stays hidden (it answers shown:false),
// and no dock is injected into a hidden origin — the caller flashes the
// toolbar badge instead.
async function tell(tab, message) {
  if (!await hasDock(tab.id)) {
    const origin = originOf((await chrome.tabs.get(tab.id).catch(() => null))?.url);
    if (!origin) return false;
    if (((await chrome.storage.local.get(HIDDEN_KEY))[HIDDEN_KEY] || []).includes(origin)) return false;
    if (!await summonDock(tab.id).catch(() => false)) return false;
  }
  const reply = await chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => null);
  return reply?.shown === true;
}
async function report(tab, message) {
  const shown = await tell(tab, message);
  if (!shown && message.kind === 'dock-saved') await configuredFlash(true).catch(() => {});
  if (!shown && message.tone === 'error') await configuredFlash(false, message.text).catch(() => {});
  return shown;
}
// A right-click image save downloads the original from the image's own site,
// which needs that exact origin's permission. Ask inside the click that
// started the save (the context-menu event is the user gesture), before
// anything awaits. 'unavailable' means Chrome would not show the prompt here
// (e.g. no usable gesture in the service worker); a small FoundKeep window
// then asks with a real click instead (requestImageAccessInWindow).
function requestImageAccess(srcUrl) {
  let origin;
  try { origin = new URL(srcUrl).origin + '/*'; } catch { return Promise.resolve('denied'); }
  try {
    return Promise.resolve(chrome.permissions.request({ origins: [origin] })).then(granted => granted ? 'granted' : 'denied', () => 'unavailable');
  } catch { return Promise.resolve('unavailable'); }
}
const IMAGE_REQUESTS_KEY = 'foundkeep-image-requests';
const imageRequests = async () => (await chrome.storage.session.get(IMAGE_REQUESTS_KEY))[IMAGE_REQUESTS_KEY] || {};
async function requestImageAccessInWindow(tab, info) {
  const nonce = crypto.randomUUID(), requests = await imageRequests();
  // Only what finishing the save needs; requests older than 10 minutes lapse.
  for (const [key, entry] of Object.entries(requests)) if (Date.now() - entry.at > 600_000) delete requests[key];
  requests[nonce] = { tabId: tab.id, info: { menuItemId: 'save-image', srcUrl: info.srcUrl, pageUrl: info.pageUrl || null }, at: Date.now() };
  await chrome.storage.session.set({ [IMAGE_REQUESTS_KEY]: requests });
  await chrome.windows.create({ url: chrome.runtime.getURL(`src/image-access.html?request=${nonce}`), type: 'popup', width: 400, height: 300, focused: true });
}
// The packaged image-access.html window, carrying a request this background
// issued. Returns [nonce, entry] or null.
async function imageRequestFor(sender) {
  let url;
  try { url = new URL(sender.url); } catch { return null; }
  if (sender.id !== chrome.runtime.id || url.protocol !== 'chrome-extension:' || url.host !== chrome.runtime.id || url.pathname !== '/src/image-access.html' || sender.frameId !== 0) return null;
  const nonce = url.searchParams.get('request'), entry = nonce && (await imageRequests())[nonce];
  return entry && Date.now() - entry.at <= 600_000 ? [nonce, entry] : null;
}
export async function imageRequestOrigin(sender) {
  const found = await imageRequestFor(sender);
  if (!found) throw new Error('This request is no longer available.');
  return new URL(found[1].info.srcUrl).origin;
}
/** The window's answer: save the image now that its site is allowed, or say why not. */
export async function finishImageRequest(sender, granted) {
  const found = await imageRequestFor(sender);
  if (!found) throw new Error('This request is no longer available. Right-click the image and choose Save image again.');
  const [nonce, entry] = found, requests = await imageRequests();
  delete requests[nonce];
  await chrome.storage.session.set({ [IMAGE_REQUESTS_KEY]: requests });
  const tab = await chrome.tabs.get(entry.tabId).catch(() => null);
  if (!tab) throw new Error('The page with this image was closed.');
  const allowed = granted === true && await chrome.permissions.contains({ origins: [new URL(entry.info.srcUrl).origin + '/*'] }).catch(() => false);
  if (!allowed) { await report(tab, { kind: 'dock-status', text: IMAGE_ACCESS_MESSAGE, tone: 'error' }); return { ok: false, error: IMAGE_ACCESS_MESSAGE }; }
  return startCapture(tab, 'save-image', { info: entry.info, trigger: 'context', imageAccess: 'granted' });
}

// Screenshots in progress, per tab: a second one (e.g. the shortcut pressed
// again) must not stack another selector on the page.
const screenshotTabs = new Set();
// X posts saved this session: X re-renders posts (and their buttons) as you
// scroll, so a post already saved is recognized rather than saved twice —
// but only while that save still counts: it belongs to the account connected
// now and has not failed. After an account switch, or a save the server
// refused for good, the post is saved again. (A save deleted from the
// library elsewhere is not visible here; the local record stays.)
const POSTS_KEY = 'foundkeep-saved-posts';
const postSaves = new Map();
let postsQueue = Promise.resolve();
async function savedPost(url) {
  const id = ((await chrome.storage.session.get(POSTS_KEY))[POSTS_KEY] || {})[url];
  if (!id) return null;
  const [record, { cloudAccountId }] = await Promise.all([db.getCapture(id), captureBinding()]);
  return record && cloudAccountId && record.cloudAccountId === cloudAccountId && record.cloudStatus !== 'failed' ? record : null;
}
function rememberPost(url, captureId) {
  postsQueue = postsQueue.catch(() => {}).then(async () => {
    const posts = (await chrome.storage.session.get(POSTS_KEY))[POSTS_KEY] || {};
    posts[url] = captureId;
    await chrome.storage.session.set({ [POSTS_KEY]: posts });
  });
  return postsQueue;
}

// Every capture saves instantly, straight into the connected account's
// library — no destination step first. Resolves { ok: true, capture, shown }
// once the save is committed (the dock then offers "Add details"), { ok:
// false, cancelled: true } when a screenshot selection was cancelled, { ok:
// false, pending: true } while a FoundKeep window asks for an image site's
// access, or { ok: false, error } when the capture could not run (disabled,
// signed out, no page grant) — callers decide what to do with that (the X
// button shows its error state). The dock says what happened when it can;
// otherwise the toolbar badge flashes.
export function startCapture(tab, action, extra = {}) {
  if (action === 'tweet') {
    const url = extra.tweet?.url;
    if (postSaves.has(url)) return postSaves.get(url);
    const run = (async () => {
      const existing = await savedPost(url).catch(() => null);
      if (!existing) return runCapture(tab, action, extra);
      await rememberSave(tab.id, existing.id).catch(() => {});
      const shown = await report(tab, { kind: 'dock-saved' });
      return { ok: true, shown, already: true, capture: { id: existing.id, type: existing.type, cloudStatus: existing.cloudStatus } };
    })().finally(() => postSaves.delete(url));
    postSaves.set(url, run);
    return run;
  }
  if (action === 'region' || action === 'fullpage') {
    if (screenshotTabs.has(tab.id)) return Promise.resolve({ ok: false, error: SCREENSHOT_BUSY });
    screenshotTabs.add(tab.id);
    return runCapture(tab, action, extra).finally(() => screenshotTabs.delete(tab.id));
  }
  return runCapture(tab, action, extra);
}
async function runCapture(tab, action, extra) {
  // Synchronously, before any await: the permission prompt must run inside
  // the right-click that started this save.
  const imageAccess = action === 'save-image' && !extra.imageAccess ? requestImageAccess(extra.info?.srcUrl) : null;
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
    let access = extra.imageAccess || (imageAccess ? await imageAccess : undefined);
    if (access === 'unavailable') {
      const origin = new URL(extra.info.srcUrl).origin + '/*';
      if (await chrome.permissions.contains({ origins: [origin] }).catch(() => false)) access = 'granted';
      else {
        await requestImageAccessInWindow(tab, extra.info);
        await report(tab, { kind: 'dock-status', text: 'Allow access in the FoundKeep window to save this image.', tone: '' });
        return { ok: false, pending: true };
      }
    }
    if (access === 'denied') throw new Error(IMAGE_ACCESS_MESSAGE);
    record = await performCapture(action, { tab, trigger: 'dock', ...extra, ...(access ? { imageAccess: access } : {}) });
  } catch (error) {
    const message = error?.message || 'FoundKeep could not save this. Try again.';
    await report(tab, { kind: 'dock-status', text: message, tone: 'error' });
    return { ok: false, error: message };
  }
  // I1: a screenshot selection cancelled on the page (✕, Esc, or leaving the
  // tab) saves nothing; the dock says so in a neutral tone — never "Saved".
  if (!record) {
    await report(tab, { kind: 'dock-status', text: 'Selection cancelled.', tone: '' });
    return { ok: false, cancelled: true };
  }
  if (action === 'tweet') await rememberPost(extra.tweet.url, record.id).catch(() => {});
  await rememberSave(tab.id, record.id).catch(() => {});
  const shown = await report(tab, { kind: 'dock-saved' });
  return { ok: true, shown, capture: { id: record.id, type: record.type, cloudStatus: record.cloudStatus } };
}
export async function handleDockMessage(msg, sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || sender.url?.startsWith(chrome.runtime.getURL(''))) return { ok: false };
  const tab = sender.tab;
  switch (msg.kind) {
    case 'dock-hello': return dockState(tab, sender.url);
    // A note is written in its own extension frame (note.html), never in the
    // page: the dock only asks for one, and the frame saves through
    // note-save (background.js).
    case 'dock-capture': {
      if (!['savepage', 'highlight', 'region', 'fullpage'].includes(msg.action)) return { ok: false };
      return startCapture(tab, msg.action);
    }
    case 'dock-note': {
      await chrome.tabs.sendMessage(tab.id, { kind: 'dock-note-open', url: await grantNote(tab.id) }, { frameId: 0 });
      return { ok: true };
    }
    case 'dock-note-closed': await revokeNote(tab.id); return { ok: true };
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
      // Never touches atlasCustomer or any other cloud/account storage key.
      if (msg.reset === true) { await chrome.storage.local.remove(DOCK_ANCHOR_KEY); return { ok: true }; }
      if (msg.anchor !== undefined) {
        const { side, dx, tucked, fy } = msg.anchor || {};
        const fraction = value => Number.isFinite(value) && value >= 0 && value <= 1;
        if (!['left', 'right'].includes(side) || !fraction(dx) || typeof tucked !== 'boolean' || (tucked ? fy !== null : !fraction(fy))) return { ok: false };
        await chrome.storage.local.set({ [DOCK_ANCHOR_KEY]: { side, dx, tucked, fy } });
        return { ok: true };
      }
      const stored = await chrome.storage.local.get(DOCK_ANCHOR_KEY);
      return stored[DOCK_ANCHOR_KEY] || null;
    }
    default: return { ok: false };
  }
}

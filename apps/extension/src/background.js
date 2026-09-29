import { PRODUCT_NAME } from "./product.js";
import { trustedLibrarySender } from "./library-api.js";
import { summonDock, startCapture, handleDockMessage, dashboardUrl, reconcileAlwaysOn, imageRequestOrigin, finishImageRequest } from "./dock-control.js";
import { detailsCaptureFor, readCaptureDetails, applyCaptureDetails, forgetTab, noteGrantFor, consumeNote, releaseNote, frameMayRelay } from "./capture-details.js";
import { configuredFlash } from "./badge.js";
import { publicHttpUrl } from "./capture-actions.js";
import { startBookmarkImport, resumeBookmarkImport, cancelBookmarkImport, importProgress } from "./import-queue.js";
import { drainQueue } from "./capture.js";
import {
  libraryRequest,
  protectCloudStorage,
  handleExternalMessage,
  getCloudStatus,
  importLocalCaptures,
  retryCloudSync,
  disconnectCloud,
  trustedPairingSender,
  migrateSidebarCaptures,
} from "./cloud.js";
import {
  capturePreferenceKey,
  getEffectivePreferences,
  refreshPreferences,
} from "./preferences.js";
import { actionForCommand } from "./capture-method.js";

protectCloudStorage().catch(() => {});
// R1: the toolbar icon toggles the floating dock rather than opening the
// native side panel — a second click on an already-expanded dock collapses
// it (summonDock passes toggle through to the dock's own dock-show handler,
// which never collapses a dock with its details card open). Falls back to the dashboard tab
// when the dock cannot be injected (e.g. a chrome:// or Web Store page).
// An upgraded install keeps whatever setPanelBehavior set before this
// version shipped — openPanelOnActionClick persists across updates — so
// this must run every startup, not just on first install, or the icon keeps
// opening the side panel and this onClicked listener never fires at all.
// R14: the manifest keeps the "sidePanel" permission (no install warning,
// and no side_panel key — nothing is ever shown) ONLY so this reset can run
// for installs upgrading from 1.7.x; without it chrome.sidePanel is
// undefined and the call below silently does nothing. Drop the permission
// (and this line) in 1.9, once 1.7.x installs have all passed through 1.8.
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
chrome.action.onClicked.addListener(tab => {
  void summonDock(tab.id, { expand: true, toggle: true }).then(async shown => {
    if (!shown) await chrome.tabs.create({ url: dashboardUrl('/dashboard'), index: tab.index + 1 });
  }).catch(() => {});
});
chrome.runtime.onMessageExternal.addListener((msg, sender, respond) => {
  if (msg?.kind === "atlas-refresh-preferences") {
    if (!trustedPairingSender(sender)) {
      respond({ ok: false, error: "This page cannot update FoundKeep." });
      return;
    }
    refreshPreferences()
      .then(async (state) => {
        const requestedRevision = Number.isSafeInteger(msg.revision) && msg.revision >= 0 ? msg.revision : 0;
        if (state.revision < requestedRevision) throw new Error("FoundKeep did not receive the saved preference revision.");
        await reconcileContextMenus(state.preferences);
        announcePreferenceChange();
        drainQueue().catch(() => {});
        respond({ ok: true, revision: state.revision });
      })
      .catch(() => respond({ ok: false, error: "FoundKeep kept the last saved preferences." }));
    return true;
  }
  if (msg?.kind === "atlas-open-import") {
    if (!trustedPairingSender(sender)) { respond({ ok: false, error: "This page cannot open FoundKeep import." }); return; }
    // M7: always answer — a failed tab open must not leave the site waiting
    // out its own 15 s timeout.
    void Promise.resolve()
      .then(() => chrome.tabs.create({ url: chrome.runtime.getURL("src/import.html") }))
      .then(() => respond({ ok: true }), () => respond({ ok: false, error: "FoundKeep could not open the import page. Try again." }));
    return true;
  }
  handleExternalMessage(msg, sender)
    .then((result) => {
      respond(result);
      if (result.ok && ["atlas-connect", "atlas-auto-connect"].includes(msg.kind)) {
        refreshPreferences()
          .then(async (state) => {
            await reconcileContextMenus(state.preferences);
            announcePreferenceChange();
          })
          .catch(() => {});
        retryCloudSync().catch(() => {});
      }
    })
    .catch(() =>
      respond({
        ok: false,
        error: "FoundKeep could not complete this connection. Please try again.",
      }),
    );
  return true;
});

function announcePreferenceChange() {
  try { chrome.runtime.sendMessage({ kind: "atlas-preferences-changed" }).catch(() => {}); }
  catch { /* no extension view is open */ }
  chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] })
    .then((tabs) => Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { kind: "atlas-preferences-changed" }))))
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Queue drain — periodic cloud retry + on demand.
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener((details) => {
  getEffectivePreferences({ refresh: true })
    .then((state) => reconcileContextMenus(state.preferences))
    .catch(() => reconcileContextMenus());
  chrome.alarms.create("atlas-drain", { periodInMinutes: 1 });
  // I3 / R15: on update, recover 1.7.x side-panel captures (sidebar-* methods
  // the backend rejects) before draining, so the drain uploads them as popup-*.
  (details?.reason === "update" ? migrateSidebarCaptures() : Promise.resolve())
    .catch(() => {})
    .then(() => drainQueue())
    .catch(() => {});
  resumeBookmarkImport().catch(() => {});
  reconcileAlwaysOn().catch(() => {});
  // 1.8.0 remembered the dragged dock's corner in an older shape.
  if (details?.reason === "update") chrome.storage.local.remove("foundkeep-dock-position").catch(() => {});
});
chrome.runtime.onStartup?.addListener(() => {
  getEffectivePreferences()
    .then((state) => reconcileContextMenus(state.preferences))
    .catch(() => reconcileContextMenus());
  chrome.alarms.create("atlas-drain", { periodInMinutes: 1 });
  drainQueue().catch(() => {});
  resumeBookmarkImport().catch(() => {});
  reconcileAlwaysOn().catch(() => {});
});
// A user revoking the <all_urls> grant from chrome://extensions (rather than
// the dock's own "Stop showing on every site") must still drop the
// registered content script — otherwise it stays registered but silently
// unable to run anywhere, and reconcileAlwaysOn's own storage flag goes
// stale relative to reality.
chrome.permissions.onRemoved.addListener(() => { void reconcileAlwaysOn(); });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "atlas-drain") {
    getEffectivePreferences()
      .then((state) => reconcileContextMenus(state.preferences))
      .catch(() => {});
    drainQueue().catch(() => {});
    resumeBookmarkImport().catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Context menus
// ---------------------------------------------------------------------------
const MENUS = [
  {
    id: "save-selection",
    title: "Save selection to FoundKeep",
    contexts: ["selection"],
  },
  { id: "save-link", title: "Save link to FoundKeep", contexts: ["link"] },
  { id: "save-image", title: "Save image to FoundKeep", contexts: ["image"] },
  { id: "savepage", title: "Save page as bookmark", contexts: ["page"] },
  { id: "region", title: "Screenshot region → FoundKeep", contexts: ["page"] },
  { id: "fullpage", title: "Full-page screenshot → FoundKeep", contexts: ["page"] },
];

async function reconcileContextMenus(preferences) {
  const state = preferences || (await getEffectivePreferences()).preferences;
  await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));
  if (!state.contextMenus) return;
  for (const menu of MENUS) {
    const key = capturePreferenceKey(menu.id);
    if (state.capture[key]) chrome.contextMenus.create({ ...menu, title: menu.title.replaceAll("FoundKeep", PRODUCT_NAME) });
  }
}

// Right-click items save directly. startCapture runs synchronously up to its
// first await, so a "Save image" permission prompt still happens inside this
// click. startCapture reports the result itself — in the dock, or with a
// toolbar badge flash where the dock cannot (or must not) show.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-image" && !publicHttpUrl(info.srcUrl)) { void configuredFlash(false, 'FoundKeep can only save images from public web addresses.'); return; }
  void startCapture(tab, info.menuItemId, { info, trigger: "context" }).catch(error => configuredFlash(false, error.message));
});

// Keyboard shortcuts save directly too; both screenshot shortcuts start the
// corner-toolbar flow (actionForCommand).
chrome.commands.onCommand.addListener((command, tab) => {
  const begin = async tab => {
    if (!tab) return;
    const action = actionForCommand(command, (await getEffectivePreferences()).preferences.capture);
    if (action) await startCapture(tab, action, { trigger: "keyboard" });
  };
  void (tab ? begin(tab) : chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => begin(tab)))
    .catch(error => configuredFlash(false, error.message));
});

// A tab's last save and its frame grants end with the tab.
chrome.tabs.onRemoved.addListener(tabId => { void forgetTab(tabId); });

// ---------------------------------------------------------------------------
// Messages from extension pages / content scripts
// ---------------------------------------------------------------------------
// A packaged extension frame (the details card or the note field) speaking
// for a numeric tab id; its grant is checked separately (capture-details.js).
function trustedFrameSender(sender, msg, pathname) {
  if (sender?.id !== chrome.runtime.id || !Number.isInteger(msg.tabId)) return false;
  try { const url = new URL(sender.url); return url.protocol === 'chrome-extension:' && url.pathname === pathname; } catch { return false; }
}
const detailsCardSender = (sender, msg) => trustedLibrarySender(sender, chrome.runtime) && trustedFrameSender(sender, msg, '/src/review.html');
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (typeof msg?.kind === 'string' && msg.kind.startsWith('dock-')) {
    handleDockMessage(msg, sender).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  // C1 / R16: the details card's ready/resize/done reach the dock only
  // through here — never window.postMessage, which the host page could read
  // and answer. Relayed only when the sender is a packaged review.html framed
  // in the tab its one-time grant was minted for (detailsCaptureFor), and
  // only to that tab's top frame (the dock), so a page can neither observe
  // nor forge them.
  if (msg?.kind === 'details-frame') {
    if (!detailsCardSender(sender, msg) || !['ready', 'resize', 'done'].includes(msg.type)) { sendResponse({ ok: false }); return; }
    void (async () => {
      if (!await detailsCaptureFor(sender, msg.tabId)) return { ok: false };
      const relay = { kind: 'dock-details-frame', type: msg.type };
      if (msg.type === 'resize') relay.height = Number(msg.height);
      if (msg.type === 'done') relay.saved = msg.saved === true;
      await chrome.tabs.sendMessage(msg.tabId, relay, { frameId: 0 });
      return { ok: true };
    })().then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
  // The note field (note.html): same relay and ownership rules as the
  // details card. Its grant allows one saved note for its tab.
  if (msg?.kind === 'note-frame' || msg?.kind === 'note-open' || msg?.kind === 'note-save') {
    if (!trustedFrameSender(sender, msg, '/src/note.html')) { sendResponse({ ok: false, error: 'This note field is no longer available.' }); return; }
    void (async () => {
      if (msg.kind === 'note-frame') {
        if (!['ready', 'resize', 'done'].includes(msg.type) || !await frameMayRelay('note', sender, msg.tabId)) return { ok: false };
        const relay = { kind: 'dock-note-frame', type: msg.type };
        if (msg.type === 'resize') relay.height = Number(msg.height);
        if (msg.type === 'done') relay.saved = msg.saved === true;
        await chrome.tabs.sendMessage(msg.tabId, relay, { frameId: 0 });
        return { ok: true };
      }
      if (msg.kind === 'note-open') return (await noteGrantFor(sender, msg.tabId)) ? { ok: true } : { ok: false, error: 'This note field is no longer available.' };
      if (typeof msg.text !== 'string' || !msg.text.trim() || msg.text.length > 50000) return { ok: false, error: 'Write a note of up to 50,000 characters.' };
      const nonce = await consumeNote(sender, msg.tabId);
      if (!nonce) return { ok: false, error: 'This note field is no longer available.' };
      const tab = await chrome.tabs.get(msg.tabId);
      const { preferences } = await getEffectivePreferences();
      const result = await startCapture(tab, 'note', { text: msg.text, attachPage: preferences.notes.attachSource });
      if (!result.ok) await releaseNote(msg.tabId, nonce);
      return result.ok ? { ok: true } : { ok: false, error: result.error || 'FoundKeep could not save this note. Try again.' };
    })().then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  // The fallback window for a right-click image save (image-access.html).
  if (msg?.kind === 'image-access-get' || msg?.kind === 'image-access-done') {
    void (async () => {
      if (msg.kind === 'image-access-get') return { ok: true, origin: await imageRequestOrigin(sender) };
      return finishImageRequest(sender, msg.granted === true);
    })().then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  // The details card reads and edits exactly the save its grant names.
  if (msg?.kind === 'details-get' || msg?.kind === 'details-save') {
    if (!detailsCardSender(sender, msg)) { sendResponse({ ok: false, error: 'These details are no longer available. Use Add details again.' }); return; }
    void (async () => {
      const captureId = await detailsCaptureFor(sender, msg.tabId);
      if (!captureId) throw new Error('These details are no longer available. Use Add details again.');
      if (msg.kind === 'details-get') return { details: await readCaptureDetails(captureId) };
      return { result: await applyCaptureDetails(captureId, msg.form) };
    })().then(data => sendResponse({ ok: true, ...data })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (msg?.kind === "library-request" || msg?.kind?.startsWith("bookmark-import-")) {
    if (!trustedLibrarySender(sender, chrome.runtime)) { sendResponse({ok:false,error:"Open your FoundKeep library to continue."}); return; }
    (async()=>{
      try {
        let data;
        if(msg.kind==="library-request") data=await libraryRequest(msg.operation,msg.args,msg.accountId);
        else if(msg.kind==="bookmark-import-start") data=await startBookmarkImport(msg);
        else if(msg.kind==="bookmark-import-status") data=await importProgress(msg.accountId);
        else if(msg.kind==="bookmark-import-retry") { void resumeBookmarkImport(); data=await importProgress(msg.accountId); }
        else if(msg.kind==="bookmark-import-cancel") { await cancelBookmarkImport(); data=null; }
        else throw new Error("Unknown import action.");
        sendResponse({ok:true,data});
      }catch(error){sendResponse({ok:false,error:error.message||"Please try again."});}
    })();return true;
  }

  if (msg?.kind === "feature-status") {
    getEffectivePreferences()
      .then((state) => sendResponse({ ok: true, enabled: !!state.preferences.capture[msg.feature] }))
      .catch(() => sendResponse({ ok: true, enabled: true }));
    return true;
  }
  if (msg?.kind === "preferences-status") {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL("src/"))) {
      sendResponse({ ok: false, error: "Open FoundKeep to view preferences." });
      return;
    }
    getEffectivePreferences({ refresh: msg.refresh === true })
      .then((state) => sendResponse({ ok: true, ...state }))
      .catch(() => sendResponse({ ok: false, error: "FoundKeep could not load preferences." }));
    return true;
  }
  if (msg?.kind?.startsWith("cloud-")) {
    // Content scripts and websites cannot read credentials, disconnect an
    // account, or authorize a historical import through the internal channel.
    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(chrome.runtime.getURL("src/"))
    ) {
      sendResponse({
        ok: false,
        error: "Open FoundKeep to manage this connection.",
      });
      return;
    }
    (async () => {
      try {
        if (msg.kind === "cloud-status")
          return sendResponse({ ok: true, ...(await getCloudStatus()) });
        if (msg.kind === "cloud-import") {
          const result = await importLocalCaptures({
            confirmed: msg.confirmed,
            accountId: msg.accountId,
          });
          sendResponse({ ok: true, ...result });
          drainQueue().catch(() => {});
          return;
        }
        if (msg.kind === "cloud-retry") {
          retryCloudSync().catch(() => {});
          return sendResponse({ ok: true });
        }
        if (msg.kind === "cloud-disconnect") {
          return sendResponse({ ok: true, ...(await disconnectCloud()) });
        }
        sendResponse({ ok: false, error: "Unknown FoundKeep request." });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error.message || "Please try again.",
        });
      }
    })();
    return true;
  }
  if (msg?.kind === "saveTweet") {
    const trusted = sender.id === chrome.runtime.id && sender.frameId === 0 && /^https:\/\/(?:www\.)?(?:x|twitter)\.com\//.test(sender.url || '');
    const p = msg.payload;
    if (!trusted || !sender.tab || !p || typeof p.text !== 'string' || p.text.length > 50000 || typeof p.title !== 'string' || p.title.length > 1000 || !/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(p.url || '')) {
      sendResponse({ ok: false, error: 'Open the tweet on X to save it.' }); return;
    }
    if (p.socialContext !== undefined && (JSON.stringify(p.socialContext).length > 120000 || p.socialContext?.version !== 1)) { sendResponse({ ok: false, error: 'This post is too large to capture.' }); return; }
    void (async () => {
      const state = await getEffectivePreferences();
      if (!state.preferences.capture.tweet) throw new Error('Tweet capture is disabled in your FoundKeep preferences.');
      // Saves at once. dock.js is always present on x.com (a static content
      // script entry there), so it shows "Saved · Add details" — but the
      // response still says whether the save happened, since twitter.js
      // switches the button's own state on it.
      const result = await startCapture(sender.tab, 'tweet', { tweet: { url: p.url, text: p.text, title: p.title, socialContext: p.socialContext || null }, trigger: 'twitter' });
      if (!result.ok) throw new Error(result.error);
      return { saved: true, already: result.already === true };
    })().then(data => sendResponse({ ok: true, ...data })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (msg?.kind === "drain") {
    drainQueue().catch(() => {});
    return;
  }
});

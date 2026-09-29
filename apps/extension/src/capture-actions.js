// Every capture FoundKeep performs, defined in one place. Each action saves
// instantly — straight into the connected account's library (capture.js
// commits locally first, then queues the upload); details can be added
// afterwards from the dock ("Add details", capture-details.js). Runs in the
// background service worker; tests also drive it from an extension page.
import { saveCapture } from "./capture.js";
import { extractPageDocument } from "./page-extractor.js";
import { capturePreferenceKey, captureDisabledMessage, getEffectivePreferences } from "./preferences.js";
import { cloudImageMime } from "./image-formats.js";
import { captureMethodFor } from "./capture-method.js";
import { screenshotSelectInPage } from "./screenshot-overlay.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The dock sits above the page and must not appear in a screenshot.
export async function withDockHidden(tabId, run) {
  await chrome.tabs.sendMessage(tabId, { kind: "dock-hide" }).catch(() => {});
  try { return await run(); } finally { await chrome.tabs.sendMessage(tabId, { kind: "dock-unhide" }).catch(() => {}); }
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function obviousPrivateHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.includes(":")) {
    return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") ||
      /^fe[89ab]/.test(host) || host.startsWith("ff") || host.startsWith("::ffff:127.") ||
      host.startsWith("::ffff:10.") || host.startsWith("::ffff:192.168.");
  }
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function publicHttpUrl(value) {
  const safe = safeHttpUrl(value);
  if (!safe) return null;
  return obviousPrivateHost(new URL(safe).hostname) ? null : safe;
}

async function contentHash(text) {
  if (!text) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

function boundedText(value, maximum, label) {
  if (typeof value !== "string") return value;
  if (value.length > maximum) throw new Error(`${label} must be ${maximum.toLocaleString("en-US")} characters or fewer.`);
  return value;
}

function fallbackProvenance(tab, captureMethod, capturedAt, targetUrl = null, error = null) {
  return {
    schemaVersion: 1,
    captureMethod,
    pageUrl: safeHttpUrl(tab?.url),
    canonicalUrl: null,
    pageTitle: tab?.title || null,
    siteName: null,
    description: null,
    authors: [],
    publishedAt: null,
    modifiedAt: null,
    language: null,
    leadImageUrl: null,
    faviconUrl: safeHttpUrl(tab?.favIconUrl),
    targetUrl: safeHttpUrl(targetUrl),
    headings: [],
    capturedAt,
    extractedAt: Date.now(),
    extractorVersion: 1,
    contentHash: null,
    extractionStatus: error ? "partial" : "complete",
    extractionError: error,
  };
}

export async function capturePageContext(tab, {
  captureMethod,
  readableText = false,
  extendedMetadata = true,
  headings = false,
  maxArticleCharacters = 500_000,
  targetUrl = null,
} = {}) {
  const capturedAt = Date.now();
  if (!tab?.id || !safeHttpUrl(tab.url)) {
    return { articleText: null, provenance: fallbackProvenance(tab, captureMethod, capturedAt, targetUrl, "Page details were unavailable.") };
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageDocument,
      args: [{ captureMethod, capturedAt, readableText, extendedMetadata, headings, maxArticleCharacters }],
    });
    if (!result?.provenance) throw new Error("No page context returned");
    result.provenance.contentHash = await contentHash(result.articleText);
    result.provenance.targetUrl = safeHttpUrl(targetUrl);
    if (!readableText) {
      result.provenance.extractionStatus = "complete";
      result.provenance.extractionError = null;
    }
    return result;
  } catch {
    return { articleText: null, provenance: fallbackProvenance(tab, captureMethod, capturedAt, targetUrl, "FoundKeep saved the source, but some page details were unavailable.") };
  }
}

// The page's details as a readable save keeps them — URL, title, site,
// description, author/dates, headings and readable text — so screenshots are
// as findable as saved pages.
function readablePageContext(tab, captureMethod, { preferences, policy }) {
  return capturePageContext(tab, {
    captureMethod,
    readableText: preferences.bookmark.readableText,
    extendedMetadata: preferences.bookmark.extendedMetadata,
    headings: preferences.bookmark.headings,
    maxArticleCharacters: policy.limits.articleCharacters,
  });
}

// `trigger` is 'dock' (the dock, via startCapture's default), or 'context' /
// 'keyboard' / 'twitter' from the callers that override it. Resolves with the
// saved record, or null when the user cancelled a screenshot selection.
export async function performCapture(action, { tab, info, tweet, text, attachPage, trigger = "dock", imageAccess = "granted" }) {
  const preferenceState = await getEffectivePreferences();
  const preferences = preferenceState.preferences;
  const captureMethod = captureMethodFor(action, trigger, { attachPage: !!attachPage && preferences.notes.attachSource });
  const limits = preferenceState.policy.limits;
  const feature = capturePreferenceKey(action);
  if (!preferences.capture[feature]) throw new Error(captureDisabledMessage(action));
  if (action !== "note" && action !== "tweet") await assertCaptureTab(tab);
  switch (action) {
    case "tweet": {
      const capturedAt = Date.now();
      return saveCapture({ type: "highlight", cloudType: "tweet", sourceUrl: tweet.url, sourceTitle: tweet.title,
        selectionText: boundedText(tweet.text, limits.selectionCharacters, "Post text"), socialContext: tweet.socialContext || null, capturedAt,
        provenance: fallbackProvenance({ url: tweet.url, title: tweet.title }, captureMethod, capturedAt) });
    }
    case "note": {
      if (typeof text !== "string" || !text.trim() || text.length > 50000) throw new Error("Write a note of up to 50,000 characters.");
      if (attachPage) await assertCaptureTab(tab);
      const context = attachPage && preferences.notes.attachSource
        ? await capturePageContext(tab, { captureMethod })
        : { provenance: fallbackProvenance(null, captureMethod, Date.now()) };
      return saveCapture({ type: "note", noteText: text.trim(), sourceUrl: context.provenance.pageUrl,
        sourceTitle: context.provenance.pageTitle, faviconUrl: context.provenance.faviconUrl,
        capturedAt: context.provenance.capturedAt, provenance: context.provenance });
    }
    case "region":
      // The corner-toolbar flow: drag a selection, or choose Full page there.
      return withDockHidden(tab.id, () => screenshotFlow(tab, trigger, preferenceState));
    case "fullpage":
      return withDockHidden(tab.id, () => fullPageScreenshot(tab, captureMethod, preferenceState));
    case "highlight":
      return saveHighlight(tab, captureMethod, limits);
    case "savepage": {
      const context = await readablePageContext(tab, captureMethod, preferenceState);
      return saveCapture({
        type: "bookmark",
        sourceUrl: context.provenance.pageUrl,
        sourceTitle: context.provenance.pageTitle,
        faviconUrl: context.provenance.faviconUrl,
        articleText: context.articleText,
        capturedAt: context.provenance.capturedAt,
        provenance: context.provenance,
      });
    }
    case "save-selection": {
      const context = await capturePageContext(tab, { captureMethod });
      return saveCapture({
        type: "highlight",
        sourceUrl: context.provenance.pageUrl,
        sourceTitle: context.provenance.pageTitle,
        faviconUrl: context.provenance.faviconUrl,
        selectionText: boundedText(info.selectionText, limits.selectionCharacters, "Selected text"),
        capturedAt: context.provenance.capturedAt,
        provenance: context.provenance,
      });
    }
    case "save-link": {
      const context = await capturePageContext(tab, { captureMethod, targetUrl: info.linkUrl });
      return saveCapture({
        type: "bookmark",
        sourceUrl: info.linkUrl,
        sourceTitle: (info.linkText || info.linkUrl || "").slice(0, 1000),
        faviconUrl: context.provenance.faviconUrl,
        capturedAt: context.provenance.capturedAt,
        provenance: context.provenance,
      });
    }
    case "save-image":
      return saveImage(info.srcUrl, tab, captureMethod, limits, imageAccess);
    default:
      return null;
  }
}

async function saveImage(srcUrl, tab, captureMethod, limits, imageAccess) {
  const context = await capturePageContext(tab, { captureMethod, targetUrl: srcUrl });
  const source = publicHttpUrl(srcUrl);
  if (!source) throw new Error("FoundKeep can only save images from public web addresses outside private networks.");
  const response = await fetch(source, {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    // Without the image site's permission only a CORS-enabled image can be
    // downloaded; say what still works instead of a raw "Failed to fetch".
    throw new Error(imageAccess === "granted"
      ? "The image could not be downloaded. Check your connection and try again."
      : "FoundKeep could not download this image from its site. Allow access when asked, or save a screenshot instead.");
  });
  if (!response.ok) throw new Error(`The image could not be downloaded (${response.status}).`);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > limits.imageBytes)
    throw new Error(`This image exceeds FoundKeep's ${Math.floor(limits.imageBytes / 1048576)} MiB capture limit.`);
  const mime = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!mime.startsWith("image/"))
    throw new Error("The selected address did not return an image.");
  cloudImageMime(new Blob([], { type: mime }));
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The selected image returned no data.");
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limits.imageBytes) {
        await reader.cancel();
        throw new Error(`This image exceeds FoundKeep's ${Math.floor(limits.imageBytes / 1048576)} MiB capture limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const blob = new Blob(chunks, { type: mime });
  cloudImageMime(blob);
  return saveCapture({
    type: "image",
    blob,
    sourceUrl: context.provenance.pageUrl,
    sourceTitle: context.provenance.pageTitle,
    faviconUrl: context.provenance.faviconUrl,
    capturedAt: context.provenance.capturedAt,
    provenance: context.provenance,
  });
}

// A rejection from chrome.scripting.executeScript / chrome.tabs.captureVisibleTab
// on a page the extension cannot script (no host permission, and no fresh
// activeTab grant because the dock triggered this without a toolbar click)
// carries a Chrome-authored message mentioning permission/access/activeTab.
// Surface FoundKeep's own remedy instead of that raw message.
function friendlyCaptureError(error) {
  const message = String(error?.message || error || "");
  return /permission|cannot access|activetab/i.test(message)
    ? new Error("Click the FoundKeep icon on this page to allow capture.")
    : error;
}

async function saveHighlight(tab, captureMethod, limits) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString() : "";
      let paragraph = "";
      if (sel && sel.rangeCount) {
        const node = sel.getRangeAt(0).commonAncestorContainer;
        const el = node.nodeType === 1 ? node : node.parentElement;
        paragraph = (
          el?.closest("p,li,article,section,div")?.innerText || ""
        ).slice(0, 1000);
      }
      return { text, paragraph };
    },
  }).catch(error => { throw friendlyCaptureError(error); });
  if (!result?.text) throw new Error("Select some text on the page first.");
  boundedText(result.text, limits.selectionCharacters, "Selected text");
  const context = await capturePageContext(tab, { captureMethod });
  return saveCapture(
    {
      type: "highlight",
      sourceUrl: context.provenance.pageUrl,
      sourceTitle: context.provenance.pageTitle,
      faviconUrl: context.provenance.faviconUrl,
      selectionText: result.text,
      selectionContext: { paragraph: result.paragraph },
      capturedAt: context.provenance.capturedAt,
      provenance: context.provenance,
    },
  );
}

// ---------------------------------------------------------------------------
// Screenshot: the corner-toolbar flow (screenshot-overlay.js)
// ---------------------------------------------------------------------------
async function screenshotFlow(tab, trigger, preferenceState) {
  const { preferences, policy: { limits } } = preferenceState;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: screenshotSelectInPage,
    args: [{ fullPage: !!preferences.capture.fullPage }],
  }).catch(error => { throw friendlyCaptureError(error); });
  if (!result) return null;
  if (result.busy) throw new Error("A screenshot is already in progress on this page.");
  if (result.fullPage) {
    if (!preferences.capture.fullPage) throw new Error(captureDisabledMessage("fullpage"));
    return fullPageScreenshot(tab, captureMethodFor("fullpage", trigger), preferenceState);
  }
  const { rect, dpr } = result;
  await assertCaptureTab(tab);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  }).catch(error => { throw friendlyCaptureError(error); });
  await assertCaptureTab(tab);
  const encoded = await cropDataUrl(dataUrl, rect, dpr, limits.imageBytes);
  const context = await readablePageContext(tab, captureMethodFor("region", trigger), preferenceState);
  return saveScreenshot(context, encoded);
}

function saveScreenshot(context, encoded) {
  return saveCapture({
    type: "screenshot",
    sourceUrl: context.provenance.pageUrl,
    sourceTitle: context.provenance.pageTitle,
    faviconUrl: context.provenance.faviconUrl,
    articleText: context.articleText,
    width: encoded.width,
    height: encoded.height,
    blob: encoded.blob,
    capturedAt: context.provenance.capturedAt,
    provenance: context.provenance,
  });
}

async function cropDataUrl(dataUrl, rect, dpr, maxBytes) {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const w = Math.round(rect.w * dpr),
    h = Math.round(rect.h * dpr);
  const canvas = new OffscreenCanvas(w, h);
  canvas
    .getContext("2d")
    .drawImage(
      bmp,
      Math.round(rect.x * dpr),
      Math.round(rect.y * dpr),
      w,
      h,
      0,
      0,
      w,
      h,
    );
  return encodeCanvas(canvas, [0.92, 0.8, 0.65, 0.5], maxBytes);
}

// ---------------------------------------------------------------------------
// Full-page screenshot
// ---------------------------------------------------------------------------
const MAX_PAGE_PX = 15000;
const MAX_PAGE_PIXELS = 32_000_000;
const MAX_IMAGE_DIMENSION = 32_768;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function assertCaptureTab(tab) {
  const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (active?.id !== tab.id || active?.url !== tab.url)
    throw new Error("The page changed during capture. Return to the page and try again.");
}

async function fullPageScreenshot(tab, captureMethod, preferenceState) {
  const limits = preferenceState.policy.limits;
  const [{ result: dims }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: prepFullPage,
  }).catch(error => { throw friendlyCaptureError(error); });
  const dpr = Math.max(1, Number(dims.dpr) || 1);
  const pixelWidth = Math.round(dims.viewW * dpr);
  if (!pixelWidth || pixelWidth > MAX_IMAGE_DIMENSION) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: restoreFullPage }).catch(() => {});
    throw new Error("This page is too wide to capture safely at the current display scale.");
  }
  const pagePixels = Math.min(MAX_PAGE_PIXELS, limits.fullPagePixels);
  const pageHeight = Math.min(MAX_PAGE_PX, limits.fullPageCssHeight);
  const heightByArea = Math.floor(pagePixels / (dims.viewW * dpr * dpr));
  const heightByDimension = Math.floor(MAX_IMAGE_DIMENSION / dpr);
  const totalH = Math.max(1, Math.min(dims.totalHeight, pageHeight, heightByArea, heightByDimension));
  const shots = [];
  try {
    for (let y = 0; y < totalH; y += dims.viewH) {
      const [{ result: actualY }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (yy) => {
          window.scrollTo(0, yy);
          return window.scrollY;
        },
        args: [y],
      });
      await sleep(500);
      await assertCaptureTab(tab);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      }).catch(error => { throw friendlyCaptureError(error); });
      await assertCaptureTab(tab);
      shots.push({ y: actualY, dataUrl });
      if (actualY + dims.viewH >= totalH) break;
    }
  } finally {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: restoreFullPage,
    });
  }
  const encoded = await stitch(shots, dims, totalH, limits.imageBytes);
  const context = await readablePageContext(tab, captureMethod, preferenceState);
  return saveScreenshot(context, encoded);
}

function prepFullPage() {
  window.__atlasHidden = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let scanned = 0;
  while (scanned++ < 50_000) {
    const el = walker.nextNode();
    if (!el) break;
    const pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") {
      window.__atlasHidden.push([el, el.style.visibility]);
      el.style.visibility = "hidden";
    }
  }
  window.__atlasScrollY = window.scrollY;
  window.__atlasScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  return {
    totalHeight: document.documentElement.scrollHeight,
    viewH: window.innerHeight,
    viewW: window.innerWidth,
    dpr: window.devicePixelRatio || 1,
  };
}

function restoreFullPage() {
  for (const [el, vis] of window.__atlasHidden || []) el.style.visibility = vis;
  document.documentElement.style.scrollBehavior = window.__atlasScrollBehavior || "";
  window.scrollTo(0, window.__atlasScrollY || 0);
  delete window.__atlasHidden;
  delete window.__atlasScrollY;
  delete window.__atlasScrollBehavior;
}

async function encodeCanvas(canvas, qualities = [0.9, 0.75, 0.6, 0.45], maxBytes = MAX_IMAGE_BYTES) {
  for (const quality of qualities) {
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    if (blob.size <= Math.min(MAX_IMAGE_BYTES, maxBytes))
      return { blob, width: canvas.width, height: canvas.height };
  }
  throw new Error(`This screenshot is too detailed for FoundKeep's ${Math.floor(Math.min(MAX_IMAGE_BYTES, maxBytes) / 1048576)} MiB capture limit. Capture a smaller region or reduce the page zoom.`);
}

async function stitch(shots, dims, totalH, maxBytes) {
  const canvas = new OffscreenCanvas(
    Math.round(dims.viewW * dims.dpr),
    Math.round(totalH * dims.dpr),
  );
  const ctx = canvas.getContext("2d");
  for (const shot of shots) {
    const bmp = await createImageBitmap(
      await (await fetch(shot.dataUrl)).blob(),
    );
    ctx.drawImage(bmp, 0, Math.round(shot.y * dims.dpr));
  }
  return encodeCanvas(canvas, undefined, maxBytes);
}

// The dock's two extension-origin frames and the saves they act on.
//
// "Add details" — optional edits to a save that has already happened. After
// every save the background remembers it as its tab's last save. When the
// dock's "Add details" is clicked, grantDetails() mints a one-time grant for
// exactly that save on exactly that tab, and the dock frames
// review.html?tab=<id>&grant=<nonce> (the details card).
//
// The note field — note.html?tab=<id>&grant=<nonce> — is framed the same way
// so the page never sees what is typed into it; its grant lets it save one
// note for that tab.
//
// A frame can only act while framed in the tab its grant was minted for,
// carrying that grant (frameGrantFor); another tab, a newer grant, or a page
// that frames the page itself gets nothing. The maps live in
// chrome.storage.session so an MV3 service-worker restart keeps them.
import * as db from './db.js';
import { captureBinding, libraryRequest, syncCaptureDetails } from './cloud.js';
import { drainQueue } from './capture.js';
import { normalizeSaveTags } from './save-details.js';

const LAST_KEY = 'foundkeep-last-saves';
const GRANTS = {
  details: { key: 'foundkeep-details-grants', page: 'src/review.html' },
  note: { key: 'foundkeep-note-grants', page: 'src/note.html' },
};
const read = async key => (await chrome.storage.session.get(key))[key] || {};
const write = (key, value) => chrome.storage.session.set({ [key]: value });
// Every read-modify-write of these maps goes through one queue so two saves
// (or a save and a tab closing) cannot overwrite each other's entry.
let queue = Promise.resolve();
const exclusive = run => { const next = queue.catch(() => {}).then(run); queue = next.catch(() => {}); return next; };

export function rememberSave(tabId, captureId) {
  return exclusive(async () => { const last = await read(LAST_KEY); last[tabId] = captureId; await write(LAST_KEY, last); });
}
export function forgetTab(tabId) {
  return exclusive(async () => {
    const values = { [LAST_KEY]: await read(LAST_KEY) };
    for (const { key } of Object.values(GRANTS)) values[key] = await read(key);
    for (const map of Object.values(values)) delete map[tabId];
    await chrome.storage.session.set(values);
  });
}
function mintGrant(kind, tabId, data = {}) {
  const { key, page } = GRANTS[kind];
  return exclusive(async () => {
    const grants = await read(key);
    const nonce = crypto.randomUUID();
    grants[tabId] = { nonce, ...data };
    await write(key, grants);
    return chrome.runtime.getURL(`${page}?tab=${tabId}&grant=${nonce}`);
  });
}
function revokeGrant(kind, tabId) {
  const { key } = GRANTS[kind];
  return exclusive(async () => { const grants = await read(key); if (!grants[tabId]) return; delete grants[tabId]; await write(key, grants); });
}
/** The grant a frame may act on, or null. The sender must be the grant's own
 *  page, framed (frameId > 0) inside the very tab the grant was minted for,
 *  carrying that grant's nonce. */
async function frameGrantFor(kind, sender, tabId) {
  let url;
  try { url = new URL(sender.url); } catch { return null; }
  if (url.pathname !== '/' + GRANTS[kind].page) return null;
  const tab = Number(url.searchParams.get('tab')), nonce = url.searchParams.get('grant');
  if (!Number.isInteger(tab) || tab !== tabId || sender.tab?.id !== tab || !(sender.frameId > 0) || !nonce) return null;
  const grant = (await read(GRANTS[kind].key))[tab];
  return grant && grant.nonce === nonce ? grant : null;
}

/** A details-card URL for this tab's last save, or null when there is none. */
export async function grantDetails(tabId) {
  const captureId = (await read(LAST_KEY))[tabId];
  if (!captureId || !(await db.getCapture(captureId))) return null;
  return mintGrant('details', tabId, { captureId });
}
export const revokeDetails = tabId => revokeGrant('details', tabId);
export async function detailsCaptureFor(sender, tabId) { return (await frameGrantFor('details', sender, tabId))?.captureId || null; }
export const grantNote = tabId => mintGrant('note', tabId);
export const revokeNote = tabId => revokeGrant('note', tabId);
/** The frame's note grant, if it is open and unused. */
export async function noteGrantFor(sender, tabId) { const grant = await frameGrantFor('note', sender, tabId); return grant && !grant.used ? grant : null; }
/** One save per note field: marks the frame's grant used, or returns null if
 *  it is not this frame's, or already used (a second Enter). */
export async function consumeNote(sender, tabId) {
  const grant = await frameGrantFor('note', sender, tabId);
  if (!grant) return null;
  return exclusive(async () => {
    const grants = await read(GRANTS.note.key), current = grants[tabId];
    if (!current || current.nonce !== grant.nonce || current.used) return null;
    grants[tabId] = { ...current, used: true };
    await write(GRANTS.note.key, grants);
    return grant.nonce;
  });
}
/** A save that failed can be retried from the same field. */
export function releaseNote(tabId, nonce) {
  return exclusive(async () => {
    const grants = await read(GRANTS.note.key);
    if (grants[tabId]?.nonce !== nonce) return;
    grants[tabId] = { ...grants[tabId], used: false };
    await write(GRANTS.note.key, grants);
  });
}
/** Any grant of this frame's kind (used or not) — enough to relay its
 *  ready/resize/done to the dock. */
export async function frameMayRelay(kind, sender, tabId) { return !!(await frameGrantFor(kind, sender, tabId)); }

const SHAREABLE_IMAGE = ['screenshot', 'image'];
const FIELDS = { title: 'sourceTitle', note: 'noteText', folderId: 'folderId', tags: 'userTags' };
// What the save looks like now: the server's copy once it has uploaded (it
// may have been edited on the web, on mobile or by an agent since), except
// for local edits that have not reached the server yet. The read is bounded
// well inside the dock's 3 s window for the card to report ready; a slow or
// failed read shows the local copy instead. That stays safe: the card sends
// only fields the user changes, and the update fills untouched ones from
// the server's copy at that moment (cloud.js putCaptureDetails).
const SERVER_READ_MS = 1500;
async function currentValues(record, accountId) {
  const local = { sourceTitle: record.sourceTitle ?? null, noteText: record.noteText ?? null, folderId: record.folderId ?? null, userTags: record.userTags || [] };
  if (!record.cloudRemoteId) return local;
  let server, timer;
  try {
    server = (await Promise.race([
      libraryRequest('detail', { id: record.cloudRemoteId }, accountId),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('slow')), SERVER_READ_MS); }),
    ]))?.capture;
  } catch { return local; } finally { clearTimeout(timer); }
  if (!server) return local;
  const pending = new Set(record.detailsChanged || []);
  const values = { ...local };
  for (const field of Object.values(FIELDS)) if (!pending.has(field) && field in server) values[field] = field === 'userTags' ? server.userTags || [] : server[field] ?? null;
  return values;
}
// --- The preview and sync state the card shows -------------------------------------
const PREVIEW_WIDTH = 720; // 2× the card's 348px content width
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
/** A small WebP data URL of a stored image: scaled to 720px wide; a full page keeps its top. */
async function previewImage(blob, { top = false } = {}) {
  if (!blob || typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, PREVIEW_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const sourceHeight = Math.min(bitmap.height, Math.round(bitmap.width * (top ? 0.75 : 1.5)));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, bitmap.width, sourceHeight, 0, 0, width, height);
    bitmap.close?.();
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return 'data:image/webp;base64,' + btoa(binary);
  } catch { return null; }
}
/**
 * What was saved, for the card's preview — its kind and what to draw: a
 * small image (never the capture's own bytes), a post, a highlight or a page.
 */
async function previewFor(record) {
  const method = record.provenance?.captureMethod || '';
  const site = hostOf(record.sourceUrl);
  const dims = record.width && record.height ? { width: record.width, height: record.height } : {};
  if (record.type === 'note') return { kind: 'note' };
  if (record.type === 'screenshot') {
    const fullpage = /full-page$/.test(method);
    return { kind: fullpage ? 'fullpage' : 'region', site, ...dims, image: await previewImage(record.blob, { top: fullpage }) };
  }
  if (record.type === 'image') return { kind: 'image', site, ...dims, image: await previewImage(record.blob) };
  if (record.type === 'highlight' && (record.cloudType === 'tweet' || method === 'twitter-action')) {
    const who = String(record.sourceTitle || '').match(/^(.*) \(@([^)]+)\) on X$/);
    const photo = (record.socialContext?.images || []).find(url => /^https:\/\/pbs\.twimg\.com\/media\//.test(url)) || null;
    return { kind: 'post', site: 'x.com', author: who?.[1] || 'Post', handle: who ? '@' + who[2] : '', text: String(record.selectionText || '').slice(0, 600), image: photo };
  }
  if (record.type === 'highlight') return { kind: 'highlight', site, text: String(record.selectionText || '').slice(0, 600) };
  const p = record.provenance || {};
  return { kind: 'page', site: p.siteName || site, description: String(p.description || '').slice(0, 300), image: /^https:\/\//.test(p.leadImageUrl || '') ? p.leadImageUrl : null };
}
/** Where the save is: 'synced', 'queued' (waiting), 'failed', or 'local' (signed out). */
const syncFor = record => ({ state: record.cloudStatus === 'synced' ? 'synced' : ['queued', 'failed', 'local'].includes(record.cloudStatus) ? record.cloudStatus : 'queued', error: record.cloudStatus === 'failed' ? record.cloudError || null : null });
export async function readCaptureSync(captureId) {
  const record = await db.getCapture(captureId);
  if (!record) throw new Error('This save is no longer available.');
  return syncFor(record);
}
/** What the card shows: the save's own fields, a small preview and its sync state. */
export async function readCaptureDetails(captureId) {
  const record = await db.getCapture(captureId);
  const { cloudAccountId } = await captureBinding();
  if (!record) throw new Error('This save is no longer available. Use Add details again after your next save.');
  if (!cloudAccountId || record.cloudAccountId !== cloudAccountId) throw new Error('Your connected account changed. This save belongs to another account.');
  const values = await currentValues(record, cloudAccountId);
  const submission = record.collectionSubmission;
  return {
    accountId: cloudAccountId,
    type: record.type,
    cloudType: record.cloudType || null,
    title: values.sourceTitle || '',
    note: values.noteText || '',
    tags: values.userTags,
    folderId: values.folderId || '',
    sourceUrl: /^https?:\/\//.test(record.sourceUrl || '') ? record.sourceUrl : '',
    excerpt: String(record.selectionText || (record.type === 'note' ? '' : record.noteText) || '').slice(0, 2000),
    canShareImage: SHAREABLE_IMAGE.includes(record.type),
    shared: submission ? { title: submission.title || 'a collection', status: record.collectionEntryStatus || 'pending' } : null,
    preview: await previewFor(record),
    sync: syncFor(record),
  };
}

const FORM_KEYS = ['title', 'note', 'folderId', 'tags', 'share'];
const SHARE_KEYS = ['collectionId', 'title', 'url', 'body', 'tags', 'shareImage'];
const text = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be ${max.toLocaleString('en-US')} characters or fewer.`);
  return value.trim();
};
/** Apply the card's edits to its save. The form carries only the fields the
 *  user changed (plus an optional share). Before upload the local record is
 *  updated so the pending upload carries them; after upload just those fields
 *  are sent as an update (cloud.js), and a share as a collection entry. */
export async function applyCaptureDetails(captureId, form) {
  if (!form || typeof form !== 'object' || Array.isArray(form) || Object.keys(form).some(key => !FORM_KEYS.includes(key))) throw new Error('Invalid details.');
  const record = await db.getCapture(captureId);
  const { cloudAccountId: accountId } = await captureBinding();
  if (!record) throw new Error('This save is no longer available.');
  if (!accountId || record.cloudAccountId !== accountId) throw new Error('Your connected account changed. This save belongs to another account.');
  const patch = {};
  if ('title' in form) patch.sourceTitle = text(form.title, 1000, 'Title') || null;
  if ('note' in form) {
    patch.noteText = text(form.note, 50000, 'Note') || null;
    if (record.type === 'note' && !patch.noteText) throw new Error('A note needs some text.');
  }
  if ('tags' in form) patch.userTags = normalizeSaveTags(form.tags || []);
  if ('folderId' in form) {
    const folderId = form.folderId || null;
    if (folderId !== null && (typeof folderId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(folderId))) throw new Error('Choose a valid folder.');
    if (folderId) {
      const organization = await libraryRequest('organization', {}, accountId);
      if (!organization.folders?.some(folder => folder.id === folderId)) throw new Error('That folder is no longer available. Choose another folder.');
    }
    patch.folderId = folderId;
  }
  let submission = null;
  if (form.share) {
    const share = form.share;
    if (typeof share !== 'object' || Array.isArray(share) || Object.keys(share).some(key => !SHARE_KEYS.includes(key))) throw new Error('Invalid collection share.');
    if (record.collectionSubmission) throw new Error('This save is already shared with a collection.');
    const collections = await libraryRequest('collections', {}, accountId);
    const collection = collections.collections?.find(item => item.id === share.collectionId && item.canSubmit);
    if (!collection) throw new Error('This collection is no longer available. Choose another.');
    const entryTitle = text(share.title ?? '', 200, 'Title in collection'), body = text(share.body ?? '', 5000, 'Text in collection');
    if (!entryTitle) throw new Error('Add a title for the collection.');
    let url = '';
    if (share.url) {
      let parsed;
      try { parsed = new URL(share.url); } catch { throw new Error('Use a valid source link.'); }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.href.length > 2048) throw new Error('Use a valid source link.');
      url = parsed.href;
    }
    submission = { id: collection.id, visibility: collection.visibility, title: collection.title, clientId: crypto.randomUUID(),
      entry: { title: entryTitle, body, url, tags: normalizeSaveTags(share.tags || [], 10), shareImage: share.shareImage === true && SHAREABLE_IMAGE.includes(record.type) } };
  }
  const changed = Object.keys(patch);
  if (!changed.length && !submission) return { changed: false };
  const updated = await db.updateCaptureWith(captureId, current => {
    if (current.cloudAccountId !== accountId) throw new Error('Your connected account changed. This save belongs to another account.');
    if (submission && current.collectionSubmission) throw new Error('This save is already shared with a collection.');
    return {
      ...patch,
      ...(changed.length ? {
        detailsRevision: (current.detailsRevision || 0) + 1,
        detailsChanged: [...new Set([...(current.detailsChanged || []), ...changed])],
      } : {}),
      ...(submission ? { collectionSubmission: submission } : {}),
      // Back into the durable outbox (retrying now) until the server has
      // these details; a record already queued keeps its attempt count.
      ...(current.cloudStatus === 'queued' ? { cloudNextRetryAt: 0 } : { cloudStatus: 'queued', cloudError: null, cloudAttempts: 0, cloudNextRetryAt: 0 }),
    };
  });
  if (!updated) throw new Error('This save is no longer available.');
  try { chrome.runtime.sendMessage({ kind: 'atlas-changed' }).catch(() => {}); } catch { /* no open view */ }
  if (!updated.cloudRemoteId) { drainQueue().catch(() => {}); return { changed: true, uploaded: false }; }
  try {
    const { synced } = await syncCaptureDetails(captureId);
    return { changed: true, uploaded: true, synced };
  } catch (error) {
    // Kept locally and queued; the outbox retries it.
    drainQueue().catch(() => {});
    if (error.permanent) throw new Error(error.message);
    return { changed: true, uploaded: true, synced: false };
  }
}

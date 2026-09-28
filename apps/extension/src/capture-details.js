// "Add details" — optional edits to a save that has already happened.
//
// After every save the background remembers it as its tab's last save. When
// the dock's "Add details" is clicked, grantDetails() mints a one-time grant
// for exactly that save on exactly that tab, and the dock frames
// review.html?tab=<id>&grant=<nonce> (the details card). The card can only
// read and edit the save its grant names, and only while framed in that tab
// (detailsCaptureFor); a newer save on the tab, another tab, or a page that
// frames review.html itself gets nothing. Both maps live in
// chrome.storage.session so an MV3 service-worker restart keeps them.
import * as db from './db.js';
import { captureBinding, libraryRequest, syncCaptureDetails } from './cloud.js';
import { drainQueue } from './capture.js';
import { normalizeSaveTags } from './save-details.js';

const LAST_KEY = 'foundkeep-last-saves';
const GRANT_KEY = 'foundkeep-details-grants';
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
    const last = await read(LAST_KEY), grants = await read(GRANT_KEY);
    delete last[tabId]; delete grants[tabId];
    await chrome.storage.session.set({ [LAST_KEY]: last, [GRANT_KEY]: grants });
  });
}
/** A details-card URL for this tab's last save, or null when there is none. */
export function grantDetails(tabId) {
  return exclusive(async () => {
    const captureId = (await read(LAST_KEY))[tabId];
    if (!captureId || !(await db.getCapture(captureId))) return null;
    const grants = await read(GRANT_KEY);
    const nonce = crypto.randomUUID();
    grants[tabId] = { nonce, captureId };
    await write(GRANT_KEY, grants);
    return chrome.runtime.getURL(`src/review.html?tab=${tabId}&grant=${nonce}`);
  });
}
export function revokeDetails(tabId) {
  return exclusive(async () => { const grants = await read(GRANT_KEY); if (!grants[tabId]) return; delete grants[tabId]; await write(GRANT_KEY, grants); });
}
/** The capture id a details card may act on, or null. Checks the sender is a
 *  frame inside the very tab its grant was minted for, carrying that grant. */
export async function detailsCaptureFor(sender, tabId) {
  let url;
  try { url = new URL(sender.url); } catch { return null; }
  const tab = Number(url.searchParams.get('tab')), nonce = url.searchParams.get('grant');
  if (!Number.isInteger(tab) || tab !== tabId || sender.tab?.id !== tab || !(sender.frameId > 0) || !nonce) return null;
  const grant = (await read(GRANT_KEY))[tab];
  return grant && grant.nonce === nonce ? grant.captureId : null;
}

const SHAREABLE_IMAGE = ['screenshot', 'image'];
/** What the card shows: the save's own fields, never the capture bytes. */
export async function readCaptureDetails(captureId) {
  const record = await db.getCapture(captureId);
  const { cloudAccountId } = await captureBinding();
  if (!record) throw new Error('This save is no longer available. Use Add details again after your next save.');
  if (!cloudAccountId || record.cloudAccountId !== cloudAccountId) throw new Error('Your connected account changed. This save belongs to another account.');
  const submission = record.collectionSubmission;
  return {
    accountId: cloudAccountId,
    type: record.type,
    cloudType: record.cloudType || null,
    title: record.sourceTitle || '',
    note: record.noteText || '',
    tags: record.userTags || [],
    folderId: record.folderId || '',
    sourceUrl: /^https?:\/\//.test(record.sourceUrl || '') ? record.sourceUrl : '',
    excerpt: String(record.selectionText || (record.type === 'note' ? '' : record.noteText) || '').slice(0, 2000),
    canShareImage: SHAREABLE_IMAGE.includes(record.type),
    shared: submission ? { title: submission.title || 'a collection', status: record.collectionEntryStatus || 'pending' } : null,
  };
}

const FORM_KEYS = ['title', 'note', 'folderId', 'tags', 'share'];
const SHARE_KEYS = ['collectionId', 'title', 'url', 'body', 'tags', 'shareImage'];
const text = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be ${max.toLocaleString('en-US')} characters or fewer.`);
  return value.trim();
};
/** Apply the card's edits to its save. Before upload the local record is
 *  updated so the pending upload carries them; after upload the change is
 *  also sent as an update (and a share as a collection entry). An upload in
 *  flight is covered by the record's details revision (see cloud.js). */
export async function applyCaptureDetails(captureId, form) {
  if (!form || typeof form !== 'object' || Array.isArray(form) || Object.keys(form).some(key => !FORM_KEYS.includes(key))) throw new Error('Invalid details.');
  const record = await db.getCapture(captureId);
  const { cloudAccountId: accountId } = await captureBinding();
  if (!record) throw new Error('This save is no longer available.');
  if (!accountId || record.cloudAccountId !== accountId) throw new Error('Your connected account changed. This save belongs to another account.');
  const title = text(form.title ?? '', 1000, 'Title'), note = text(form.note ?? '', 50000, 'Note');
  if (record.type === 'note' && !note) throw new Error('A note needs some text.');
  const userTags = normalizeSaveTags(form.tags || []);
  const folderId = form.folderId || null;
  if (folderId !== null && (typeof folderId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(folderId))) throw new Error('Choose a valid folder.');
  if (folderId && folderId !== record.folderId) {
    const organization = await libraryRequest('organization', {}, accountId);
    if (!organization.folders?.some(folder => folder.id === folderId)) throw new Error('That folder is no longer available. Choose another folder.');
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
  const updated = await db.updateCaptureWith(captureId, current => {
    if (current.cloudAccountId !== accountId) throw new Error('Your connected account changed. This save belongs to another account.');
    if (submission && current.collectionSubmission) throw new Error('This save is already shared with a collection.');
    return {
      sourceTitle: title || null, noteText: note || null, userTags, folderId,
      detailsRevision: (current.detailsRevision || 0) + 1,
      ...(submission ? { collectionSubmission: submission } : {}),
      // Back into the durable outbox (retrying now) until the server has
      // these details; a record already queued keeps its attempt count.
      ...(current.cloudStatus === 'queued' ? { cloudNextRetryAt: 0 } : { cloudStatus: 'queued', cloudError: null, cloudAttempts: 0, cloudNextRetryAt: 0 }),
    };
  });
  if (!updated) throw new Error('This save is no longer available.');
  try { chrome.runtime.sendMessage({ kind: 'atlas-changed' }).catch(() => {}); } catch { /* no open view */ }
  if (!updated.cloudRemoteId) { drainQueue().catch(() => {}); return { uploaded: false }; }
  try {
    const { synced } = await syncCaptureDetails(captureId);
    return { uploaded: true, synced };
  } catch (error) {
    // Kept locally and queued; the outbox retries it.
    drainQueue().catch(() => {});
    if (error.permanent) throw new Error(error.message);
    return { uploaded: true, synced: false };
  }
}

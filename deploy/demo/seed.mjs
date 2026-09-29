#!/usr/bin/env node
// Fill the live demo with the design system's sample world. Rerunning resets
// the demo account's library to the same state. Only ever targets the demo
// gateway on this machine; the demo account's credentials stay in
// ~/.local/share/foundkeep-demo/state.json (mode 600), never in the repo.
//   /usr/bin/node deploy/demo/seed.mjs
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import * as world from '../../design-system/fixtures/world.ts';

const BASE = 'http://127.0.0.1:8818';
export const DEMO_EMAIL = 'lena@demo.foundkeep.invalid', DEMO_PASSWORD = 'keep-good-finds-demo';
const STATE = path.join(homedir(), '.local/share/foundkeep-demo/state.json');
const SAMPLES = path.resolve(import.meta.dirname, '../../design-system/public');

async function call(pathname, { method = 'GET', body, cookie, token } = {}) {
  const response = await fetch(BASE + pathname, { method, redirect: 'manual', headers: { Origin: BASE, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 200) }; }
  if (!response.ok) throw Object.assign(new Error(`${method} ${pathname} → ${response.status} ${text.slice(0, 200)}`), { status: response.status });
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

// 1. The one demo account. Sign in; if the backend has no such account (first
// run, wiped data, or deleted from the live dashboard) create it. The state
// file is written only once a session exists.
const stored = await readFile(STATE, 'utf8').then(JSON.parse).catch(() => null);
const state = { ...stored, email: DEMO_EMAIL, password: DEMO_PASSWORD, name: world.account.name };
const account = { email: state.email, password: state.password };
const works = async (pathname, auth) => call(pathname, auth).then(() => true, () => false);
async function webSession() {
  if (state.cookie && await works('/api/me', { cookie: state.cookie })) return state.cookie;
  try { return (await call('/api/auth/login', { method: 'POST', body: account })).cookie; }
  catch (error) {
    if (error.status !== 401) throw error;
    return (await call('/api/auth/register', { method: 'POST', body: { ...account, name: state.name } })).cookie
      || (await call('/api/auth/login', { method: 'POST', body: account })).cookie;
  }
}
const cookie = await webSession();
await writeFile(STATE, JSON.stringify({ email: state.email, password: state.password, name: state.name, cookie }, null, 2) + '\n', { mode: 0o600 });
await chmod(STATE, 0o600);

// Every app sign-in adds a connected device and the account has a limit, so the
// reset disconnects them all (the gateway signs in again on its next image).
for (const c of (await call('/api/me', { cookie })).data.connections || []) await call(`/api/connections/${c.id}`, { method: 'DELETE', cookie }).catch(() => {});
const token = (await call('/api/mobile/login', { method: 'POST', body: { email: state.email, password: state.password, deviceName: 'Demo seed' } })).data.token;
await writeFile(STATE, JSON.stringify({ ...state, cookie, token }, null, 2) + '\n', { mode: 0o600 });

// 2. Reset: remove every save, collection and folder the account has.
for (const archived of [false, true]) {
  for (;;) {
    const { data } = await call(`/api/captures?limit=100${archived ? '&archived=true' : ''}`, { cookie });
    if (!data.captures?.length) break;
    for (const c of data.captures) await call(`/api/captures/${c.id}`, { method: 'DELETE', cookie });
  }
}
for (const c of (await call('/api/collections', { cookie })).data.collections || []) if (c.role === 'owner') await call(`/api/collections/${c.id}`, { method: 'DELETE', cookie });
for (const f of (await call('/api/mobile/organization', { token })).data.folders || []) await call(`/api/mobile/folders/${f.id}`, { method: 'DELETE', token });

// 3. Folders, then a save of every kind the web can create (files need the app).
const folderIds = {};
for (const f of world.folders) folderIds[f.id] = (await call('/api/mobile/folders', { method: 'POST', token, body: { name: f.name } })).data.folder.id;
const dataUrl = async sample => 'data:image/jpeg;base64,' + (await readFile(path.join(SAMPLES, sample))).toString('base64');
// The backend wants a complete provenance record from a real capture method.
const METHOD = { extension: 'popup-save-page', 'extension-region': 'popup-region', 'extension-full-page': 'popup-full-page', 'extension-selection': 'popup-highlight', 'ios-share-url': 'ios-share-url' };
const provenanceFor = c => !c.provenance || !c.sourceUrl ? undefined : {
  schemaVersion: 1, captureMethod: METHOD[c.provenance.captureMethod] || 'popup-save-page', pageUrl: c.sourceUrl, canonicalUrl: c.sourceUrl, pageTitle: c.sourceTitle,
  siteName: c.provenance.siteName ?? null, description: c.provenance.description ?? null, authors: c.provenance.authors ?? [], publishedAt: null, modifiedAt: null,
  language: 'en', leadImageUrl: null, faviconUrl: null, targetUrl: null, headings: [], capturedAt: Math.min(c.capturedAt, Date.now()), extractedAt: null,
  extractorVersion: 1, contentHash: null, extractionStatus: 'complete', extractionError: null, sourceApplication: null };
const batchId = crypto.randomUUID();
let saved = 0;
for (const [kind, c] of Object.entries(world.saves)) {
  if (['document', 'audio', 'processing', 'failed'].includes(kind)) continue;
  const image = c.blobUrl ? await dataUrl(world.sampleFor(c)) : undefined;
  const type = c.type === 'video' ? 'bookmark' : c.type;
  const { data } = await call('/api/captures', { method: 'POST', cookie, body: {
    clientId: 'demo-' + kind, type, batchId: c.batchId ? batchId : undefined, sourceUrl: c.sourceUrl ?? undefined, sourceTitle: c.sourceTitle ?? undefined,
    selectionText: c.selectionText ?? undefined, noteText: c.noteText ?? undefined, articleText: c.articleText ?? undefined, dataUrl: image,
    capturedAt: Math.min(c.capturedAt, Date.now()), userTags: c.userTags, folderId: c.folderId ? folderIds[c.folderId] : undefined,
    provenance: provenanceFor(c) } });
  if (c.archivedAt) await call(`/api/captures/${data.capture.id}/archive`, { method: 'PUT', cookie, body: { archived: true, expectedUpdatedAt: data.capture.updatedAt } }).catch(() => {});
  saved++;
}

// 4. Collections with a few entries each.
for (const c of world.collections) {
  const { data } = await call('/api/collections', { method: 'POST', cookie, body: { title: c.title, slug: c.slug + '-' + randomBytes(3).toString('hex'), description: c.description,
    kind: c.kind === 'personal' ? 'personal' : 'group', visibility: c.visibility, submissionPolicy: c.submissionPolicy === 'approval' ? 'anyone' : c.submissionPolicy } });
  for (const s of [world.saves.bookmark, world.saves.post, world.saves.highlight])
    await call(`/api/collections/${data.collection.id}/entries`, { method: 'POST', cookie, body: { title: s.sourceTitle, url: s.sourceUrl, body: s.summary || s.selectionText || '', tags: s.userTags || [] } }).catch(() => {});
}
console.log(`Demo ready: ${saved} saves, ${world.folders.length} folders, ${world.collections.length} collections for ${state.email} (password in ${STATE}).`);

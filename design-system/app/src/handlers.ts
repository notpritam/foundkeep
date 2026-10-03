// The FoundKeep API as the app sees it, answered from the sample world by a
// mock service worker, so the real API client and real <Image> requests run
// unchanged. A story swaps any of these with parameters.msw.handlers.
import { http, HttpResponse } from 'msw';
import * as world from '../../fixtures/world.ts';
import type { Capture } from '../../../apps/mobile/src/api/types.ts';

const byId = (id: string) => world.allSaves.find(c => c.id === id) ?? (Object.values(world.realShapes) as Capture[]).find(c => c.id === id);
const page = (captures: Capture[]) => ({ captures, nextCursor: null, total: captures.length });
const sample = (capture: Capture) => new URL(world.sampleFor(capture), location.href).href;

export function listFor(url: URL): Capture[] {
  const q = url.searchParams.get('q')?.toLowerCase(), type = url.searchParams.get('type'), folderId = url.searchParams.get('folderId');
  const tag = url.searchParams.get('tag'), batchId = url.searchParams.get('batchId'), archived = url.searchParams.get('archived') === 'true';
  return world.allSaves.filter(c => !!c.archivedAt === archived)
    .filter(c => !q || [c.sourceTitle, c.noteText, c.selectionText, c.summary].some(v => v?.toLowerCase().includes(q)))
    .filter(c => !type || type === 'all' || c.type === type || (type === 'link' && c.type === 'bookmark'))
    .filter(c => !folderId || c.folderId === folderId)
    .filter(c => !tag || c.userTags?.includes(tag))
    .filter(c => !batchId || c.batchId === batchId)
    .sort((a, b) => b.capturedAt - a.capturedAt);
}

/** What's related to a save, as the backend finds it: saved together, the same site, a shared
 * tag, the same folder — most reasons first. */
export function relatedTo(id: string) {
  const save = byId(id);
  if (!save) return [];
  const host = (c: Capture) => { try { return new URL(c.sourceUrl ?? '').hostname.replace(/^www\./, ''); } catch { return null; } };
  return world.allSaves.filter(c => c.id !== id && !c.archivedAt).map(c => {
    const reasons: { kind: 'batch' | 'source' | 'tag' | 'folder'; label: string }[] = [];
    if (save.batchId && c.batchId === save.batchId) reasons.push({ kind: 'batch', label: 'Saved together' });
    if (host(save) && host(c) === host(save)) reasons.push({ kind: 'source', label: c.provenance?.siteName || host(c)! });
    const tag = c.userTags?.find(t => save.userTags?.includes(t));
    if (tag) reasons.push({ kind: 'tag', label: `#${tag}` });
    if (save.folderId && c.folderId === save.folderId) reasons.push({ kind: 'folder', label: c.folder?.name ?? 'the same folder' });
    return { capture: c, reasons };
  }).filter(item => item.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length || b.capture.capturedAt - a.capture.capturedAt).slice(0, 6);
}

export const automation = {
  available: true, enabled: false, fetchLinks: true, images: true, consentVersion: '2026-09', pro: false, canProcess: false, mode: 'manual',
  intervalHours: 24, monthlyLimit: 0, nextRunAt: null, usage: { used: 0, reserved: 0, limit: 0, monthlyLimit: 0 },
};

export const appHandlers = [
  http.get('*/api/mobile/me', () => HttpResponse.json({ account: world.account, connectionId: 'con-iphone', usage: world.usage })),
  http.get('*/api/mobile/captures', ({ request }) => HttpResponse.json(page(listFor(new URL(request.url))))),
  http.get('*/api/mobile/captures/:id/related', ({ params }) => HttpResponse.json({ items: relatedTo(String(params.id)) })),
  http.get('*/api/mobile/captures/:id/preservation', ({ params }) => HttpResponse.json({ preservation: world.preservations[String(params.id)] ?? null })),
  http.get('*/api/mobile/captures/:id/assets/:asset', ({ params }) => {
    const capture = byId(String(params.id));
    return capture ? HttpResponse.redirect(sample(capture), 302) : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/mobile/captures/:id/:kind', ({ params }) => {
    const capture = byId(String(params.id));
    return capture ? HttpResponse.redirect(sample(capture), 302) : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/mobile/captures/:id', ({ params }) => {
    const capture = byId(String(params.id));
    return capture ? HttpResponse.json({ capture: { ...capture, contentView: 'full' } }) : HttpResponse.json({ error: 'not_found' }, { status: 404 });
  }),
  http.get('*/api/mobile/organization', () => HttpResponse.json({ folders: world.folders, tags: world.tags, suggestedTags: ['Memory', 'Design'], suggestedFolders: ['Reading list'] })),
  http.get('*/api/mobile/notifications', () => HttpResponse.json({ enabled: false })),
  http.get('*/api/plan', () => HttpResponse.json(world.plans.free)),
  http.get('*/api/automation', () => HttpResponse.json(automation)),
  http.get('*/api/captures/:id/processing', () => HttpResponse.json({ job: null, processing: null })),
  http.get('*/api/auth/providers', () => HttpResponse.json({ providers: ['apple', 'google'] })),
  http.get('*/mobile-policy.json', () => HttpResponse.json({})),
  // Writes succeed and echo back, so buttons in stories behave.
  http.put('*/api/mobile/captures/:id', async ({ params, request }) => HttpResponse.json({ capture: { ...byId(String(params.id)), ...(await request.json() as object), updatedAt: Date.now() } })),
  http.put('*/api/mobile/captures/:id/archive', ({ params }) => HttpResponse.json({ capture: { ...byId(String(params.id)), archivedAt: Date.now() } })),
  http.post('*/api/captures', async ({ request }) => HttpResponse.json({ capture: { ...world.saves.note, ...(await request.json() as object), id: 'cap-new' }, duplicate: false })),
  http.post('*/api/mobile/folders', async ({ request }) => HttpResponse.json({ folder: { id: 'f-new', name: ((await request.json()) as { name: string }).name } })),
  http.all('*/api/*', ({ request }) => { console.warn(`[sample world] no handler for ${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ ok: true }); }),
];

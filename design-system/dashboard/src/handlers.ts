// The FoundKeep API as the dashboard sees it (/api/*, same origin), answered
// from the sample world by a mock service worker. A story swaps any of these
// with parameters.msw.handlers.story.
import { http, HttpResponse } from 'msw';
import * as world from '../../fixtures/world.ts';
import type { Capture as AppCapture } from '../../../apps/mobile/src/api/types.ts';

const undef = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v === null ? undefined : v]));
/** A sample save in the dashboard's shape: private bytes at the exact same-origin endpoints it trusts. */
export const toWeb = (c: AppCapture) => ({
  ...undef(c),
  blobUrl: c.blobUrl ? `/api/captures/${c.id}/blob` : undefined,
  previewUrl: c.previewUrl ? `/api/captures/${c.id}/preview` : undefined,
  fileUrl: c.fileUrl ? `/api/captures/${c.id}/file` : undefined,
  provenance: c.provenance ?? undefined,
});
const byId = (id: string) => world.allSaves.find(c => c.id === id);
export const me = { account: world.account, connections: world.connections.map(c => ({ ...c, clientKind: c.name === 'iPhone' ? 'mobile' : 'browser' })), usage: world.usage };

export const preferences = {
  preferences: {
    version: 1,
    capture: { region: true, fullPage: true, highlight: true, bookmark: true, image: true, tweet: true, note: true },
    bookmark: { readableText: true, extendedMetadata: true, headings: true },
    notes: { attachSource: true },
    popup: { actionOrder: ['bookmark', 'highlight', 'region', 'fullPage'], showRecent: true, recentCount: 5 },
    sync: { automatic: true },
    organization: { ocr: true, summaries: true, tags: true },
    feedback: { success: true },
    contextMenus: true,
  },
  revision: 3, updatedAt: world.NOW,
};
export const planFree = { pro: false, earlyAccess: true, features: { managedProcessing: false }, subscriptions: [], limits: { maxBytes: 1_000_000_000, maxCaptures: 1000, monthlyProcessing: 0 }, price: { currency: 'USD', monthly: 5 }, billing: { paddle: { available: true, canManage: false }, stripe: { available: false, canManage: false } } };
export const planPro = { ...planFree, pro: true, features: { managedProcessing: true }, subscriptions: [{ provider: 'paddle', active: true, status: 'active', renews: true, expiresAt: world.NOW + 20 * 86_400_000 }], limits: { maxBytes: 50_000_000_000, maxCaptures: 100_000, monthlyProcessing: 500 }, billing: { paddle: { available: true, canManage: true }, stripe: { available: false, canManage: false } } };

const collection = (c: (typeof world.collections)[number]) => ({
  id: c.id, slug: c.slug, title: c.title, description: c.description, tags: ['Design', 'Memory'].slice(0, c.id === 'col-kitchen' ? 0 : 2), rules: 'Share what you would send a friend.',
  kind: c.kind === 'personal' ? 'personal' : 'group', visibility: c.visibility, submissionPolicy: c.submissionPolicy === 'approval' ? 'anyone' : c.submissionPolicy,
  requireApproval: c.submissionPolicy === 'approval', createdAt: world.NOW - 40 * 86_400_000, updatedAt: world.NOW - 86_400_000, ownerName: world.account.name,
  entries: c.entries, followers: c.visibility === 'public' ? 38 : 0, role: 'owner', canSubmit: true, canModerate: true, following: false,
});
export const collections = world.collections.map(collection);
const entry = (c: AppCapture, status: 'approved' | 'pending' = 'approved') => ({
  id: 'entry-' + c.id, title: c.sourceTitle || 'Untitled', url: c.sourceUrl, body: c.summary || c.selectionText || c.noteText || '', tags: c.userTags || [],
  status, createdAt: c.capturedAt, updatedAt: c.updatedAt, authorName: status === 'pending' ? 'Ada Kowalski' : world.account.name,
  imageUrl: c.blobUrl || c.previewUrl ? new URL(world.sampleFor(c), location.href).href : null, canRemove: true, canMove: true,
});
export const collectionDetail = (id: string) => {
  const c = collections.find(x => x.id === id) || collections[0];
  const entries = [entry(world.saves.bookmark), entry(world.saves.post), entry(world.saves.highlight), entry(world.saves.image), entry(world.saves.video, 'pending')];
  return { collection: c, entries, nextCursor: null, pending: 1, total: entries.length, availableTags: ['Design', 'Memory', 'Reading'] };
};

export const mindMap = () => {
  const saves = world.library.slice(0, 10);
  const tags = world.tags.map(t => t.name);
  const nodes = [...saves.map(c => ({ id: 'save:' + c.id, kind: 'save', label: c.sourceTitle || 'Untitled', saveId: c.id, type: c.type, sourceUrl: c.sourceUrl, summary: c.summary, tags: c.userTags, createdAt: c.capturedAt })),
    ...tags.map(t => ({ id: 'tag:' + t, kind: 'tag', label: t }))];
  const edges = saves.flatMap(c => (c.userTags || []).filter(t => tags.includes(t)).map(t => ({ id: `${c.id}-${t}`, source: 'save:' + c.id, target: 'tag:' + t, kind: 'tag', label: t })));
  return { nodes, edges, totalSaves: world.library.length, matchingSaves: saves.length, shownSaves: saves.length, truncated: false, totalTags: tags.length, shownTags: tags.length, focus: null, query: '' };
};

function listFor(url: URL) {
  const q = url.searchParams.get('q')?.toLowerCase(), type = url.searchParams.get('type'), archived = url.searchParams.get('archived') === 'true';
  return world.allSaves.filter(c => !!c.archivedAt === archived)
    .filter(c => !q || [c.sourceTitle, c.noteText, c.selectionText, c.summary].some(v => v?.toLowerCase().includes(q)))
    .filter(c => !type || c.type === type)
    .sort((a, b) => b.capturedAt - a.capturedAt).map(toWeb);
}
const sample = (c: AppCapture) => HttpResponse.redirect(new URL(world.sampleFor(c), location.href).href, 302);

export const dashboardHandlers = [
  http.get('*/api/me', () => HttpResponse.json(me)),
  http.get('*/api/auth/session', () => HttpResponse.json(me)),
  http.get('*/api/preferences', () => HttpResponse.json(preferences)),
  http.put('*/api/preferences', async ({ request }) => HttpResponse.json({ ...preferences, preferences: (await request.json() as { preferences?: object }).preferences || preferences.preferences, revision: preferences.revision + 1 })),
  http.get('*/api/captures', ({ request }) => { const captures = listFor(new URL(request.url)); return HttpResponse.json({ captures, nextCursor: null, total: captures.length }); }),
  http.get('*/api/captures/:id/preservation', () => HttpResponse.json({ preservation: null })),
  http.get('*/api/captures/:id/processing', () => HttpResponse.json({ job: null, processing: null })),
  http.get('*/api/captures/:id/:kind', ({ params }) => {
    const c = byId(String(params.id));
    if (!c || !['blob', 'preview', 'file'].includes(String(params.kind))) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return sample(c);
  }),
  http.get('*/api/captures/:id', ({ params }) => { const c = byId(String(params.id)); return c ? HttpResponse.json({ capture: toWeb(c) }) : HttpResponse.json({ error: 'not_found' }, { status: 404 }); }),
  http.get('*/api/plan', () => HttpResponse.json(planFree)),
  http.get('*/api/automation', () => HttpResponse.json({ available: true, enabled: false, fetchLinks: true, images: true, consentVersion: '2026-09', mode: 'manual', intervalHours: 24, monthlyLimit: 0, nextRunAt: null, usage: { cycle: '2026-09', used: 0, reserved: 0, limit: 0 }, activity: [] })),
  http.get('*/api/collections', () => HttpResponse.json({ collections, invitations: [{ id: 'inv-1', title: 'Field recordings', slug: 'field-recordings', role: 'contributor' }], canCreateGroup: true })),
  http.get('*/api/collections/:id', ({ params }) => HttpResponse.json(collectionDetail(String(params.id)))),
  http.get('*/api/collections/:id/members', () => HttpResponse.json({ members: [{ id: 'm-1', name: world.account.name, email: world.account.email, role: 'owner' }, { id: 'm-2', name: 'Ada Kowalski', email: 'ada@example.com', role: 'moderator' }, { id: 'm-3', name: 'Sam Ortiz', email: 'sam@example.com', role: 'contributor' }] })),
  http.get('*/api/graph', () => HttpResponse.json(mindMap())),
  http.get('*/api/agents', () => HttpResponse.json({ agents: [{ id: 'agent-1', name: 'Claude Code', scopes: ['library:read', 'library:write'], expiresAt: world.NOW + 30 * 86_400_000, lastSeenAt: world.NOW - 3_600_000 }], nudges: [] })),
  http.get('*/api/agents/nudges', () => HttpResponse.json({ nudges: [] })),
  http.post('*/api/pairing', () => HttpResponse.json({ code: 'K7Q-2MD' })),
  http.get('*/customer-config.json', () => HttpResponse.json({ extensionIds: ['cficnecbdbiddngllpfbacabgbcjinmk', 'mjfcgmboaijfcaanepdipbgmipnccnpn'], storeUrl: 'https://chromewebstore.google.com/detail/cficnecbdbiddngllpfbacabgbcjinmk', iphone: { distribution: 'private-beta', url: '/support.html#iphone-beta' } })),
  http.all('*/api/*', ({ request }) => { console.warn(`[sample world] no handler for ${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ ok: true }); }),
];

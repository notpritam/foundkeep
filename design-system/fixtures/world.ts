// The sample world every App and Dashboard story renders: one account with a
// library holding a save of every kind. Pure data, no imports that run; each
// Storybook maps it onto its product's API in its own mock handlers.
import type { Capture, Folder } from '../../apps/mobile/src/api/types.ts';

export const NOW = Date.parse('2026-09-29T09:00:00Z');
const hours = (n: number) => NOW - n * 3_600_000;

export const account = { id: 'acc-lena', email: 'lena@foundkeep.example', name: 'Lena Kovacs', createdAt: Date.parse('2026-06-01T09:00:00Z'), hasPassword: true };
export const usage = { captures: 128, bytes: 412_000_000, maxCaptures: 1000, maxBytes: 1_000_000_000 };
export const connections = [
  { id: 'con-iphone', name: 'iPhone', createdAt: Date.parse('2026-06-02T09:00:00Z'), lastSeenAt: hours(1) },
  { id: 'con-chrome', name: 'Chrome on MacBook', createdAt: Date.parse('2026-06-03T09:00:00Z'), lastSeenAt: hours(0.2) },
];

export const folders: Folder[] = [
  { id: 'f-reading', name: 'Reading list', count: 42 },
  { id: 'f-research', name: 'Research', count: 17 },
  { id: 'f-kitchen', name: 'Kitchen', count: 9 },
  { id: 'f-design', name: 'Design references', count: 23 },
];
export const tags = [{ name: 'Memory', count: 12 }, { name: 'Design', count: 20 }, { name: 'Reading', count: 31 }, { name: 'Cooking', count: 8 }, { name: 'AI', count: 6 }];

/** Sample images, served from the Storybook's own /samples/ directory. */
export const SAMPLES = { article: 'samples/region.jpg', fullpage: 'samples/fullpage.jpg', chart: 'samples/image.jpg' } as const;

const base = {
  clientId: 'sample', batchId: null, status: 'done', sourceUrl: null, sourceTitle: null, selectionText: null, noteText: null, articleText: null,
  summary: null, ocrText: null, category: null, tags: [], userTags: [], folderId: null, folder: null, previewUrl: null, blobUrl: null,
  fileName: null, fileMime: null, fileBytes: 0, fileUrl: null, width: null, height: null, archivedAt: null, enrichError: null, provenance: null,
} satisfies Partial<Capture>;
const folder = (id: string) => ({ folderId: id, folder: folders.find(f => f.id === id) || null });
const at = (n: number) => ({ capturedAt: hours(n), createdAt: hours(n), updatedAt: hours(n) });

const ARTICLE = 'In 1885 Hermann Ebbinghaus sat alone in a room memorising nonsense syllables, and then measured how fast he forgot them. The curve he drew has outlived almost everything else written about memory that decade.\n\nWhat the curve does not show is what happens when you come back. Every return flattens it. The half-life of an idea is not fixed; it is something you set, by deciding what is worth a second look.';

/** One save of every kind, keyed by what it is. `image` says which sample stands in for its bytes. */
export const saves = {
  bookmark: { ...base, ...at(5), ...folder('f-reading'), id: 'cap-bookmark', type: 'bookmark', savedVia: 'browser', sourceTitle: 'The half-life of a good idea', sourceUrl: 'https://themargin.example/half-life', summary: 'Most of what we read is gone within a week. A small practice of keeping — not hoarding — changes what stays.', articleText: ARTICLE, userTags: ['Memory', 'Reading'], previewUrl: 'preview', width: 780, height: 400, provenance: { siteName: 'The Margin', authors: ['Lena Kovacs'], description: 'Most of what we read is gone within a week.', captureMethod: 'extension' } },
  region: { ...base, ...at(8), ...folder('f-research'), id: 'cap-region', type: 'screenshot', savedVia: 'browser', sourceTitle: 'Forgetting curve — region', sourceUrl: 'https://themargin.example/half-life', blobUrl: 'blob', fileMime: 'image/jpeg', width: 780, height: 400, userTags: ['Memory'], ocrText: 'The half-life of a good idea', provenance: { siteName: 'The Margin', captureMethod: 'extension-region' } },
  fullpage: { ...base, ...at(26), id: 'cap-fullpage', type: 'screenshot', savedVia: 'browser', sourceTitle: 'The Margin — full page', sourceUrl: 'https://themargin.example/', blobUrl: 'blob', fileMime: 'image/jpeg', width: 1280, height: 1787, provenance: { siteName: 'The Margin', captureMethod: 'extension-full-page' } },
  image: { ...base, ...at(30), ...folder('f-design'), id: 'cap-image', type: 'image', savedVia: 'iphone', sourceTitle: 'Forgetting curve with reviews', blobUrl: 'blob', fileMime: 'image/jpeg', fileName: 'curve.jpg', fileBytes: 84_000, width: 700, height: 301, userTags: ['Design'] },
  post: { ...base, ...at(3), id: 'cap-post', type: 'tweet', savedVia: 'iphone', sourceTitle: 'Ada Kowalski (@adak) on X', sourceUrl: 'https://x.com/adak/status/1840000000000000000', selectionText: 'Spaced repetition is not a study hack. It is what remembering looks like when you stop pretending you will reread everything.', blobUrl: 'blob', fileMime: 'image/jpeg', width: 700, height: 301, userTags: ['Memory'], provenance: { siteName: 'X', authors: ['Ada Kowalski'], captureMethod: 'ios-share-url' } },
  highlight: { ...base, ...at(50), ...folder('f-reading'), id: 'cap-highlight', type: 'selection', savedVia: 'browser', sourceTitle: 'The half-life of a good idea', sourceUrl: 'https://themargin.example/half-life', selectionText: 'Memory is built to discard; keeping everything would be its own kind of noise. The question is not how to remember more, but how to choose.', userTags: ['Memory'], provenance: { siteName: 'The Margin', captureMethod: 'extension-selection' } },
  note: { ...base, ...at(2), id: 'cap-note', type: 'note', savedVia: 'iphone', sourceTitle: 'Call notes', noteText: 'Ask Lena about the follow-up piece on forgetting curves. She mentioned a study on spaced review for design critiques.', userTags: ['Research'] },
  document: { ...base, ...at(72), ...folder('f-research'), id: 'cap-document', type: 'document', savedVia: 'iphone', sourceTitle: 'Autumn research brief', fileName: 'Autumn Research Brief.pdf', fileMime: 'application/pdf', fileBytes: 2_400_000, fileUrl: 'file', previewUrl: 'preview', width: 1280, height: 1787, summary: 'Twelve pages on how teams keep and revisit what they learn.' },
  audio: { ...base, ...at(96), id: 'cap-audio', type: 'audio', savedVia: 'iphone', sourceTitle: 'Voice memo — kitchen ideas', fileName: 'Kitchen ideas.m4a', fileMime: 'audio/mp4', fileBytes: 1_100_000, fileUrl: 'file', userTags: ['Cooking'] },
  video: { ...base, ...at(120), id: 'cap-video', type: 'video', savedVia: 'browser', sourceTitle: 'How memory works — a 12 minute tour', sourceUrl: 'https://www.youtube.com/watch?v=sample', previewUrl: 'preview', width: 780, height: 400, provenance: { siteName: 'YouTube', captureMethod: 'extension' } },
  batchA: { ...base, ...at(10), id: 'cap-batch-a', batchId: 'batch-kitchen', type: 'image', savedVia: 'iphone', sourceTitle: 'Pantry shelf', blobUrl: 'blob', fileMime: 'image/jpeg', width: 700, height: 301, ...folder('f-kitchen') },
  batchB: { ...base, ...at(10), id: 'cap-batch-b', batchId: 'batch-kitchen', type: 'image', savedVia: 'iphone', sourceTitle: 'Spice drawer', blobUrl: 'blob', fileMime: 'image/jpeg', width: 780, height: 400, ...folder('f-kitchen') },
  processing: { ...base, ...at(0.1), id: 'cap-processing', type: 'bookmark', status: 'processing', savedVia: 'browser', sourceTitle: 'A field guide to small details', sourceUrl: 'https://fieldnotes.example/small-details' },
  failed: { ...base, ...at(140), id: 'cap-failed', type: 'bookmark', status: 'failed', enrichError: 'The page could not be read.', sourceTitle: 'Members-only article', sourceUrl: 'https://paywalled.example/story' },
  archived: { ...base, ...at(400), id: 'cap-archived', type: 'bookmark', sourceTitle: 'Old conference schedule', sourceUrl: 'https://conf.example/2025', archivedAt: hours(200) },
} satisfies Record<string, Capture & { savedVia?: Capture['savedVia'] }>;

export type SaveKind = keyof typeof saves;
export const allSaves: Capture[] = Object.values(saves);
export const library: Capture[] = allSaves.filter(c => !c.archivedAt).sort((a, b) => b.capturedAt - a.capturedAt);

/** Which sample image stands in for a save's bytes (blob, file or preview). */
export function sampleFor(capture: Pick<Capture, 'id' | 'height' | 'width'>): string {
  if (capture.id === 'cap-fullpage' || capture.id === 'cap-document') return SAMPLES.fullpage;
  if (capture.width === 700) return SAMPLES.chart;
  return SAMPLES.article;
}

export const related = [
  { capture: saves.highlight, reasons: [{ kind: 'source', label: 'Same page' }] },
  { capture: saves.region, reasons: [{ kind: 'tag', label: 'Memory' }] },
  { capture: saves.post, reasons: [{ kind: 'tag', label: 'Memory' }] },
] as const;

export const plans = {
  free: { plan: 'free', pro: false, subscriptions: [], features: { imports: false, mcp: true, managedProcessing: false }, limits: { monthlyProcessing: 0, maxCaptures: 1000, maxBytes: 1_000_000_000 },
    billing: { revenuecat: { available: true, publicKey: null, appUserId: 'acc-lena', entitlementId: 'pro', productId: 'foundkeep_pro_monthly' }, stripe: { available: true, canManage: false } } },
  pro: { plan: 'pro', pro: true, subscriptions: [{ provider: 'revenuecat', status: 'active', expiresAt: NOW + 20 * 86_400_000, renews: true, sandbox: false, active: true }], features: { imports: true, mcp: true, managedProcessing: true }, limits: { monthlyProcessing: 500, maxCaptures: 100_000, maxBytes: 50_000_000_000 },
    billing: { revenuecat: { available: true, publicKey: null, appUserId: 'acc-lena', entitlementId: 'pro', productId: 'foundkeep_pro_monthly' }, stripe: { available: true, canManage: true } } },
} as const;

export const collections = [
  { id: 'col-design', title: 'Design that works', slug: 'design-that-works', kind: 'public', visibility: 'public', submissionPolicy: 'approval', role: 'owner', entries: 24, members: 3, description: 'Interfaces that get out of the way.' },
  { id: 'col-memory', title: 'Research: memory', slug: 'research-memory', kind: 'shared', visibility: 'private', submissionPolicy: 'members', role: 'owner', entries: 11, members: 4, description: 'Papers and notes for the spaced-review project.' },
  { id: 'col-kitchen', title: 'Kitchen notebook', slug: 'kitchen-notebook', kind: 'personal', visibility: 'private', submissionPolicy: 'owner', role: 'owner', entries: 9, members: 1, description: 'Recipes worth cooking twice.' },
] as const;

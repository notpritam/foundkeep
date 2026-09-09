import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db.ts';
import { relatedCaptures, type RelatedMetadata } from '../src/customer-related.ts';

let db: Database;
let app: ReturnType<typeof createApp>;
beforeEach(() => { db = openDb(':memory:'); app = createApp(db); });
afterEach(() => db.close());
async function request(path: string, token?: string, body?: unknown) {
  return app.request(`https://foundkeep.app/api${path}`, {
    method: body ? 'POST' : 'GET', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }) as Promise<Omit<Response, 'json'> & { json(): Promise<any> }>;
}
async function owner() {
  const response = await request('/mobile/register', undefined, { email: `${crypto.randomUUID()}@example.com`, name: 'Owner', password: 'a correct horse battery staple' });
  expect(response.status).toBe(201); return response.json();
}
async function save(token: string, extra: Record<string, unknown> = {}) {
  const response = await request('/captures', token, { clientId: crypto.randomUUID(), type: 'note', noteText: 'Saved content', ...extra });
  expect(response.status).toBe(201); return (await response.json()).capture;
}

test('related saves are private, explainable, exclude self and unrelated items, and contain only card excerpts', async () => {
  const a = await owner(), b = await owner();
  const batchId = crypto.randomUUID();
  const current = await save(a.token, { userTags: ['École'], batchId });
  const together = await save(a.token, { batchId });
  const tagged = await save(a.token, { userTags: ['éCOLE'], noteText: 'long text '.repeat(1000) });
  await save(a.token, { userTags: ['School'] });
  await save(b.token, { userTags: ['École'], batchId });
  const path = `/mobile/captures/${current.id}/related`;
  expect((await request(path)).status).toBe(401);
  expect((await request(path, b.token)).status).toBe(404);
  expect((await request('/mobile/captures/missing/related', a.token)).status).toBe(404);
  const response = await request(path, a.token);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  const result = await response.json();
  expect(result.items.map((item: any) => item.capture.id)).toEqual([together.id, tagged.id]);
  expect(result.items[0].reasons).toEqual([{ kind: 'batch', label: 'Saved together' }]);
  expect(result.items[1].reasons).toEqual([{ kind: 'tag', label: 'Shared tag: École' }]);
  expect(result.items[1].capture.noteText).toHaveLength(480);
  expect(result.items[1].capture.contentView).toBe('card');
  // Relations follow edits to either item without a second copy of the graph.
  db.query('UPDATE customer_captures SET manual_tags=\'[]\' WHERE id=?').run(tagged.id);
  expect((await (await request(path, a.token)).json()).items).toHaveLength(1);
});

const metadata = (extra: Partial<RelatedMetadata> = {}): RelatedMetadata => ({ id: 'self', account_id: 'owner', captured_at: 1, batch_id: null, folder_id: null, source_url: null, canonical_url: null, page_url: null, manual_tags: '[]', tags: '[]', ...extra });
test('source matching preserves content query parameters, ignores fragments and rejects unsafe URLs', () => {
  const current = metadata({ canonical_url: 'https://EXAMPLE.com/watch?v=one#position' });
  const items = [metadata({ id: 'same', source_url: 'https://example.com/watch?v=one#other' }), metadata({ id: 'different', source_url: 'https://example.com/watch?v=two' }), metadata({ id: 'foreign', account_id: 'elsewhere', source_url: current.canonical_url })];
  expect(relatedCaptures(current, items)).toEqual([{ id: 'same', reasons: [{ kind: 'source', label: 'Same source' }] }]);
  expect(relatedCaptures(metadata({ source_url: 'javascript:alert(1)' }), [metadata({ id: 'unsafe', source_url: 'javascript:alert(1)' })])).toEqual([]);
});
test('ranking is stable, bounded, deduplicated and handles suggested tags and empty organization', () => {
  const current = metadata({ folder_id: 'reading', manual_tags: '["Design"]' });
  const folder = metadata({ id: 'folder', folder_id: 'reading', captured_at: 999 });
  const tagged = metadata({ id: 'tag', tags: '["design"]' });
  const result = relatedCaptures(current, [folder, tagged, tagged, metadata(), metadata({ id: 'none', tags: 'invalid-json' })]);
  expect(result.map(item => item.id)).toEqual(['tag', 'folder']);
  const library = Array.from({ length: 20 }, (_, i) => metadata({ id: String(i), folder_id: 'reading', captured_at: i }));
  expect(relatedCaptures(current, library).map(item => item.id)).toEqual(['19', '18', '17', '16', '15', '14']);
  expect(relatedCaptures(metadata(), library)).toEqual([]);
});

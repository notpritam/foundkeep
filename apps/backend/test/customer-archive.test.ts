import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openDb } from '../src/db.ts';
import { createApp } from '../src/app.ts';
import { buildCustomerGraph } from '../src/customer-graph.ts';
import { customerChanges } from '../src/customer-changes.ts';
const origin = 'https://foundkeep.app';
let db: ReturnType<typeof openDb>, app: ReturnType<typeof createApp>;
beforeEach(() => { db = openDb(':memory:'); app = createApp(db); });
afterEach(() => db.close());
async function request(path: string, credential?: string, method = 'GET', body?: unknown) {
  const headers = new Headers({ origin });
  if (credential) headers.set(credential.startsWith('Bearer ') ? 'authorization' : 'cookie', credential);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return app.request(origin + '/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function owner() {
  const r = await request('/auth/register', undefined, 'POST', { email: crypto.randomUUID() + '@example.test', name: 'Archive test', password: 'a correct horse battery staple' });
  expect(r.status).toBe(201);
  const { account } = await r.json() as any;
  const cookie = r.headers.get('set-cookie')!.split(';')[0]!;
  const pairing = await (await request('/pairing', cookie, 'POST', {})).json() as any;
  const paired = await request('/pairing/claim', undefined, 'POST', { code: pairing.code, name: 'Archive phone' });
  const device = await paired.json() as any;
  expect(paired.status).toBe(201);
  return { cookie, bearer: 'Bearer ' + device.token, id: account.id };
}
async function save(cookie: string, text = 'Keep this note') {
  const r = await request('/captures', cookie, 'POST', { clientId: crypto.randomUUID(), type: 'note', noteText: text, processingOptions: { ocr: false, summaries: false, tags: false } });
  expect(r.status).toBe(201);
  return ((await r.json()) as any).capture;
}
async function archive(credential: string, capture: any, archived: boolean, mobile = false) {
  return request(`${mobile ? '/mobile' : ''}/captures/${capture.id}/archive`, credential, 'PUT', { archived, expectedUpdatedAt: capture.updatedAt });
}
test('archive and restore synchronize web/mobile lists without deleting content or changing usage', async () => {
  const a = await owner(), item = await save(a.cookie);
  const usage = ((await (await request('/me', a.cookie)).json()) as any).usage;
  const beforeChanges = customerChanges(db, a.id).cursor;
  const result = await archive(a.bearer, item, true, true);
  expect(result.status).toBe(200);
  const kept = ((await result.json()) as any).capture;
  expect(kept.archivedAt).toBeGreaterThan(0);
  expect(kept.updatedAt).toBeGreaterThan(item.updatedAt);
  expect(kept.noteText).toBe(item.noteText);
  for (const [prefix, token] of [['', a.cookie], ['/mobile', a.bearer]]) {
    const active = await (await request(`${prefix}/captures`, token)).json() as any;
    expect(active.total).toBe(0);
    const archived = await (await request(`${prefix}/captures?archived=true&q=Keep`, token)).json() as any;
    expect(archived.total).toBe(1); expect(archived.captures[0].id).toBe(item.id);
    expect((await request(`${prefix}/captures/${item.id}`, token)).status).toBe(200);
  }
  expect(((await (await request('/me', a.cookie)).json()) as any).usage).toEqual(usage);
  expect(buildCustomerGraph(db, a.id).totalSaves).toBe(0);
  expect(customerChanges(db, a.id, beforeChanges).changes.some(change => change.id === item.id)).toBe(true);
  const repeat = await archive(a.cookie, kept, true);
  expect(repeat.status).toBe(200);
  expect(((await repeat.json()) as any).capture.updatedAt).toBe(kept.updatedAt);
  const restored = await archive(a.cookie, kept, false);
  expect(restored.status).toBe(200);
  expect(((await restored.json()) as any).capture.archivedAt).toBeNull();
  expect(((await (await request('/mobile/captures', a.bearer)).json()) as any).total).toBe(1);
  expect(buildCustomerGraph(db, a.id).totalSaves).toBe(1);
});
test('archive checks ownership, input, revision, and authentication', async () => {
  const a = await owner(), other = await owner(), item = await save(a.cookie);
  expect((await archive(other.bearer, item, true, true)).status).toBe(404);
  expect((await archive(other.cookie, item, true)).status).toBe(404);
  expect((await request(`/captures/${item.id}/archive`, undefined, 'PUT', { archived: true, expectedUpdatedAt: item.updatedAt })).status).toBe(401);
  for (const body of [{ archived: 'true', expectedUpdatedAt: item.updatedAt }, { archived: true }, { archived: true, expectedUpdatedAt: item.updatedAt, noteText: 'overwrite' }]) {
    expect((await request(`/captures/${item.id}/archive`, a.cookie, 'PUT', body)).status).toBe(400);
  }
  expect((await archive(a.cookie, { ...item, updatedAt: item.updatedAt - 1 }, true)).status).toBe(409);
  expect((await request('/captures?archived=anything', a.cookie)).status).toBe(400);
  expect((await request('/mobile/captures?archived=anything', a.bearer)).status).toBe(400);
  expect(((await (await request('/captures', a.cookie)).json()) as any).total).toBe(1);
});
test('archive pagination counts only matching items and preserves saved media and relationships', async () => {
  const a = await owner();
  const items = [await save(a.cookie, 'First'), await save(a.cookie, 'Second'), await save(a.cookie, 'Third')];
  db.query("INSERT INTO customer_media_assets(id,capture_id,account_id,source_key,source_url,kind,position,title,mime,body_text,bytes,sha256,created_at) VALUES('kept-text',?,?, 'post','https://example.test','post',0,'Saved post','text/plain','Original caption',16,'hash',1)").run(items[0].id, a.id);
  db.query("INSERT INTO customer_capture_links(account_id,source_id,target_id,origin,created_at) VALUES(?,?,?,'manual',1)").run(a.id, items[0].id, items[2].id);
  for (const item of items.slice(0, 2)) expect((await archive(a.cookie, item, true)).status).toBe(200);
  const first = await (await request('/captures?archived=true&limit=1&sort=recent', a.cookie)).json() as any;
  const next = await (await request('/captures?archived=true&limit=1&sort=recent&cursor=' + first.nextCursor, a.cookie)).json() as any;
  expect(first.total).toBe(2); expect(next.total).toBe(2); expect(next.nextCursor).toBeNull();
  expect(new Set([...first.captures, ...next.captures].map(c => c.id))).toEqual(new Set(items.slice(0, 2).map(c => c.id)));
  expect((db.query("SELECT body_text FROM customer_media_assets WHERE id='kept-text'").get() as any).body_text).toBe('Original caption');
  expect((db.query('SELECT COUNT(*) n FROM customer_capture_links').get() as any).n).toBe(1);
  const related = await (await request(`/mobile/captures/${items[2].id}/related`, a.bearer)).json() as any;
  expect(related.items).toHaveLength(0);
  const exported = await request('/account/export', a.cookie);
  expect(exported.status).toBe(200);
  expect(await exported.text()).toContain('First');
});

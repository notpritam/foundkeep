import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openDb } from '../src/db.ts';
import { createApp } from '../src/app.ts';
const origin = 'https://foundkeep.app';
let db: ReturnType<typeof openDb>; let app: ReturnType<typeof createApp>;
beforeEach(() => { db = openDb(':memory:'); app = createApp(db); });
afterEach(() => db.close());
async function request(path: string, cookie: string, body?: unknown) {
  return app.request(origin + '/api' + path, { method: body ? 'POST' : 'GET', headers: { origin, cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}
async function account() {
  const response = await request('/auth/register', '', { email: crypto.randomUUID() + '@example.com', name: 'Import test', password: 'a sufficiently long test password' });
  expect(response.status).toBe(201);
  return { cookie: response.headers.get('set-cookie')!.split(';')[0]!, id: (await response.json() as any).account.id };
}
const entries = [
  { url: 'https://example.com/read', title: 'Read this', folderPath: ['Bookmarks', 'Reading'], addedAt: 123456, description: 'An original note', tags: ['craft'] },
  { url: 'https://github.com/project', title: 'A project', folderPath: ['Bookmarks', 'Work'], sourceId: '42' },
];
test('preview is read-only and import retains nested folders and original metadata', async () => {
  const owner = await account();
  const preview = await request('/imports/preview', owner.cookie, { source: 'edge', entries });
  expect(preview.status).toBe(200); expect((await preview.json() as any).newBookmarks).toBe(2);
  expect((db.query('SELECT COUNT(*) n FROM customer_captures').get() as any).n).toBe(0);
  const response = await request('/imports', owner.cookie, { importId: crypto.randomUUID(), chunk: 0, source: 'edge', entries });
  expect(response.status).toBe(200); expect((await response.json() as any).imported).toBe(2);
  const save = db.query('SELECT * FROM customer_captures WHERE source_url=?').get(entries[0]!.url) as any;
  expect(save.captured_at).toBe(123456); expect(save.note_text).toBe('An original note'); expect(JSON.parse(save.manual_tags)).toEqual(['craft']);
  expect(save.saved_via).toBe('dashboard');
  const folders = (await (await request('/organization', owner.cookie)).json() as any).folders;
  const reading = folders.find((folder: any) => folder.displayName === 'Bookmarks / Reading');
  expect(reading.path).toEqual(['Bookmarks', 'Reading']); expect(reading.parentId).toBeTruthy(); expect(save.folder_id).toBe(reading.id);
  const detail = await (await request('/captures/' + save.id, owner.cookie)).json() as any;
  expect(detail.capture.importOrigins[0].description).toBe('An original note'); expect(detail.capture.importOrigins[0].tags).toEqual(['craft']); expect(detail.capture.importOrigins[0].source).toBe('edge'); expect(detail.capture.importOrigins[0].folderPath).toEqual(['Bookmarks', 'Reading']);
});
test('retries are idempotent; duplicate imports retain source history without overwriting edits', async () => {
  const owner = await account(); const job = { importId: crypto.randomUUID(), chunk: 0, source: 'chrome', entries };
  const first = await (await request('/imports', owner.cookie, job)).json();
  expect(await (await request('/imports', owner.cookie, job)).json()).toEqual(first);
  expect((await request('/imports', owner.cookie, { ...job, entries: entries.slice(1) })).status).toBe(409);
  db.query("UPDATE customer_captures SET source_title='My edited title' WHERE source_url=?").run(entries[0]!.url);
  const duplicate = await (await request('/imports', owner.cookie, { ...job, importId: crypto.randomUUID(), source: 'brave' })).json() as any;
  expect(duplicate.imported).toBe(0); expect(duplicate.duplicates).toBe(2);
  expect((db.query('SELECT COUNT(*) n FROM customer_captures').get() as any).n).toBe(2);
  const saved = db.query('SELECT id,source_title FROM customer_captures WHERE source_url=?').get(entries[0]!.url) as any;
  expect(saved.source_title).toBe('My edited title');
  const detail = await (await request('/captures/' + saved.id, owner.cookie)).json() as any;
  expect(detail.capture.importOrigins.map((item: any) => item.source).sort()).toEqual(['brave', 'chrome']);
});
test('account scoping, unsafe URLs, bounded chunks and atomic storage limits are enforced', async () => {
  const a = await account(); const b = await account(); const importId = crypto.randomUUID();
  expect((await request('/imports', a.cookie, { importId, chunk: 0, source: 'chrome', entries })).status).toBe(200);
  expect((await (await request('/imports/preview', b.cookie, { source: 'chrome', entries })).json() as any).duplicates).toBe(0);
  expect((await request('/imports', b.cookie, { importId, chunk: 0, source: 'chrome', entries })).status).toBe(200);
  expect((await request('/imports', '', { importId, chunk: 1, source: 'chrome', entries })).status).toBe(401);
  const invalid = await (await request('/imports/preview', a.cookie, { source: 'chrome', entries: [{ url: 'javascript:alert(1)', title: 'bad', folderPath: [] }] })).json() as any;
  expect(invalid.skipped).toBe(1);
  expect((await request('/imports', a.cookie, { importId, chunk: 1, source: 'chrome', entries: Array(101).fill(entries[0]) })).status).toBe(400);
  db.query('UPDATE customer_captures SET storage_bytes=? WHERE account_id=?').run(200 * 1024 * 1024, a.id);
  const count = (db.query('SELECT COUNT(*) n FROM customer_folders WHERE account_id=?').get(a.id) as any).n;
  expect((await request('/imports', a.cookie, { importId, chunk: 1, source: 'chrome', entries: [{ url: 'https://new.example', title: 'new', folderPath: ['New folder'] }] })).status).toBe(413);
  expect((db.query('SELECT COUNT(*) n FROM customer_folders WHERE account_id=?').get(a.id) as any).n).toBe(count);
});

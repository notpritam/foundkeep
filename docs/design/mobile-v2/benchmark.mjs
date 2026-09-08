// Synthetic in-memory benchmark. No production account or stored content used.
// Run with: bun docs/design/mobile-v2/benchmark.mjs
import { openDb } from '../../../apps/backend/src/db.ts';
import { createApp } from '../../../apps/backend/src/app.ts';
const db = openDb(':memory:');
try {
  const app = createApp(db);
  const registration = await app.request('https://foundkeep.app/api/mobile/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'perf@example.com', name: 'Performance fixture', password: 'a synthetic performance password' }),
  });
  if (!registration.ok) throw new Error('Could not create benchmark fixture');
  const session = await registration.json();
  const articleText = 'A paragraph worth keeping. '.repeat(6000);
  for (let i = 0; i < 50; i++) {
    db.query(`INSERT INTO customer_captures(id,account_id,client_id,type,article_text,source_title,storage_bytes,captured_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(String(i), session.account.id, String(i), 'bookmark', articleText, `Saved article ${i}`, articleText.length, 50 - i, 1, 1);
  }
  const read = async view => {
    const start = performance.now();
    const response = await app.request(`https://foundkeep.app/api/mobile/captures?view=${view}`, { headers: { authorization: `Bearer ${session.token}` } });
    const body = await response.text();
    return { bytes: Buffer.byteLength(body), milliseconds: Number((performance.now() - start).toFixed(2)), count: JSON.parse(body).captures.length };
  };
  const full = await read('full');
  const cards = await read('cards');
  console.log(JSON.stringify({ fixture: `50 articles; ${articleText.length} characters each`, full, cards, reductionPercent: Number((100 * (1 - cards.bytes / full.bytes)).toFixed(2)) }, null, 2));
} finally { db.close(); }

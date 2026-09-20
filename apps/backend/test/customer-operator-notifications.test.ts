import { afterEach, beforeEach, expect, test } from 'bun:test';
import { openDb } from '../src/db.ts';
import { deliverOperatorAlert } from '../src/customer-notifications.ts';

let db: ReturnType<typeof openDb>;
const alert = { title: 'Session needs attention', body: 'Replace reddit.txt.' };
beforeEach(() => { db = openDb(':memory:'); process.env.FOUNDKEEP_ADMIN_EMAILS = ' ADMIN@example.test '; });
afterEach(() => { db.close(); delete process.env.FOUNDKEEP_ADMIN_EMAILS; });
function device(email: string, enabled = 1) {
  const id = crypto.randomUUID(), token = `ExpoPushToken[${id}]`;
  db.query("INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,'Test','','',0)").run(id,email);
  db.query("INSERT INTO customer_connections(id,account_id,name,token_hash,created_at,expires_at) VALUES(?,?,'Test',?,0,?)").run(id,id,id,Date.now()+86_400_000);
  db.query('INSERT INTO customer_push_devices(connection_id,account_id,expo_push_token,enabled,created_at,updated_at) VALUES(?,?,?,?,0,0)').run(id,id,token,enabled);
  return { id, token };
}
test('operator alerts reach only opted-in admin devices and prune rejected tokens', async () => {
  const admin = device('admin@example.test');
  const other = device('other@example.test');
  const bodies: any[] = [];
  const delivered = await deliverOperatorAlert(db,alert,async (_url, init) => {
    bodies.push(JSON.parse(String(init!.body)));
    return Response.json({data:[{status:'error',details:{error:'DeviceNotRegistered'}}]});
  });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toHaveLength(1);
  expect(bodies[0][0]).toMatchObject({to:admin.token,...alert});
  expect(delivered).toBe(0);
  expect(db.query('SELECT connection_id FROM customer_push_devices WHERE connection_id=?').get(admin.id)).toBeNull();
  expect(db.query('SELECT connection_id FROM customer_push_devices WHERE connection_id=?').get(other.id)).not.toBeNull();
});
test('disabled operator devices are skipped without contacting Expo', async () => {
  device('admin@example.test',0);
  let calls=0;
  expect(await deliverOperatorAlert(db,alert,async()=>{ calls++; return Response.json({}); })).toBe(0);
  expect(calls).toBe(0);
});
test('only accepted receipts count as delivered; transport failure remains retryable', async () => {
  device('admin@example.test');
  expect(await deliverOperatorAlert(db,alert,async()=>Response.json({data:[{status:'ok',id:'receipt'}]}))).toBe(1);
  expect(await deliverOperatorAlert(db,alert,async()=>Response.json({data:[{status:'error',details:{error:'MessageRateExceeded'}}]}))).toBe(0);
  expect(await deliverOperatorAlert(db,alert,async()=>{throw Error('offline');})).toBe(0);
});

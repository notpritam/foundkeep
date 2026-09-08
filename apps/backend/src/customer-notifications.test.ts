import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { deliverCaptureNotification, isExpoPushToken } from './customer-notifications.ts';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE customer_push_devices (
    connection_id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
    expo_push_token TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`);
  return db;
}

describe('customer push notifications', () => {
  test('accepts only bounded Expo device tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abcdefghijklmnopqrstuv]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc_DEF-0123456789]')).toBe(true);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
    expect(isExpoPushToken('token')).toBe(false);
    expect(isExpoPushToken(`ExpoPushToken[${'a'.repeat(250)}]`)).toBe(false);
  });

  test('sends generic private copy with a capture deep link', async () => {
    const db = fixture();
    db.query('INSERT INTO customer_push_devices VALUES(?,?,?,?,?,?)')
      .run('connection-a', 'owner-a', 'ExpoPushToken[abc_DEF-0123456789]', 1, 1, 1);
    let request: { url: string; init?: RequestInit } | undefined;
    const sent = await deliverCaptureNotification(db, {
      accountId: 'owner-a', captureId: '7496c7eb-26ef-4f35-8255-d2d00d8e7a39', status: 'done',
    }, async (input, init) => {
      request = { url: String(input), init };
      return Response.json({ data: [{ status: 'ok', id: 'receipt' }] });
    });
    expect(sent).toBe(1);
    expect(request?.url).toBe('https://exp.host/--/api/v2/push/send');
    const body = JSON.parse(String(request?.init?.body));
    expect(body).toEqual([{
      to: 'ExpoPushToken[abc_DEF-0123456789]',
      title: 'Foundkeep',
      body: 'Your saved item is ready.',
      sound: 'default',
      data: { url: 'foundkeep://capture/7496c7eb-26ef-4f35-8255-d2d00d8e7a39' },
    }]);
    expect(JSON.stringify(body)).not.toContain('Private');
    db.close();
  });

  test('removes tokens Expo reports as unregistered and ignores disabled devices', async () => {
    const db = fixture();
    db.query('INSERT INTO customer_push_devices VALUES(?,?,?,?,?,?)')
      .run('connection-a', 'owner-a', 'ExpoPushToken[registered-device]', 1, 1, 1);
    db.query('INSERT INTO customer_push_devices VALUES(?,?,?,?,?,?)')
      .run('connection-b', 'owner-a', 'ExpoPushToken[disabled-device]', 0, 1, 1);
    await deliverCaptureNotification(db, { accountId: 'owner-a', captureId: '7496c7eb-26ef-4f35-8255-d2d00d8e7a39', status: 'done' },
      async () => Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }));
    expect(db.query('SELECT COUNT(*) n FROM customer_push_devices').get()).toEqual({ n: 1 });
    expect(db.query('SELECT enabled FROM customer_push_devices').get()).toEqual({ enabled: 0 });
    db.close();
  });
});

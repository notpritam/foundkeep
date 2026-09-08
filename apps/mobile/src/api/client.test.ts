import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoundkeepClient, FoundkeepApiError } from './client.ts';

test('authenticated requests stay on the Foundkeep origin and encode collection filters', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ captures: [], total: 0, nextCursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createFoundkeepClient({ getToken: async () => 'test-token', fetcher });
  await client.listCaptures({ q: 'small details', type: 'document', cursor: 'next_page' });
  assert.equal(calls[0]?.url, 'https://foundkeep.app/api/mobile/captures?q=small+details&type=document&cursor=next_page');
  assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer test-token');
});

test('public registration omits authorization and returns the native device session', async () => {
  let headers = new Headers();
  let requestBody: any;
  const client = createFoundkeepClient({
    getToken: async () => 'must-not-leak',
    fetcher: async (_input, init) => {
      headers = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ account: { id: 'a', email: 'a@example.com', name: 'A', createdAt: 1 }, token: 't', recoveryCode: 'r', connection: { id: 'c', name: 'Foundkeep for iPhone', createdAt: 1, lastSeenAt: null } }), { status: 201, headers: { 'content-type': 'application/json' } });
    },
  });
  const result = await client.register({ email: 'a@example.com', name: 'A', password: 'long password', deviceName: "Pritam's iPhone" });
  assert.equal(headers.get('authorization'), null);
  assert.equal(requestBody.deviceName, "Pritam's iPhone");
  assert.equal(result.token, 't');
});

test('API errors expose bounded customer copy without retaining response bodies', async () => {
  const client = createFoundkeepClient({
    getToken: async () => 'token',
    fetcher: async () => new Response(JSON.stringify({ error: 'quota_exceeded', message: 'x'.repeat(1000) }), { status: 409, headers: { 'content-type': 'application/json' } }),
  });
  await assert.rejects(client.listCaptures({}), (error: unknown) => {
    assert.ok(error instanceof FoundkeepApiError);
    const apiError = error as FoundkeepApiError;
    assert.equal(apiError.status, 409);
    assert.equal(apiError.code, 'quota_exceeded');
    assert.equal(apiError.message.length, 300);
    return true;
  });
});

test('account deletion uses the authenticated mobile endpoint', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createFoundkeepClient({
    getToken: async () => 'delete-token',
    fetcher: async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ ok: true }); },
  });
  await client.deleteAccount('correct password');
  assert.equal(calls[0]?.url, 'https://foundkeep.app/api/mobile/account');
  assert.equal(calls[0]?.init?.method, 'DELETE');
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { password: 'correct password' });
  assert.equal(new Headers(calls[0]?.init?.headers).get('authorization'), 'Bearer delete-token');
});

test('notification registration and removal use the current mobile connection', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createFoundkeepClient({
    getToken: async () => 'device-token',
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json(String(url).endsWith('/notifications') && init?.method === 'GET' ? { enabled: false } : { ok: true });
    },
  });
  assert.deepEqual(await client.notificationStatus(), { enabled: false });
  await client.registerNotifications('ExpoPushToken[abc_DEF-0123456789]');
  await client.unregisterNotifications();
  assert.deepEqual(calls.map(call => [call.url, call.init?.method]), [
    ['https://foundkeep.app/api/mobile/notifications', 'GET'],
    ['https://foundkeep.app/api/mobile/notifications', 'POST'],
    ['https://foundkeep.app/api/mobile/notifications', 'DELETE'],
  ]);
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { expoPushToken: 'ExpoPushToken[abc_DEF-0123456789]' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirstRun, firstRunKey } from './firstRun.ts';

const memory = () => { const values = new Map<string, string>(); return { values, get: async (key: string) => values.get(key) ?? null, set: async (key: string, value: string) => { values.set(key, value); } }; };

test('first run is due once on a device, then not again', async () => {
  const store = memory();
  const firstRun = createFirstRun(store, 'production');
  assert.equal(await firstRun.due(), true);
  await firstRun.seen();
  assert.equal(await firstRun.due(), false);
  assert.equal(store.values.get(firstRunKey('production')), 'seen');
});

test('each environment keeps its own record', async () => {
  const store = memory();
  await createFirstRun(store, 'development').seen();
  assert.equal(await createFirstRun(store, 'production').due(), true);
});

test('storage that fails never blocks signing in', async () => {
  const broken = { get: async () => { throw new Error('locked'); }, set: async () => { throw new Error('locked'); } };
  const firstRun = createFirstRun(broken, 'production');
  assert.equal(await firstRun.due(), false);
  await firstRun.seen();
});

test('first run follows a sign-in, once — not every time the app opens', async () => {
  const firstRun = createFirstRun(memory(), 'production');
  assert.equal(await firstRun.takeAfterSignIn(), false);
  firstRun.signedIn();
  assert.equal(await firstRun.takeAfterSignIn(), true);
  assert.equal(await firstRun.takeAfterSignIn(), false);
});

test('a sign-in on a device that has seen it shows nothing', async () => {
  const firstRun = createFirstRun(memory(), 'production');
  await firstRun.seen();
  firstRun.signedIn();
  assert.equal(await firstRun.takeAfterSignIn(), false);
});

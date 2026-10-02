import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSignInProviders } from './providers.ts';

const client = (answer: () => Promise<{ providers: unknown }>) => ({ oauthProviders: answer });

test('Google comes first and Apple second; anything else follows, and unknown names are dropped', async () => {
  const result = await loadSignInProviders(client(async () => ({ providers: ['apple', 'mystery', 'github', 'google'] })));
  assert.deepEqual(result, { providers: ['google', 'apple', 'github'], failed: false });
});

test('when the providers cannot be loaded, the screen is told so instead of showing nothing', async () => {
  assert.deepEqual(await loadSignInProviders(client(async () => { throw new Error('offline'); })), { providers: [], failed: true });
});

test('an answer with no usable provider counts as unavailable too', async () => {
  assert.deepEqual(await loadSignInProviders(client(async () => ({ providers: [] }))), { providers: [], failed: true });
  assert.deepEqual(await loadSignInProviders(client(async () => ({ providers: 'nope' }))), { providers: [], failed: true });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffWords } from './handoffWords.ts';

test('each state names the provider, in a few words (more crowd the ring)', () => {
  for (const phase of ['opening', 'browser', 'finishing', 'failed'] as const) {
    const { title, body } = handoffWords(phase, 'google');
    assert.ok(title.split(' ').length <= 4 && (!body || body.split(' ').length <= 4), `${phase}: ${title} / ${body}`);
  }
  assert.deepEqual(handoffWords('opening', 'apple'), { title: 'Opening Apple…', body: '' });
  assert.deepEqual(handoffWords('browser', 'google'), { title: 'Waiting for Google', body: 'You’ll come right back.' });
  assert.equal(handoffWords('finishing', 'google').title, 'Signing you in…');
  assert.match(handoffWords('link', 'apple').body, /connect Apple/);
});

test('a failure says why when the app knows, and otherwise the likely reason', () => {
  assert.deepEqual(handoffWords('failed', 'google'), { title: 'Sign-in didn’t finish', body: 'Nothing has changed.' });
  assert.equal(handoffWords('failed', 'google', 'This sign-in expired. Start again.').body, 'This sign-in expired. Start again.');
});

test('without a known provider the words still read', () => {
  assert.equal(handoffWords('opening', null).title, 'Opening sign-in…');
  assert.equal(handoffWords('link', null).title, 'Connect your collection');
});

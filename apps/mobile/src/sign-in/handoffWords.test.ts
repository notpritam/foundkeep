import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffWords } from './handoffWords.ts';

test('each state names the provider the person chose', () => {
  assert.deepEqual(handoffWords('opening', 'apple'), { title: 'Opening Apple…', body: '' });
  assert.deepEqual(handoffWords('browser', 'google'), { title: 'Waiting for Google', body: 'Finish signing in there and you’ll come straight back.' });
  assert.equal(handoffWords('finishing', 'google').title, 'Signing you in…');
  assert.match(handoffWords('link', 'apple').body, /connect Apple to it/);
});

test('a failure says why when the app knows, and otherwise the likely reason', () => {
  assert.deepEqual(handoffWords('failed', 'google'), { title: 'Sign-in didn’t finish', body: 'It was canceled, or Google couldn’t confirm it was you. Nothing has changed.' });
  assert.equal(handoffWords('failed', 'google', 'This sign-in expired. Start again.').body, 'This sign-in expired. Start again.');
});

test('without a known provider the words still read', () => {
  assert.equal(handoffWords('opening', null).title, 'Opening sign-in…');
  assert.match(handoffWords('failed', null).body, /Apple or Google couldn’t confirm/);
});

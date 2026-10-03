import test from 'node:test';
import assert from 'node:assert/strict';
import { screenReaderOn } from './screenReader.ts';

test('a phone’s answer is trusted', async () => {
  assert.equal(await screenReaderOn('ios', async () => true), true);
  assert.equal(await screenReaderOn('android', async () => false), false);
});

test('the web can’t tell — react-native-web always answers yes — so it counts as off', async () => {
  assert.equal(await screenReaderOn('web', async () => true), false);
});

test('a check that fails counts as off', async () => {
  assert.equal(await screenReaderOn('ios', async () => { throw new Error('unavailable'); }), false);
});

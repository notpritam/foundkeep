import test from 'node:test';
import assert from 'node:assert/strict';
import type { Capture } from '../api/types.ts';
import { origin } from './origin.ts';

const save = (fields: Partial<Capture>) => ({ type: 'bookmark', status: 'done', provenance: null, sourceUrl: null, savedVia: null, fileMime: null, ...fields }) as Capture;

test('a platform shows its own mark; a post shows who wrote it', () => {
  assert.deepEqual(origin(save({ type: 'video', sourceUrl: 'https://www.instagram.com/reel/abc/' })), { name: 'Instagram', icon: 'logo-instagram', color: '#E1306C' });
  assert.deepEqual(origin(save({ type: 'tweet', sourceUrl: 'https://x.com/adak/status/1', provenance: { authors: ['Ada Kowalski'] } as Capture['provenance'] })), { name: 'Ada Kowalski', icon: 'logo-x', color: null });
  assert.equal(origin(save({ type: 'video', sourceUrl: 'https://youtu.be/abc' })).icon, 'logo-youtube');
});

test('a website shows a globe and the site’s name', () => {
  assert.deepEqual(origin(save({ sourceUrl: 'https://smallkitchen.example/rigatoni', provenance: { siteName: 'Small Kitchen' } as Capture['provenance'] })), { name: 'Small Kitchen', icon: 'globe-outline', color: 'muted' });
  assert.equal(origin(save({ sourceUrl: 'https://www.fieldnotes.example/a' })).name, 'fieldnotes.example');
});

test('things that came from no website say what they are', () => {
  assert.equal(origin(save({ type: 'note' })).icon, 'create-outline');
  assert.equal(origin(save({ type: 'audio' })).name, 'Voice memo');
  assert.equal(origin(save({ type: 'document', fileMime: 'application/pdf' })).name, 'PDF');
  assert.deepEqual(origin(save({ type: 'image', savedVia: 'iphone' })), { name: 'From your iPhone', icon: 'phone-portrait-outline' });
});

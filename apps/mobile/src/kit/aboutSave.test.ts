import test from 'node:test';
import assert from 'node:assert/strict';
import type { Capture, RelatedSave } from '../api/types.ts';
import { aboutSave, SAVE_PROMPTS } from './aboutSave.ts';

const NOW = Date.parse('2026-10-03T09:00:00Z');
const save = (fields: Partial<Capture>) => ({ id: 'a', type: 'bookmark', status: 'done', capturedAt: NOW - 3 * 86_400_000, userTags: [], folder: null, provenance: null, sourceUrl: null, sourceTitle: null, summary: null, noteText: null, selectionText: null, articleText: null, ...fields }) as Capture;
const article = save({ sourceTitle: 'The half-life of a good idea', sourceUrl: 'https://themargin.example/half-life', summary: 'Most of what we read is gone within a week. A small practice of keeping changes what stays.', savedVia: 'browser', provenance: { siteName: 'The Margin', captureMethod: 'extension' } });
const related = (labels: string[]): RelatedSave[] => labels.map((label, index) => ({ capture: save({ id: `r${index}` }), reasons: [{ kind: 'tag', label }] }));

test('three ready prompts: sum it up, more like it, where it came from', () => {
  assert.deepEqual(SAVE_PROMPTS, ['Sum it up', 'More like it', 'Where is it from?']);
});

test('summing up gives the first sentence of the summary', () => {
  assert.deepEqual(aboutSave('Sum it up', article, [], NOW), { reply: 'Most of what we read is gone within a week.', items: [] });
});

test('summing up a note or a post quotes its start, cut short', () => {
  const note = save({ type: 'note', noteText: 'Ask Lena about the follow-up piece on forgetting curves. She mentioned a study on spaced review.' });
  assert.equal(aboutSave('Sum it up', note, [], NOW).reply, 'Your note: “Ask Lena about the follow-up piece on forgetting curves.”');
  const post = save({ type: 'tweet', selectionText: 'My cat has learned to open the fridge. Send help.', sourceUrl: 'https://x.com/m/status/1' });
  assert.equal(aboutSave('Sum it up', post, [], NOW).reply, 'A post: “My cat has learned to open the fridge.”');
});

test('summing up something not yet read says so', () => {
  assert.equal(aboutSave('Sum it up', save({ status: 'processing', sourceTitle: 'A field guide' }), [], NOW).reply, 'It’s still being read — ask again in a minute.');
  assert.equal(aboutSave('Sum it up', save({ type: 'image', sourceTitle: 'Desk' }), [], NOW).reply, 'A photo — there are no words in it to sum up.');
});

test('more like it lists the related saves and why, in one line', () => {
  const turn = aboutSave('More like it', article, related(['#Memory', '#Memory', 'Same site']), NOW);
  assert.equal(turn.reply, '3 saves like it — most share #Memory.');
  assert.equal(turn.items.length, 3);
  assert.equal(aboutSave('More like it', article, related(['#Memory']), NOW).reply, '1 save like it — it shares #Memory.');
  assert.deepEqual(aboutSave('More like it', article, [], NOW), { reply: 'Nothing like it yet.', items: [] });
});

test('where it came from: the source, how it was saved, and when', () => {
  assert.equal(aboutSave('Where is it from?', article, [], NOW).reply, 'From The Margin, saved in your browser 3 days ago.');
  const post = save({ type: 'tweet', sourceUrl: 'https://x.com/adak/status/1', savedVia: 'iphone', provenance: { siteName: 'X', authors: ['Ada Kowalski'], captureMethod: 'ios-share-url' } });
  assert.equal(aboutSave('Where is it from?', post, [], NOW).reply, 'From Ada Kowalski on X, saved on your iPhone 3 days ago.');
  assert.equal(aboutSave('where', save({ type: 'note', savedVia: 'iphone' }), [], NOW).reply, 'Your own note, written on your iPhone 3 days ago.');
});

test('a typed question goes to the closest of the three', () => {
  assert.equal(aboutSave('anything similar?', article, related(['#Memory']), NOW).items.length, 1);
  assert.match(aboutSave('when did I save this', article, [], NOW).reply, /^From The Margin/);
  assert.equal(aboutSave('what is it about', article, [], NOW).reply, 'Most of what we read is gone within a week.');
});

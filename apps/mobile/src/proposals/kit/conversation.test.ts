import test from 'node:test';
import assert from 'node:assert/strict';
import type { Capture } from '../../api/types.ts';
import { converse, readAsk, short } from './conversation.ts';

const NOW = Date.parse('2026-10-03T09:00:00Z');
const at = (hours: number) => NOW - hours * 3_600_000;
const save = (id: string, hours: number, fields: Partial<Capture>) => ({ id, type: 'bookmark', status: 'done', capturedAt: at(hours), userTags: [], folder: null, provenance: null, sourceUrl: null, sourceTitle: null, summary: null, noteText: null, selectionText: null, ...fields }) as Capture;
const library = [
  save('reel', 1, { type: 'video', sourceTitle: 'Ten-minute ramen, one pot', sourceUrl: 'https://www.instagram.com/reel/r/', userTags: ['Cooking'] }),
  save('ada', 3, { type: 'tweet', sourceTitle: 'Ada on X', selectionText: 'Spaced repetition is not a study hack.', sourceUrl: 'https://x.com/adak/status/1' }),
  save('kyoto', 4, { type: 'tweet', sourceTitle: 'Slow Travels on X', selectionText: 'Two days in Kyoto, lost in Gion after dark.', sourceUrl: 'https://x.com/slowtravels/status/2' }),
  save('cat', 30, { type: 'tweet', sourceTitle: 'Mochi on X', selectionText: 'My cat has learned to open the fridge. Send help.', sourceUrl: 'https://x.com/mochi/status/3' }),
  save('pasta', 6, { sourceTitle: 'Weeknight tomato rigatoni', sourceUrl: 'https://smallkitchen.example/r', userTags: ['Cooking'] }),
];

test('a question is read for what kind of thing, from where, about what, and how recent', () => {
  assert.deepEqual(readAsk('recent post I saved from twitter'), { kinds: ['tweet', 'image', 'video'], platforms: ['X'], topic: [], recent: true });
  assert.deepEqual(readAsk('about cats'), { kinds: [], platforms: [], topic: ['cats'], recent: false });
});

test('the first question finds the newest posts from X', () => {
  const [turn] = converse(['recent post I saved from twitter'], library, NOW);
  assert.deepEqual(turn.items.map(c => c.id), ['ada', 'kyoto', 'cat']);
  assert.equal(turn.followUp, false);
  assert.match(turn.reply, /posts from X/);
});

test('a follow-up narrows what was asked before, instead of starting over', () => {
  const turns = converse(['recent post I saved from twitter', 'about cats'], library, NOW);
  assert.equal(turns[1].followUp, true);
  assert.deepEqual(turns[1].items.map(c => c.id), ['cat']);
  assert.deepEqual(turns[1].context, { kinds: ['tweet', 'image', 'video'], platforms: ['X'], topic: ['cats'], recent: true });
  assert.match(turns[1].reply, /Of your posts from X, 1 is about cats/);
});

test('a follow-up can change where from, keeping the rest', () => {
  const turns = converse(['videos about cooking', 'from instagram'], library, NOW);
  assert.deepEqual(turns[1].context.platforms, ['Instagram']);
  assert.deepEqual(turns[1].items.map(c => c.id), ['reel']);
});

test('when nothing fits the narrowed question, Kit says so and offers what it found elsewhere', () => {
  const turns = converse(['videos from instagram', 'about kyoto'], library, NOW);
  assert.deepEqual(turns[1].items.map(c => c.id), ['kyoto']);
  assert.equal(turns[1].elsewhere, true);
  assert.match(turns[1].reply, /None of your videos from Instagram are about kyoto/);
});

test('a new question with a kind of its own starts over', () => {
  const turns = converse(['recent post from twitter', 'videos about ramen'], library, NOW);
  assert.equal(turns[1].followUp, false);
  assert.deepEqual(turns[1].context.platforms, []);
  assert.deepEqual(turns[1].items.map(c => c.id), ['reel']);
});

test('Kit quotes a few words of a long post, cut at a word', () => {
  assert.equal(short('Spaced repetition is not a study hack. It is what remembering looks like when you stop pretending.'), 'Spaced repetition is not a study hack. It is what…');
  assert.equal(short('My cat has learned to open the fridge.'), 'My cat has learned to open the fridge');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Capture } from '../../api/types.ts';
import { askKit, findSaves } from './data.ts';

const at = (hours: number) => Date.parse('2026-10-03T09:00:00Z') - hours * 3_600_000;
const save = (id: string, hours: number, fields: Partial<Capture>) => ({ id, type: 'bookmark', status: 'done', capturedAt: at(hours), userTags: [], folder: null, provenance: null, sourceUrl: null, sourceTitle: null, summary: null, noteText: null, selectionText: null, ...fields }) as Capture;
const kitchen = { id: 'f-kitchen', name: 'Kitchen', count: 9 }, reading = { id: 'f-reading', name: 'Reading list', count: 42 };
const library = [
  save('reel', 1, { type: 'video', sourceTitle: 'Ten-minute ramen, one pot', userTags: ['Cooking'], folder: kitchen, folderId: 'f-kitchen' }),
  save('kyoto', 4, { type: 'tweet', sourceTitle: 'Slow Travels on X', selectionText: 'Two days in Kyoto, lost in Gion after dark.', userTags: ['Travel'] }),
  save('pasta', 6, { sourceTitle: 'Weeknight tomato rigatoni', userTags: ['Cooking', 'Quick'], folder: kitchen, folderId: 'f-kitchen' }),
  save('margin', 50, { sourceTitle: 'The half-life of a good idea', userTags: ['Memory', 'Reading'], folder: reading, folderId: 'f-reading' }),
];

test('Kit finds a save by what it was about and what kind it was', () => {
  const answer = askKit('that ramen video I saved', library);
  assert.deepEqual(answer.items.map(c => c.id), ['reel']);
  assert.match(answer.reply, /Ten-minute ramen, one pot/);
});

test('Kit searches tags and folders too, and says when nothing matches', () => {
  assert.deepEqual(askKit('cooking', library).items.map(c => c.id), ['reel', 'pasta']);
  assert.deepEqual(askKit('things in my kitchen folder', library).items.map(c => c.id), ['reel', 'pasta']);
  const none = askKit('sailing', library);
  assert.equal(none.items.length, 0);
  assert.match(none.reply, /couldn’t find/);
});

test('one field: a word finds matches; a sentence or a question gets Kit’s note too', () => {
  const matches = [library[0]];
  assert.deepEqual(findSaves('ramen', library, matches), { note: null, items: matches });
  const asked = findSaves('that ramen video I saved', library, []);
  assert.deepEqual(asked.items.map(c => c.id), ['reel']);
  assert.match(asked.note ?? '', /Found it/);
  assert.ok(findSaves('kyoto?', library, []).note);
  assert.deepEqual(findSaves('  ', library, matches), { note: null, items: [] });
});

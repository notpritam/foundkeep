import test from 'node:test';
import assert from 'node:assert/strict';
import type { Capture } from '../api/types.ts';
import { recentPlaces } from './places.ts';

const at = (hours: number) => Date.parse('2026-10-03T09:00:00Z') - hours * 3_600_000;
const save = (id: string, hours: number, fields: Partial<Capture>) => ({ id, type: 'bookmark', status: 'done', capturedAt: at(hours), userTags: [], folder: null, provenance: null, sourceUrl: null, sourceTitle: null, summary: null, noteText: null, selectionText: null, ...fields }) as Capture;
const kitchen = { id: 'f-kitchen', name: 'Kitchen', count: 9 }, reading = { id: 'f-reading', name: 'Reading list', count: 42 };
const library = [
  save('reel', 1, { type: 'video', sourceTitle: 'Ten-minute ramen, one pot', userTags: ['Cooking'], folder: kitchen, folderId: 'f-kitchen' }),
  save('kyoto', 4, { type: 'tweet', sourceTitle: 'Slow Travels on X', selectionText: 'Two days in Kyoto, lost in Gion after dark.', userTags: ['Travel'] }),
  save('pasta', 6, { sourceTitle: 'Weeknight tomato rigatoni', userTags: ['Cooking', 'Quick'], folder: kitchen, folderId: 'f-kitchen' }),
  save('margin', 50, { sourceTitle: 'The half-life of a good idea', userTags: ['Memory', 'Reading'], folder: reading, folderId: 'f-reading' }),
];

test('recent folders and tags come from the saves, most recently used first, with how many', () => {
  const places = recentPlaces(library);
  assert.deepEqual(places.folders.map(f => [f.name, f.count]), [['Kitchen', 2], ['Reading list', 1]]);
  assert.deepEqual(places.tags.map(t => [t.name, t.count]), [['Cooking', 2], ['Travel', 1], ['Quick', 1], ['Memory', 1], ['Reading', 1]]);
});


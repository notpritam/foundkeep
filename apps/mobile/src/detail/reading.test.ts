import test from 'node:test';
import assert from 'node:assert/strict';
import type { Capture, Preservation } from '../api/types.ts';
import { readSave } from './reading.ts';

// Shapes taken from the audit of real saves (2026-10-03); the words are made up.
const save = (fields: Partial<Capture>) => ({ id: 'a', type: 'bookmark', status: 'done', capturedAt: 0, userTags: [], folder: null, provenance: null, sourceUrl: null, sourceTitle: null, summary: null, noteText: null, selectionText: null, articleText: null, fileName: null, ...fields }) as Capture;
const archived = (text: string): Preservation => ({ status: 'ready', error: null, updatedAt: 0, assets: [{ id: 'p', kind: 'post', title: 'Saved post', mime: 'text/plain', bytes: text.length, text }] });

test('a post shared from the iPhone shows the post kept on the server, and the note as the person’s own', () => {
  const capture = save({ sourceUrl: 'https://x.com/adak/status/1?s=12', noteText: 'Make a video on this', summary: 'Make a video on this' });
  const reading = readSave(capture, archived('Ada Kowalski (@adak)\n2026-09-16T02:42:31.000Z\nhttps://x.com/adak/status/1\n\nSpaced repetition is not a study hack.\n\nIt is what remembering looks like.'));
  assert.deepEqual(reading.post, { author: 'Ada Kowalski (@adak)', text: 'Spaced repetition is not a study hack.\n\nIt is what remembering looks like.' });
  assert.equal(reading.title, null, 'the post’s words lead, not a title');
  assert.equal(reading.note, 'Make a video on this');
  assert.equal(reading.lead, null, 'a summary that only copies the note is left out');
  assert.equal(reading.link, 'https://x.com/adak/status/1');
  assert.equal(reading.missingPost, false);
});

test('a post whose words were never kept says whose post it is, never the note as its title', () => {
  const reading = readSave(save({ sourceUrl: 'https://x.com/kedytcom/status/2?s=12', noteText: 'Seo of app', summary: 'Seo of app' }), null);
  assert.equal(reading.title, 'A post by @kedytcom on X');
  assert.equal(reading.note, 'Seo of app');
  assert.equal(reading.post, null);
  assert.equal(reading.missingPost, true);
});

test('a post saved with the extension whose title holds the person’s words keeps them as a note', () => {
  const capture = save({ type: 'tweet', sourceUrl: 'https://x.com/charliejhills/status/3', sourceTitle: 'Write blog on this', selectionText: 'Your install is missing a few things.', noteText: 'Good list' });
  const reading = readSave(capture, null);
  assert.deepEqual(reading.post, { author: '@charliejhills', text: 'Your install is missing a few things.' });
  assert.equal(reading.note, 'Write blog on this\nGood list');
  const named = readSave(save({ type: 'tweet', sourceUrl: 'https://x.com/fin465/status/4', sourceTitle: 'Finn Mallery (@fin465) on X', selectionText: 'Launch every month.' }), null);
  assert.equal(named.post?.author, 'Finn Mallery (@fin465)');
  assert.equal(named.note, null);
});

test('a link shared from another app as text is shown as the link it is', () => {
  const capture = save({ type: 'selection', selectionText: 'https://youtube.com/shorts/koXYi49pXs8?si=Euz5', noteText: 'Protein source', summary: 'https://youtube.com/shorts/koXYi49pXs8?si=Euz5' });
  const reading = readSave(capture, null);
  assert.equal(reading.sharedAsText, true);
  assert.equal(reading.link, 'https://youtube.com/shorts/koXYi49pXs8');
  assert.equal(reading.title, 'A YouTube Short');
  assert.equal(reading.note, 'Protein source');
  assert.equal(reading.lead, null);
  assert.equal(readSave(save({ type: 'selection', selectionText: 'https://www.linkedin.com/posts/someone_activity-1' }), null).title, 'A LinkedIn post');
  assert.equal(readSave(save({ type: 'selection', selectionText: 'https://example.com/a/page' }), null).title, 'example.com/a/page');
});

test('a summary leads a page only when it says something the page doesn’t already', () => {
  const text = 'Most of what we read is gone within a week. A small practice of keeping changes what stays.';
  const copied = readSave(save({ sourceUrl: 'https://themargin.example/a', sourceTitle: 'The half-life of a good idea', articleText: text, summary: 'Most of what we read is gone within a week. A small…' }), null);
  assert.equal(copied.lead, null, 'the first lines of the page, copied, are not a summary');
  assert.equal(copied.title, 'The half-life of a good idea');
  const written = readSave(save({ sourceUrl: 'https://themargin.example/a', sourceTitle: 'The half-life of a good idea', articleText: text, summary: 'Why keeping a little beats keeping everything.' }), null);
  assert.equal(written.lead, 'Why keeping a little beats keeping everything.');
});

test('a note’s words are its body, not a note about it', () => {
  const reading = readSave(save({ type: 'note', noteText: 'Ask Lena about the follow-up piece.', sourceTitle: 'Call notes' }), null);
  assert.equal(reading.title, 'Call notes');
  assert.equal(reading.note, null);
  assert.equal(readSave(save({ type: 'note', noteText: 'Ask Lena.' }), null).title, null);
});

test('a file or a photo without a title is named for what it is, never by the note', () => {
  assert.equal(readSave(save({ type: 'document', fileName: 'Brief.pdf', noteText: 'read later' }), null).title, 'Brief.pdf');
  assert.equal(readSave(save({ type: 'image', noteText: 'Checking screenshot' }), null).title, 'A photo');
});

test('an Instagram post keeps its own title; only an X post’s title can hold the person’s words', () => {
  const reading = readSave(save({ type: 'video', sourceUrl: 'https://www.instagram.com/reel/abc123/', sourceTitle: 'Ten-minute ramen, one pot', noteText: 'Make this Sunday' }), null);
  assert.equal(reading.title, 'Ten-minute ramen, one pot');
  assert.equal(reading.note, 'Make this Sunday');
  assert.equal(reading.missingPost, false);
  const bare = readSave(save({ sourceUrl: 'https://www.instagram.com/reel/abc123/?igsh=x', noteText: 'Buy lands please' }), null);
  assert.equal(bare.title, 'A post on Instagram');
  assert.equal(bare.missingPost, true);
  assert.equal(bare.link, 'https://www.instagram.com/reel/abc123/');
});

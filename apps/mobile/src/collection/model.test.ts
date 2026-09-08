import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTitle, filterCaptures, groupCaptures } from './model.ts';

const captures = [
  { id: '1', type: 'document', batchId: 'batch-a', sourceTitle: 'Field report', fileName: 'report.pdf', noteText: null, selectionText: null, capturedAt: 3 },
  { id: '2', type: 'audio', batchId: 'batch-a', sourceTitle: null, fileName: 'voice memo.m4a', noteText: null, selectionText: null, capturedAt: 2 },
  { id: '3', type: 'note', batchId: null, sourceTitle: null, fileName: null, noteText: 'Remember the red door', selectionText: null, capturedAt: 1 },
] as any[];

test('search covers titles, filenames and saved text while type filters remain exact', () => {
  assert.deepEqual(filterCaptures(captures, 'report', null).map(item => item.id), ['1']);
  assert.deepEqual(filterCaptures(captures, 'voice', 'audio').map(item => item.id), ['2']);
  assert.deepEqual(filterCaptures(captures, 'door', 'document'), []);
});

test('multi-item shares stay adjacent as a collection group', () => {
  const groups = groupCaptures(captures);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0]?.items.map(item => item.id), ['1', '2']);
  assert.equal(groups[0]?.batchId, 'batch-a');
  assert.equal(groups[1]?.batchId, null);
});

test('capture titles prefer source title, filename, text and a readable fallback', () => {
  assert.equal(captureTitle(captures[0]), 'Field report');
  assert.equal(captureTitle(captures[1]), 'voice memo.m4a');
  assert.equal(captureTitle(captures[2]), 'Remember the red door');
  assert.equal(captureTitle({ type: 'video' } as any), 'Untitled video');
});

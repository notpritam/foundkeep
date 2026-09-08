import test from 'node:test';
import assert from 'node:assert/strict';
import { addUserTag, tagSuggestions } from './organization.ts';
test('personal tags are trimmed, deduplicated and bounded', () => {
  assert.deepEqual(addUserTag(['Work'], '  #Ideas  '), { tags: ['Work', 'Ideas'], error: null });
  assert.deepEqual(addUserTag(['Work'], 'work'), { tags: ['Work'], error: null });
  for (const tag of ['', 'x'.repeat(41), 'hello\nworld']) assert.ok(addUserTag([], tag).error);
  const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  assert.equal(addUserTag(tags, 'extra').tags, tags);
  assert.ok(addUserTag(tags, 'extra').error);
});


test('tag choices stay bounded and prioritize personal choices and starters', () => {
  const names = Array.from({ length: 2000 }, (_, i) => `topic-${i}`);
  const result = tagSuggestions(names, ['My project'], '');
  assert.equal(result.length, 12);
  assert.deepEqual(result.slice(0, 5), ['My project', 'Read later', 'Inspiration', 'Work', 'Personal']);
  const selected = names.slice(0, 20);
  assert.deepEqual(tagSuggestions(names, selected, ''), selected);
});

test('typing finds tags outside the initial suggestions and folds Unicode consistently', () => {
  const names = Array.from({ length: 2000 }, (_, i) => `topic-${i}`);
  assert.deepEqual(tagSuggestions(names, [], '#TOPIC-1999'), ['topic-1999']);
  assert.deepEqual(tagSuggestions(['École', 'éCOLE', 'E\u0301cole'], [], 'éco'), ['École']);
});

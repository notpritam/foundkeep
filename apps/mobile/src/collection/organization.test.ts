import test from 'node:test';
import assert from 'node:assert/strict';
import { addUserTag } from './organization.ts';
test('personal tags are trimmed, deduplicated and bounded', () => {
  assert.deepEqual(addUserTag(['Work'], '  #Ideas  '), { tags: ['Work', 'Ideas'], error: null });
  assert.deepEqual(addUserTag(['Work'], 'work'), { tags: ['Work'], error: null });
  for (const tag of ['', 'x'.repeat(41), 'hello\nworld']) assert.ok(addUserTag([], tag).error);
  const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  assert.equal(addUserTag(tags, 'extra').tags, tags);
  assert.ok(addUserTag(tags, 'extra').error);
});

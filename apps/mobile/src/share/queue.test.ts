import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAttemptAt, pendingReady, type PendingShare } from './queue.ts';

test('share retries use bounded exponential backoff without changing client identity', () => {
  const now = 1_000_000;
  assert.equal(nextAttemptAt(1, now), now + 5_000);
  assert.equal(nextAttemptAt(4, now), now + 40_000);
  assert.equal(nextAttemptAt(99, now), now + 15 * 60_000);
});

test('only due records are submitted and oldest shares remain first', () => {
  const records: PendingShare[] = [
    { id: 'new', clientId: 'client-new', batchId: null, metadata: {}, payloadPath: null, attempts: 0, nextAttemptAt: 0, createdAt: 20 },
    { id: 'future', clientId: 'client-future', batchId: null, metadata: {}, payloadPath: null, attempts: 2, nextAttemptAt: 500, createdAt: 5 },
    { id: 'old', clientId: 'client-old', batchId: null, metadata: {}, payloadPath: null, attempts: 1, nextAttemptAt: 10, createdAt: 1 },
  ];
  assert.deepEqual(pendingReady(records, 100).map(item => item.id), ['old', 'new']);
  assert.equal(records[0]?.clientId, 'client-new');
});

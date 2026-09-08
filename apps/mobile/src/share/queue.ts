export type PendingShare = {
  id: string;
  clientId: string;
  batchId: string | null;
  metadata: Record<string, unknown>;
  payloadPath: string | null;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
};

export function nextAttemptAt(attempts: number, now = Date.now()): number {
  const exponent = Math.max(0, Math.min(8, attempts - 1));
  return now + Math.min(15 * 60_000, 5_000 * (2 ** exponent));
}

export function pendingReady(records: PendingShare[], now = Date.now()): PendingShare[] {
  return records.filter(record => record.nextAttemptAt <= now).sort((a, b) => a.createdAt - b.createdAt);
}

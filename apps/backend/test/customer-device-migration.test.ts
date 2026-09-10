import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';

test('device migration preserves legacy credentials without guessing a client from its name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'foundkeep-device-migration-'));
  let db = openDb(join(dir, 'test.db'));
  try {
    db.exec('ALTER TABLE customer_connections DROP COLUMN client_kind; PRAGMA user_version=12');
    db.query('INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').run('owner','test@example.test','Test','password-hash','recovery-hash',1);
    db.query('INSERT INTO customer_connections(id,account_id,name,token_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').run('device','owner','Foundkeep for iPhone','secret-token-hash',2,3,4);
    const before = db.query('SELECT * FROM customer_connections').get();
    db.close(); db = openDb(join(dir, 'test.db'));
    expect(db.query('PRAGMA user_version').get()).toEqual({ user_version: 13 });
    expect(db.query('SELECT * FROM customer_connections').get()).toEqual({ ...before, client_kind: 'unknown' });
    expect(db.query('PRAGMA foreign_key_check').all()).toEqual([]);
    db.close(); db = openDb(join(dir, 'test.db'));
    expect(db.query('SELECT COUNT(*) n FROM customer_connections').get()).toEqual({ n: 1 });
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

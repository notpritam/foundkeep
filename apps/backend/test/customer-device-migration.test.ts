import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, DATABASE_SCHEMA_VERSION } from '../src/db.ts';

test('device migration preserves legacy credentials without guessing a client from its name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'foundkeep-device-migration-'));
  let db = openDb(join(dir, 'test.db'), 12);
  try {
    db.query('INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').run('owner','test@example.test','Test','password-hash','recovery-hash',1);
    db.query('INSERT INTO customer_connections(id,account_id,name,token_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').run('device','owner','Foundkeep for iPhone','secret-token-hash',2,3,4);
    const before = db.query('SELECT * FROM customer_connections').get() as Record<string, unknown>;
    db.close(); db = openDb(join(dir, 'test.db'));
    expect(db.query('PRAGMA user_version').get()).toEqual({ user_version: DATABASE_SCHEMA_VERSION });
    expect(db.query('SELECT * FROM customer_connections').get()).toEqual({ ...before, client_kind: 'unknown' });
    expect(db.query('PRAGMA foreign_key_check').all()).toEqual([]);
    db.close(); db = openDb(join(dir, 'test.db'));
    expect(db.query('SELECT COUNT(*) n FROM customer_connections').get()).toEqual({ n: 1 });
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('saving-platform migration retains existing content and original arrival dates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'foundkeep-saved-migration-'));
  let db = openDb(join(dir, 'test.db'), 13);
  try {
    db.query('INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').run('owner','saved@example.test','Test','hash','hash',1);
    db.query('INSERT INTO customer_captures(id,account_id,client_id,type,note_text,storage_bytes,captured_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('save','owner','old-save','note','Keep this',9,999,10,20);
    db.close(); db = openDb(join(dir, 'test.db'));
    expect(db.query('SELECT note_text,captured_at,created_at,updated_at,saved_via FROM customer_captures').get()).toEqual({ note_text: 'Keep this', captured_at: 999, created_at: 10, updated_at: 20, saved_via: null });
    expect(db.query('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

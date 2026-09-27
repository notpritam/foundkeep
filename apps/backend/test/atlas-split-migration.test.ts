import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, DATABASE_SCHEMA_VERSION } from '../src/db.ts';

test('the Atlas split drops personal Atlas tables and keeps customer data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'foundkeep-atlas-split-'));
  let db = openDb(join(dir, 'test.db'), DATABASE_SCHEMA_VERSION - 1);
  try {
    db.query('INSERT INTO captures(id,type,created_at,updated_at,note_text) VALUES(?,?,?,?,?)').run('cap','note',1,1,'personal note');
    db.query('INSERT INTO devices(id,name,kind,token_sha256,scopes,created_at) VALUES(?,?,?,?,?,?)').run('dev','bb worker','extension','hash','["read"]',1);
    db.query('INSERT INTO invite_codes(id,code_sha256,scopes,uses_left,created_at) VALUES(?,?,?,?,?)').run('inv','code','["relay"]',1,1);
    db.query('INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').run('owner','test@example.test','Test','password-hash','recovery-hash',1);
    db.close(); db = openDb(join(dir, 'test.db'));
    expect(db.query('PRAGMA user_version').get()).toEqual({ user_version: DATABASE_SCHEMA_VERSION });
    const left = db.query("SELECT name FROM sqlite_master WHERE name LIKE 'captures%' OR name IN ('devices','invite_codes')").all();
    expect(left).toEqual([]);
    expect(db.query('SELECT COUNT(*) n FROM customer_accounts').get()).toEqual({ n: 1 });
    expect(db.query('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

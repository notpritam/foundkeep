#!/usr/bin/env node
// Photographs every archived decision in design-system/log/entries.json that
// has no sheet yet (or all of them, with --force), one at a time, through
// design-log.mjs; then prints the git tags that pin each archive.
//   design-log-all.mjs [--force] [<entry-id> …]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2), force = args.includes('--force'), only = args.filter(a => !a.startsWith('--'));
const { entries } = JSON.parse(readFileSync(path.join(here, 'log/entries.json'), 'utf8'));
for (const entry of entries) {
  if (!entry.archive || (only.length && !only.includes(entry.id))) continue;
  const out = path.join(here, 'log', entry.id);
  if (!force && existsSync(path.join(out, 'sheet.jpg'))) { console.log(`= ${entry.id} (has a sheet)`); continue; }
  console.log(`→ ${entry.id} from ${entry.archive}`);
  const run = spawnSync('/usr/bin/node', [path.join(here, 'scripts/design-log.mjs'), entry.archive, out, ...entry.capture, '--title', `${entry.date} · ${entry.product} · ${entry.title}`], { stdio: 'inherit' });
  if (run.status !== 0) console.error(`✖ ${entry.id} failed`);
}

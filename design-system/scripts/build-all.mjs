#!/usr/bin/env node
// Build the whole design system into dist/: the hub (extension stories and
// the composed shell) first, because its build empties dist/, then the App
// and Dashboard Storybooks into dist/app and dist/dashboard.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const here = path.resolve(import.meta.dirname, '..');
const steps = [
  ['hub', here, ['build', '-o', 'dist', '--quiet']],
  ['app', path.join(here, 'app'), ['build', '-o', '../dist/app', '--quiet']],
  ['dashboard', path.join(here, 'dashboard'), ['build', '-o', '../dist/dashboard', '--quiet']],
];
const only = process.argv.slice(2);
for (const [name, cwd, args] of steps) {
  if (only.length && !only.includes(name)) continue;
  const started = Date.now();
  const run = spawnSync('/usr/bin/node', [path.join(cwd, 'node_modules/.bin/storybook'), ...args], { cwd, encoding: 'utf8', env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' } });
  if (run.status !== 0) { process.stderr.write(run.stdout + run.stderr); console.error(`✖ ${name} failed`); process.exit(1); }
  console.log(`✓ ${name} built in ${Math.round((Date.now() - started) / 1000)}s`);
}

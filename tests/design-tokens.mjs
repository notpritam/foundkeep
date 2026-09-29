// One token source: design-system/tokens.json generates the extension's
// theme.css token block, the app's ui/tokens.ts and the dashboard's
// tokens.css. These tests fail when a generated file drifts from the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const run = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const source = JSON.parse(await readFile(root + 'design-system/tokens.json', 'utf8'));

// Custom properties declared by the first rule matching `selector` in css.
function declared(css, selector) {
  const at = css.indexOf(selector + ' {');
  assert.ok(at >= 0, `no ${selector} rule`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

test('every generated file matches tokens.json', async () => {
  await run('/usr/bin/node', [root + 'design-system/scripts/tokens.mjs', '--check']);
});

test('the extension theme declares every colour, in both themes, from the source', async () => {
  const css = await readFile(root + 'apps/extension/src/theme.css', 'utf8');
  const light = declared(css, ':root'), dark = declared(css, ':root[data-theme="dark"]');
  for (const [name, value] of Object.entries(source.color.light)) assert.equal(light['--' + name], value, `light --${name}`);
  for (const [name, value] of Object.entries(source.color.dark)) assert.equal(dark['--' + name], value, `dark --${name}`);
});

test('the app gets numbers it can use in React Native styles', async () => {
  const { tokens } = await import(root + 'apps/mobile/src/ui/tokens.ts');
  assert.equal(tokens.color.light.accent, source.color.light.accent);
  assert.equal(tokens.color.dark.bg, source.color.dark.bg);
  assert.equal(tokens.space[4], 16);
  assert.equal(tokens.radius.xl, 16);
  assert.deepEqual(tokens.text.title, { fontWeight: '600', fontSize: 16, lineHeight: 21.6 });
});

test('the dashboard gets the same values under names that do not collide with its own', async () => {
  const css = await readFile(root + 'apps/site/app/tokens.css', 'utf8');
  assert.equal(declared(css, ':root')['--fk-color-accent'], source.color.light.accent);
  assert.equal(declared(css, ':root[data-theme="dark"]')['--fk-color-bg'], source.color.dark.bg);
  assert.equal(declared(css, ':root')['--fk-radius-xl'], '16px');
});

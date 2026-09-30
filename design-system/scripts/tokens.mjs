#!/usr/bin/env node
// Generate every product's tokens from design-system/tokens.json:
//   apps/extension/src/theme.css   the block between tokens:start and tokens:end
//   apps/mobile/src/ui/tokens.ts   numbers and strings for React Native styles
//   apps/site/app/tokens.css       --fk-color-* and scale variables for the dashboard
// --check compares instead of writing and exits 1 on any drift.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const check = process.argv.includes('--check');
const t = JSON.parse(await readFile(path.join(root, 'design-system/tokens.json'), 'utf8'));
const HEADER = 'Generated from design-system/tokens.json by design-system/scripts/tokens.mjs. Edit the JSON, not this';

const vars = (entries, indent = '  ') => entries.map(([name, value]) => `${indent}--${name}: ${value};`).join('\n');
const px = group => Object.entries(group).map(([k, v]) => [k, `${v}px`]);
const prefixed = (prefix, entries) => entries.map(([k, v]) => [prefix + k, v]);

// Extension: the colour themes, then the scale, exactly the variables theme.css
// declared by hand before (same names, same values).
function extensionBlock() {
  const dark = [...Object.entries(t.color.dark), ...prefixed('fk-shadow-', Object.entries(t.shadow.dark))];
  return [
    `/* tokens:start — ${HEADER} block. */`,
    ':root {', '  color-scheme: light;', vars(Object.entries(t.color.light)), vars(Object.entries(t.font)), '}',
    ':root[data-theme="dark"] {', '  color-scheme: dark;', vars(dark), '}',
    '@media (prefers-color-scheme: dark) {', '  :root:not([data-theme="light"]):not([data-theme="dark"]) {', '    color-scheme: dark;', vars(dark, '    '), '  }', '}',
    '/* Scale tokens (both themes): spacing on a 4px grid, one radius per role,',
    '   control heights, a type scale and elevation. components.css uses only these. */',
    ':root {',
    vars([...prefixed('fk-space-', px(t.space)), ...prefixed('fk-radius-', px(t.radius)), ...prefixed('fk-control-', px(t.control)),
      ...prefixed('fk-text-', Object.entries(t.text).map(([k, v]) => [k, `${v} var(--font)`])),
      ...prefixed('fk-shadow-', Object.entries(t.shadow.light)), ['fk-ease', t.ease]]),
    '}',
    '/* tokens:end */',
  ].join('\n');
}

// App: camelCase names and plain numbers; text styles as React Native props.
const camel = name => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());
function textStyle(value) {
  const m = /^(\d+) ([\d.]+)px\/([\d.]+)$/.exec(value);
  if (!m) throw new Error(`Unreadable text token: ${value}`);
  return { fontWeight: m[1], fontSize: Number(m[2]), lineHeight: Math.round(Number(m[2]) * Number(m[3]) * 10) / 10 };
}
function appModule() {
  const colors = theme => Object.fromEntries(Object.entries(t.color[theme]).map(([k, v]) => [camel(k), v]));
  const tokens = {
    color: { light: colors('light'), dark: colors('dark') },
    space: t.space, radius: t.radius, control: t.control,
    text: Object.fromEntries(Object.entries(t.text).map(([k, v]) => [k, textStyle(v)])),
    // The app sets no family: iOS draws SF Pro, the brand face, on its own.
    shadow: t.shadow, fontFamily: 'System',
  };
  return `// ${HEADER} file.\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const;\n\nexport type ColorName = keyof typeof tokens.color.light;\nexport type Scheme = keyof typeof tokens.color;\n`;
}

// Dashboard: colours as --fk-color-* so they never collide with appearance.css.
function dashboardCss() {
  const font = `var(--fk-font-sans, ${t.font.font})`;
  return [
    `/* ${HEADER} file. */`,
    ':root {',
    vars([...prefixed('fk-color-', Object.entries(t.color.light)), ...prefixed('fk-space-', px(t.space)), ...prefixed('fk-radius-', px(t.radius)),
      ...prefixed('fk-control-', px(t.control)), ...prefixed('fk-text-', Object.entries(t.text).map(([k, v]) => [k, `${v} ${font}`])),
      ...prefixed('fk-shadow-', Object.entries(t.shadow.light)), ['fk-ease', t.ease]]),
    '}',
    ':root[data-theme="dark"] {',
    vars([...prefixed('fk-color-', Object.entries(t.color.dark)), ...prefixed('fk-shadow-', Object.entries(t.shadow.dark))]),
    '}', '',
  ].join('\n');
}

const outputs = [];
const themePath = path.join(root, 'apps/extension/src/theme.css');
const theme = await readFile(themePath, 'utf8');
const start = theme.indexOf('/* tokens:start'), end = theme.indexOf('/* tokens:end */');
if (start < 0 || end < 0) throw new Error('theme.css has no tokens:start / tokens:end markers');
outputs.push([themePath, theme.slice(0, start) + extensionBlock() + theme.slice(end + '/* tokens:end */'.length)]);
outputs.push([path.join(root, 'apps/mobile/src/ui/tokens.ts'), appModule()]);
outputs.push([path.join(root, 'apps/site/app/tokens.css'), dashboardCss()]);

let drift = 0;
for (const [file, content] of outputs) {
  const current = await readFile(file, 'utf8').catch(() => null);
  if (current === content) continue;
  if (check) { drift++; console.error(`✖ ${path.relative(root, file)} differs from tokens.json`); continue; }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  console.log(`wrote ${path.relative(root, file)}`);
}
if (check && drift) { console.error('Run: /usr/bin/node design-system/scripts/tokens.mjs'); process.exit(1); }

import { DOCK_COLORS } from '../dock-source.js';

// Values are read from theme.css's own rules at render time.
const rules = () => [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules]; } catch { return []; } });
const GROUPS = [
  ['Surfaces', ['--bg', '--sidebar', '--card', '--panel', '--hover']],
  ['Lines', ['--line', '--control']],
  ['Text', ['--ink', '--muted', '--faint']],
  ['Accent', ['--accent', '--button', '--button-hover', '--on-button', '--accent-bg']],
  ['Status', ['--good', '--bad']],
];
function swatch(value) {
  const cell = document.createElement('div'); cell.className = 'fk-swatch';
  cell.innerHTML = `<i style="background:${value}"></i><code>${value}</code>`;
  return cell;
}
function table() {
  const light = rules().find(r => r.selectorText === ':root')?.style, dark = rules().find(r => r.selectorText === ':root[data-theme="dark"]')?.style;
  const wrap = document.createElement('div'); wrap.className = 'fk-tokens';
  for (const [group, names] of GROUPS) {
    const h = Object.assign(document.createElement('h3'), { textContent: group }); wrap.append(h);
    const grid = document.createElement('div'); grid.className = 'fk-token-grid';
    grid.innerHTML = '<span class="fk-head">Token</span><span class="fk-head">Light</span><span class="fk-head">Dark</span>';
    for (const name of names) {
      grid.append(Object.assign(document.createElement('code'), { textContent: name }), swatch(light.getPropertyValue(name).trim()), swatch(dark.getPropertyValue(name).trim()));
    }
    wrap.append(grid);
  }
  const h = Object.assign(document.createElement('h3'), { textContent: 'Dock (hard-coded in dock.js, always dark)' });
  const dock = document.createElement('div'); dock.className = 'fk-dock-colors';
  dock.append(...DOCK_COLORS.map(swatch));
  wrap.append(h, dock);
  return wrap;
}
export default {
  title: 'Foundations/Color',
  render: table,
  parameters: { layout: 'padded', docs: { description: { component: 'The colour tokens every extension surface consumes (apps/extension/src/theme.css), light and dark, read live from the stylesheet — plus the colours the dock hard-codes today.' } } },
};
export const Tokens = {};

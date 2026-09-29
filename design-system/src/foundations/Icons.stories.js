import { DOCK_ICONS } from '../dock-source.js';
import { CARD_ICON_PATHS } from '../../../apps/extension/src/card-icons.js';

const svg = (paths, size, stroke) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
function grid(set, { size, stroke, dark }) {
  const g = document.createElement('div'); g.className = 'fk-icons' + (dark ? ' on-dock' : '');
  for (const [name, paths] of Object.entries(set)) {
    const cell = document.createElement('figure');
    cell.innerHTML = `${svg(paths, size, stroke)}<figcaption>${name}</figcaption>`;
    g.append(cell);
  }
  return g;
}
function render(args) {
  const wrap = document.createElement('div');
  const h = text => Object.assign(document.createElement('h3'), { className: 'fk-section', textContent: text });
  wrap.append(h('Dock (dock.js)'), grid(DOCK_ICONS, { ...args, dark: true }), h('Add details card (card-icons.js)'), grid(CARD_ICON_PATHS, args));
  return wrap;
}
export default {
  title: 'Foundations/Icons',
  render,
  args: { size: 18, stroke: 1.75 },
  argTypes: { size: { control: { type: 'range', min: 12, max: 96, step: 2 } }, stroke: { control: { type: 'range', min: 1, max: 2.5, step: 0.05 } } },
  parameters: { docs: { description: { component: 'One rounded icon family across the extension: 24px grid, 1.75 stroke, round caps and joins, no sharp corners — read from dock.js and card-icons.js. Library is the same notebook as the web sidebar.' } } },
};
export const AtUseSize = { name: 'At use size (18px)' };
export const Large = { name: 'Large (64px)', args: { size: 64 } };

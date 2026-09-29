import { DOCK_ICONS, dockIcon } from '../dock-source.js';

function render({ size, stroke, surface }) {
  const grid = document.createElement('div'); grid.className = 'fk-icons' + (surface === 'dock' ? ' on-dock' : '');
  for (const name of Object.keys(DOCK_ICONS)) {
    const cell = document.createElement('figure');
    cell.innerHTML = `${dockIcon(name, size, stroke)}<figcaption>${name}</figcaption>`;
    grid.append(cell);
  }
  return grid;
}
export default {
  title: 'Foundations/Icons',
  render,
  args: { size: 18, stroke: 1.75, surface: 'dock' },
  argTypes: { size: { control: { type: 'range', min: 12, max: 96, step: 2 } }, stroke: { control: { type: 'range', min: 1, max: 2.5, step: 0.05 } }, surface: { control: 'inline-radio', options: ['dock', 'page'] } },
  parameters: { docs: { description: { component: 'The dock\'s icon set, read from dock.js: one rounded 24px family, 1.75 stroke, round caps and joins, no sharp corners. Library is the same notebook as the web sidebar.' } } },
};
export const DockSize = { name: 'At dock size (18px)' };
export const Large = { name: 'Large (64px)', args: { size: 64 } };

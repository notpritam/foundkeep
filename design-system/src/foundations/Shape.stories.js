import { card } from '../card.js';
import { DOCK_CSS } from '../dock-source.js';

const CARD = [
  ['Text field', '#detailsTitle'], ['Dropdown (browser default)', '#detailsFolder'], ['Button', '#detailsSave'],
  ['Tag chip', '.save-tag-chip'], ['New folder panel', '#detailsNewFolder'], ['Card', '#detailsForm'],
];
const DOCK = [['Toolbar', '.dock'], ['Toolbar button', 'button'], ['Collapsed tab', '.pill'], ['⋯ menu', '.menu'], ['Tooltip', '.tip'], ['Saved toast', '.toast']];
const dockRadius = selector => DOCK_CSS.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*?border-radius:([^;}]+)`))?.[1] ?? '—';
function tile(label, radius, note = '') {
  const t = document.createElement('div'); t.className = 'fk-shape';
  t.innerHTML = `<i style="border-radius:${radius}"></i><strong>${label}</strong><code>${radius}</code>${note ? `<small>${note}</small>` : ''}`;
  return t;
}
function render() {
  const source = card({ state: 'new-folder' });
  const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;left:-9999px;top:0'; holder.append(source);
  const wrap = document.createElement('div'); wrap.append(holder);
  const title = text => Object.assign(document.createElement('h3'), { textContent: text });
  const cardRow = document.createElement('div'); cardRow.className = 'fk-shapes';
  const dockRow = document.createElement('div'); dockRow.className = 'fk-shapes';
  wrap.append(title('Add details card (theme.css + review.css)'), cardRow, title('Dock (dock.js)'), dockRow);
  requestAnimationFrame(() => {
    for (const [label, selector] of CARD) { const el = source.querySelector(selector); if (el) cardRow.append(tile(label, getComputedStyle(el).borderRadius)); }
  });
  for (const [label, selector] of DOCK) dockRow.append(tile(label, dockRadius(selector)));
  return wrap;
}
export default {
  title: 'Foundations/Shape',
  render,
  parameters: { docs: { description: { component: 'Corner radii in use today, measured from the real card and read from the dock\'s stylesheet — the card uses 6 / 8 / 10 / 12px while the dock uses 10 / 12 / 14px.' } } },
};
export const Radii = {};

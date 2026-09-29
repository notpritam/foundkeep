import { card } from '../card.js';
import { DOCK_CSS } from '../dock-source.js';

const CARD = [['Card', '.card'], ['Title and note', '.title'], ['Pill and chip', '.pill'], ['Primary button', '.primary'], ['Close button', '.icon-button']];
const DOCK = [['Toolbar', '.dock'], ['Toolbar button', 'button'], ['Floating tab', '.pill'], ['⋯ menu', '.menu'], ['Tooltip', '.tip'], ['Saved toast', '.toast']];
const dockRadius = selector => DOCK_CSS.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*?border-radius:([^;}]+)`))?.[1] ?? '—';
function tile(label, radius) {
  const t = document.createElement('div'); t.className = 'fk-shape';
  t.innerHTML = `<i style="border-radius:${radius}"></i><strong>${label}</strong><code>${radius}</code>`;
  return t;
}
function render() {
  const source = card({ open: null });
  const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;left:-9999px;top:0'; holder.append(source);
  const wrap = document.createElement('div'); wrap.append(holder);
  const title = text => Object.assign(document.createElement('h3'), { className: 'fk-section', textContent: text });
  const cardRow = document.createElement('div'); cardRow.className = 'fk-shapes';
  const dockRow = document.createElement('div'); dockRow.className = 'fk-shapes';
  wrap.append(title('Add details card (review.css)'), cardRow, title('List picker (review.css)'), (() => { const r = document.createElement('div'); r.className = 'fk-shapes'; r.append(tile('List', '12px'), tile('List row and search', '8px')); return r; })(), title('Dock (dock.js)'), dockRow);
  requestAnimationFrame(() => { for (const [label, selector] of CARD) { const el = source.querySelector(selector); if (el) cardRow.append(tile(label, getComputedStyle(el).borderRadius)); } });
  for (const [label, selector] of DOCK) dockRow.append(tile(label, dockRadius(selector)));
  return wrap;
}
export default {
  title: 'Foundations/Shape',
  render,
  parameters: { docs: { description: { component: 'Corner radii, measured from the real card and read from the dock\'s stylesheet: card 16, buttons 10, list rows and fields 8, pills and chips fully round; the dock 14 / 10 / 12.' } } },
};
export const Radii = {};

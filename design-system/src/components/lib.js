// Helpers for component stories: components render from components.css with
// the product's own icons (card-icons.js), shown tight on the canvas.
import { icon, CARD_ICON_PATHS } from '../../../apps/extension/src/card-icons.js';
export { icon };
export const ICON_NAMES = ['none', ...Object.keys(CARD_ICON_PATHS)];
export const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
/** Labelled examples in a wrapping row: [[caption, node], …]. */
export function specimens(items) {
  const wrap = el('<div class="fk-specimens"></div>');
  for (const [caption, node] of items) {
    const figure = el('<figure class="fk-specimen"></figure>');
    figure.append(node);
    figure.insertAdjacentHTML('beforeend', `<figcaption>${caption}</figcaption>`);
    wrap.append(figure);
  }
  return wrap;
}
/** Stacked groups, each with a small heading: [[heading, node], …]. */
export function groups(items) {
  const wrap = el('<div class="fk-groups"></div>');
  for (const [heading, node] of items) { wrap.insertAdjacentHTML('beforeend', `<h3 class="fk-section">${heading}</h3>`); wrap.append(node); }
  return wrap;
}
/** A fixed-width frame for full-width components (fields, cards). */
export const frame = (node, width = 340) => { const f = el(`<div style="width:${width}px;max-width:100%"></div>`); f.append(node); return f; };

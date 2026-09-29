// Card controls as review.html and review.js render them; review.css scopes
// its resets to .card, so every control sits on a .card surface.
import { icon } from '../../../../apps/extension/src/card-icons.js';
export { icon };
export const onCard = (...nodes) => {
  const surface = document.createElement('div');
  surface.className = 'card'; surface.style.cssText = 'width:380px;max-width:100%';
  for (const node of nodes) typeof node === 'string' ? surface.insertAdjacentHTML('beforeend', node) : surface.append(node);
  return surface;
};
export const node = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

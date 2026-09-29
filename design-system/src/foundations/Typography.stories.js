import { card } from '../card.js';

// Each specimen is a real element of the rendered card; the metrics are its computed style.
const SPECIMENS = [
  ['Title', '.title'], ['Note', '.note'], ['Pill', '.pill'], ['Tag chip', '.chip'],
  ['Primary button', '.primary'], ['Status line', '.statusline'], ['Caption line', '#sharedBody'],
];
function render() {
  const source = card({ collectionId: 'col-design', caption: 'The clearest case for spaced review.', state: 'error' });
  const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;left:-9999px;top:0'; holder.append(source);
  const wrap = document.createElement('div'); wrap.append(holder);
  const table = document.createElement('div'); table.className = 'fk-type-grid';
  table.innerHTML = '<span class="fk-head">Role</span><span class="fk-head">Specimen</span><span class="fk-head">Size / line / weight</span><span class="fk-head">Colour</span>';
  wrap.append(table);
  requestAnimationFrame(() => {
    for (const [role, selector] of SPECIMENS) {
      const el = source.querySelector(selector); if (!el) continue;
      const s = getComputedStyle(el);
      const sample = document.createElement('div');
      sample.textContent = (el.value || el.textContent).trim().slice(0, 48);
      for (const p of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']) sample.style.setProperty(p, s.getPropertyValue(p));
      table.append(Object.assign(document.createElement('span'), { textContent: role }), sample,
        Object.assign(document.createElement('code'), { textContent: `${s.fontSize} / ${s.lineHeight} / ${s.fontWeight}` }),
        Object.assign(document.createElement('code'), { textContent: s.color }));
    }
  });
  return wrap;
}
export default {
  title: 'Foundations/Typography',
  render,
  parameters: { docs: { description: { component: 'Every text style in the Add details card, measured from the real rendered card (Inter, from theme.css). Switch Theme in the toolbar to see the dark colours.' } } },
};
export const TextStyles = { name: 'Text styles' };

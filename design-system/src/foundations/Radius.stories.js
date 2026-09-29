const RADII = [['--fk-radius-sm', 'List options, inline fields'], ['--fk-radius-md', 'Buttons, boxed fields, Select field'], ['--fk-radius-lg', 'Listbox, toast'], ['--fk-radius-xl', 'Card'], ['--fk-radius-full', 'Select pill, Tag, Badge, pill Button']];
function render() {
  const wrap = document.createElement('div'); wrap.className = 'fk-shapes';
  for (const [token, use] of RADII) {
    const t = document.createElement('div'); t.className = 'fk-shape';
    t.innerHTML = `<i style="border-radius: var(${token})"></i><code>${token}</code><span></span><small>${use}</small>`;
    requestAnimationFrame(() => { t.querySelector('span').textContent = getComputedStyle(document.documentElement).getPropertyValue(token).trim(); });
    wrap.append(t);
  }
  return wrap;
}
export default { title: 'Foundations/Radius', render, parameters: { docs: { description: { component: 'One radius per role (`--fk-radius-*`): 8 / 10 / 12 / 16px and fully round. Nested corners stay concentric: a 10px button inside a 16px card with 6px of padding. The dock uses the same values (14 / 10 / 12).' } } } };
export const Scale = {};

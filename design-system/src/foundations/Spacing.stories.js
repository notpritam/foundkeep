const SPACE = [['--fk-space-1', 4], ['--fk-space-2', 8], ['--fk-space-3', 12], ['--fk-space-4', 16], ['--fk-space-5', 20], ['--fk-space-6', 24], ['--fk-space-8', 32]];
const CONTROLS = [['--fk-control-sm', 'Select, Tag, small Button'], ['--fk-control-md', 'Button'], ['--fk-control-lg', 'Select field']];
function render() {
  const wrap = document.createElement('div');
  wrap.innerHTML = '<h3 class="fk-section">Space · a 4px grid</h3>' + SPACE.map(([t, px]) => `<div class="fk-space-row"><code>${t}</code><i style="width: var(${t})"></i><span>${px}px</span></div>`).join('')
    + '<h3 class="fk-section">Control heights</h3>' + CONTROLS.map(([t, use]) => `<div class="fk-space-row"><code>${t}</code><i class="tall" style="height: var(${t})"></i><span>${use}</span></div>`).join('');
  return wrap;
}
export default { title: 'Foundations/Spacing', render, parameters: { docs: { description: { component: 'Spacing on a 4px grid (`--fk-space-*`) and three control heights (`--fk-control-*`: 30 / 36 / 40px). Cards use space-4 padding and space-3 between their parts.' } } } };
export const Scale = {};

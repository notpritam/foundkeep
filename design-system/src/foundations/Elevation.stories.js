function render() {
  const wrap = document.createElement('div'); wrap.className = 'fk-elevation';
  wrap.innerHTML = [['--fk-shadow-card', 'Card (raised): surfaces floating over a page'], ['--fk-shadow-popover', 'Popover: the Listbox, menus']]
    .map(([t, use]) => `<div class="fk-card" style="box-shadow: var(${t}); width: 240px; min-height: 96px"><code>${t}</code><span style="color: var(--muted); font: var(--fk-text-caption)">${use}</span></div>`).join('');
  return wrap;
}
export default { title: 'Foundations/Elevation', render, parameters: { docs: { description: { component: 'Two shadows (`--fk-shadow-card`, `--fk-shadow-popover`), stronger in dark so layered near-black surfaces still separate.' } } } };
export const Shadows = {};

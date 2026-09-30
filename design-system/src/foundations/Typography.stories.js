// The type scale: theme.css's --fk-text-* tokens, shown with the computed
// values the browser resolves (SF Pro on Apple devices, else Inter; theme.css).
const SCALE = [
  ['--fk-text-title', 'Title', 'The half-life of a good idea', 'Card and page titles; the inline title field.'],
  ['--fk-text-body', 'Body', 'Worth rereading before the Q4 planning doc.', 'Text fields, notes, list options.'],
  ['--fk-text-label', 'Label', 'Reading list', 'Buttons (sm), Selects, Tags, Badges.'],
  ['--fk-text-caption', 'Caption', 'Some folders could not load. Retry, or save without them.', 'Status messages, secondary lines.'],
  ['--fk-text-micro', 'Micro', 'Needs approval', 'Tooltips, list meta, small badges.'],
];
function render() {
  const wrap = document.createElement('div'); wrap.className = 'fk-scale';
  for (const [token, name, sample, use] of SCALE) {
    const row = document.createElement('div'); row.className = 'fk-scale-row';
    const specimen = document.createElement('div'); specimen.style.font = `var(${token})`; specimen.textContent = sample;
    row.innerHTML = `<div><strong>${name}</strong><code>${token}</code></div>`;
    row.append(specimen);
    const meta = document.createElement('div'); meta.className = 'fk-scale-meta'; row.append(meta);
    requestAnimationFrame(() => { const s = getComputedStyle(specimen); meta.innerHTML = `<code>${s.fontSize} / ${s.lineHeight} / ${s.fontWeight}</code><span>${use}</span>`; });
    wrap.append(row);
  }
  return wrap;
}
export default { title: 'Foundations/Typography', render, parameters: { docs: { description: { component: 'One family — SF Pro, Apple’s system font, with Inter standing in where SF isn’t installed — and five sizes, as `--fk-text-*` tokens in theme.css. Sentence case everywhere; no uppercase labels.' } } } };
export const TypeScale = { name: 'Type scale' };

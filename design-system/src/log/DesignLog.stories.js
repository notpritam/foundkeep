// The design log (since 2026-10-02, at Pritam's ask): every design decision,
// oldest first — the question, what was tried, what he picked and why — so
// the story of how FoundKeep was designed can be told later. Retired variants
// are photographed from git (scripts/design-log-all.mjs → log/<id>/sheet.jpg)
// and restorable from their tag; live ones link to their boards. The words
// are in log/entries.json.
import '../brand/brand.css';
import './log.css';
import log from '../../log/entries.json';

const sheets = import.meta.glob('../../log/*/sheet.jpg', { eager: true, query: '?url', import: 'default' });
const sheetFor = id => sheets[`../../log/${id}/sheet.jpg`];
const STORY_TITLES = { 'sign-in--movement': 'Movement on the page', 'sign-in--pick-one': 'Pick one', 'sign-in--two-versions': 'Versions', 'sign-in--film-variations': 'Film variations', 'sign-in--handoff': 'After Continue with Google', 'first-run--four-ways': 'First run · Four ways' };
const day = (date, month = 'long') => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric' });
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function designLog() {
  const el = document.createElement('div');
  el.className = 'bt dl';
  const entries = log.entries;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Design log</h1><p>How FoundKeep was designed, one decision at a time: what the question was, what was tried, what Pritam picked and why. Nothing tried is thrown away — retired variants are pictured here as they were and can be restored from git; the ones still in the design system are linked live.</p></div></header>
    <ol class="dl-index">${entries.map(e => `<li><a href="#${e.id}"><time>${esc(day(e.date, 'short'))}</time><span>${esc(e.product)}</span>${esc(e.title)}</a></li>`).join('')}</ol>
    ${entries.map(e => {
      const sheet = sheetFor(e.id);
      const evidence = sheet ? `<figure class="dl-sheet"><a class="dl-frame" href="${sheet}" target="_blank" rel="noopener" title="Open the whole sheet"><img loading="lazy" src="${sheet}" alt="Every variant tried for ${esc(e.title)}, as it was"></a>
          <figcaption><a href="${sheet}" target="_blank" rel="noopener">Open the whole sheet</a>. The code as it was: <code>git checkout design-log/${esc(e.id)}</code></figcaption></figure>`
        : e.live ? `<div class="dl-live">Still in the design system, live:<div class="dl-links">${e.live.map(id => `<a href="/?path=/story/${id}" target="_top">${esc(STORY_TITLES[id] || id)}</a>`).join('')}</div></div>` : '';
      return `<article class="dl-entry" id="${e.id}">
        <div class="dl-when"><time datetime="${e.date}">${esc(day(e.date))}</time>${esc(e.product)}</div>
        <div><h2>${esc(e.title)}</h2><p class="dl-question">${esc(e.question)}</p>
          <dl><dt>Tried</dt><dd>${esc(e.tried)}</dd><dt>Picked</dt><dd class="dl-picked">${esc(e.picked)}</dd><dt>Why</dt><dd>${esc(e.why)}</dd></dl>
          ${evidence}</div>
      </article>`;
    }).join('')}`;
  // Links within the page scroll inside the story's frame.
  el.querySelectorAll('.dl-index a').forEach(a => a.addEventListener('click', event => { event.preventDefault(); el.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' }); }));
  return el;
}

export default { title: 'Design log', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const TheStorySoFar = { name: 'The story so far', render: designLog };

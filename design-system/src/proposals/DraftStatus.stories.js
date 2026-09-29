import './banner.css';
import { draftCard, PLACES, DRAFT_STATES } from './draft-status.js';

// Pritam, 2026-09-29: the card's draft line ("Draft · This save couldn't
// sync · Retry") becomes one icon that runs the fix. Where it goes.
function wall(items) {
  const wrap = document.createElement('div'); wrap.className = 'pv-wall';
  for (const [heading, about, node] of items) {
    const block = document.createElement('section'); block.className = 'pv-wall-item';
    block.innerHTML = `<h3>${heading}</h3>${about ? `<p>${about}</p>` : ''}`;
    block.append(node); wrap.append(block);
  }
  return wrap;
}
const everyState = place => () => wall(Object.entries(DRAFT_STATES).map(([state, s]) => [s.label, '', draftCard({ place, state })]));

export default {
  title: 'Proposals/Draft status',
  render: args => draftCard(args),
  args: { place: 'footer', state: 'failed', capture: 'region' },
  argTypes: { place: { control: 'inline-radio', options: Object.keys(PLACES) }, state: { control: 'inline-radio', options: Object.keys(DRAFT_STATES) }, capture: { control: 'inline-radio', options: ['region', 'fullpage', 'post', 'page', 'highlight', 'image'] } },
  parameters: { layout: 'padded', docs: { description: { component: 'A save that has not reached your library shows one status icon — waiting (turning), didn’t sync (red, click to retry), or only in this browser (click to sign in). Its tooltip says what it means. Clicking plays the fix here: retrying, then synced, then the icon leaves. Five places for it.' } } },
};
export const AllFive = { name: 'All five places (didn’t sync)', render: () => wall(Object.entries(PLACES).map(([place, p]) => [p.name, p.about, draftCard({ place, state: 'failed' })])), parameters: { controls: { disable: true } } };
export const BesideSave = { name: '1. Beside Save · every state', render: everyState('footer'), parameters: { controls: { disable: true } } };
export const BesideClose = { name: '2. Beside Close · every state', render: everyState('title'), parameters: { controls: { disable: true } } };
export const OnThePreview = { name: '3. On the preview · every state', render: everyState('preview'), parameters: { controls: { disable: true } } };
export const InTheLibraryBadge = { name: '4. In the My library badge · every state', render: everyState('library'), parameters: { controls: { disable: true } } };
export const BeforeTheTitle = { name: '5. Before the title · every state', render: everyState('leading'), parameters: { controls: { disable: true } } };
export const Playground = {};

import './banner.css';
import { banner, TREATMENTS, BANNER_KINDS } from './banner.js';
import { CAPTURES } from './captures.js';

// Pritam picked the Banner (2026-09-29): five treatments of it, each with
// every kind of save — screenshots, a full page, a post on X, an article,
// a highlight and an image.
function wall(items) {
  const wrap = document.createElement('div'); wrap.className = 'pv-wall';
  for (const [heading, about, node] of items) {
    const block = document.createElement('section'); block.className = 'pv-wall-item';
    block.innerHTML = `<h3>${heading}</h3>${about ? `<p>${about}</p>` : ''}`;
    block.append(node); wrap.append(block);
  }
  return wrap;
}
const byKind = capture => () => wall(Object.entries(TREATMENTS).map(([treatment, t]) => [t.name, t.about, banner({ treatment, capture })]));
const byTreatment = treatment => () => wall(BANNER_KINDS.map(kind => [CAPTURES[kind].kind, '', banner({ treatment, capture: kind })]));

export default {
  title: 'Proposals/Banner preview',
  render: args => banner(args),
  args: { treatment: 'framed', capture: 'region' },
  argTypes: { treatment: { control: 'inline-radio', options: Object.keys(TREATMENTS) }, capture: { control: 'inline-radio', options: BANNER_KINDS } },
  parameters: { layout: 'padded', docs: { description: { component: 'The Banner preview in five treatments — framed, edge to edge, tall with fade, compact strip, and in a frame of its source. Compare them per kind of save (the "All five" stories) or see one treatment with every kind.' } } },
};
export const Screenshot = { name: 'All five · region screenshot', render: byKind('region'), parameters: { controls: { disable: true } } };
export const FullPage = { name: 'All five · full-page screenshot', render: byKind('fullpage'), parameters: { controls: { disable: true } } };
export const Post = { name: 'All five · post on X', render: byKind('post'), parameters: { controls: { disable: true } } };
export const Article = { name: 'All five · article', render: byKind('page'), parameters: { controls: { disable: true } } };
export const Highlight = { name: 'All five · highlight', render: byKind('highlight'), parameters: { controls: { disable: true } } };
export const Image = { name: 'All five · image', render: byKind('image'), parameters: { controls: { disable: true } } };
export const Framed = { name: 'A. Framed · every kind', render: byTreatment('framed'), parameters: { controls: { disable: true } } };
export const EdgeToEdge = { name: 'B. Edge to edge · every kind', render: byTreatment('bleed'), parameters: { controls: { disable: true } } };
export const TallWithFade = { name: 'C. Tall with fade · every kind', render: byTreatment('fade'), parameters: { controls: { disable: true } } };
export const CompactStrip = { name: 'D. Compact strip · every kind', render: byTreatment('strip'), parameters: { controls: { disable: true } } };
export const InAFrame = { name: 'E. In a frame of its source · every kind', render: byTreatment('browser'), parameters: { controls: { disable: true } } };
export const Playground = {};

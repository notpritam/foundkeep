import './preview.css';
import { preview, STYLES } from './preview.js';
import { CAPTURES, CAPTURE_KINDS } from './captures.js';

// Pritam, 2026-09-29: the card shows the title and note but not what was
// saved. Five layouts for a preview, each shown with every kind of save.
function wall(items) {
  const wrap = document.createElement('div'); wrap.className = 'pv-wall';
  for (const [heading, about, node] of items) {
    const block = document.createElement('section'); block.className = 'pv-wall-item';
    block.innerHTML = `<h3>${heading}</h3>${about ? `<p>${about}</p>` : ''}`;
    block.append(node); wrap.append(block);
  }
  return wrap;
}
const everyKind = style => () => wall(CAPTURE_KINDS.map(kind => [CAPTURES[kind].kind, '', preview({ style, capture: kind })]));

export default {
  title: 'Proposals/Save preview',
  render: args => preview(args),
  args: { style: 'row', capture: 'region' },
  argTypes: { style: { control: 'inline-radio', options: Object.keys(STYLES) }, capture: { control: 'inline-radio', options: CAPTURE_KINDS } },
  parameters: { layout: 'padded', docs: { description: { component: 'Where the Add details card shows what you saved — the screenshot or image, the highlighted words, the post, or the page. Five layouts; each has a page with every kind of save (region and full-page screenshots, a highlight, a post on X, an image, a page and a note, which needs no preview). All live on the real card; pick one and it goes into the extension.' } } },
};
export const AllFive = { name: 'All five (a region screenshot)', render: () => wall(Object.entries(STYLES).map(([style, s]) => [s.name, s.about, preview({ style, capture: 'region' })])), parameters: { controls: { disable: true } } };
export const AllFiveHighlight = { name: 'All five (a highlight)', render: () => wall(Object.entries(STYLES).map(([style, s]) => [s.name, s.about, preview({ style, capture: 'highlight' })])), parameters: { controls: { disable: true } } };
export const Banner = { name: '1. Banner · every kind', render: everyKind('banner'), parameters: { controls: { disable: true } } };
export const ThumbnailRow = { name: '2. Thumbnail row · every kind', render: everyKind('row'), parameters: { controls: { disable: true } } };
export const Inline = { name: '3. Inline · every kind', render: everyKind('inline'), parameters: { controls: { disable: true } } };
export const Peek = { name: '4. Peek · every kind', render: everyKind('peek'), parameters: { controls: { disable: true } } };
export const SideThumbnail = { name: '5. Side thumbnail · every kind', render: everyKind('side'), parameters: { controls: { disable: true } } };
export const Playground = {};

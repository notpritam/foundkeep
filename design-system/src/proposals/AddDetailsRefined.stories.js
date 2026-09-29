import './add-details/proposals.css';
import { REFINED_TAKES, refinedProposal } from './add-details/variants.js';

// The card Pritam picked (Quiet sheet + Properties' note, nothing above the
// title) and five more takes on it. Every take shares the same controls.
const argTypes = {
  take: { control: 'select', options: REFINED_TAKES.map(t => t.id), description: 'v6 Refined · v6a Soft pills · v6b Icon pills · v6c Sections · v6d Inline save · v6e Text line' },
  editHint: { control: 'inline-radio', options: ['note', 'both', 'none'], description: 'A faint pencil at the top right of the note (or the title and the note) that says the text is editable.' },
  destination: { control: 'inline-radio', options: ['footer', 'inline', 'merged', 'none'], description: 'On the Save details line (compact My library + Share), in the pill row, one My library pill whose list also offers the collections, or Share alone.' },
  siteIcon: { control: 'boolean', description: 'The page\'s icon beside the title.' },
  open: { table: { disable: true } },
  collection: { table: { disable: true } },
};

function overview() {
  const wrap = document.createElement('div'); wrap.className = 'fkp-takes';
  for (const take of REFINED_TAKES) {
    const row = document.createElement('section'); row.className = 'fkp-take';
    row.innerHTML = `<h3>${take.name}</h3><p>${take.about}</p>`;
    const pair = document.createElement('div'); pair.className = 'fkp-take-pair';
    for (const [caption, editHint] of [['With the edit hint', 'note'], ['Without', 'none']]) {
      const cell = document.createElement('figure');
      cell.innerHTML = `<figcaption>${caption}</figcaption>`;
      cell.append(refinedProposal({ take: take.id, editHint }));
      pair.append(cell);
    }
    row.append(pair); wrap.append(row);
  }
  return wrap;
}

export default {
  title: 'Proposals/Refined card',
  render: args => refinedProposal(args),
  args: { take: 'v6', editHint: 'note', destination: 'inline', siteIcon: false },
  argTypes,
  parameters: { layout: 'padded', docs: { description: { component: 'Pritam\'s pick for the Add details card — Quiet sheet with Properties\' boxless note, nothing above the title, My library and Share to a collection in the row with the folder and tags — and five more takes on it. The note icon is gone; a faint pencil at the top right of the text marks it editable (try the editHint control). All live.' } } },
};

// Pritam's choice (2026-09-29): Refined, no edit hint, My library and Share on the Save details line.
export const Chosen = { name: 'Chosen: Refined, library and share by Save', args: { editHint: 'none', destination: 'footer' }, parameters: { docs: { description: { story: 'The pick: Refined without the edit hint. My library and Share sit on the Save details line, so the pill row holds only the folder and tags. Once shared, the pill reads Shared and the sharing section names the collection.' } } } };
export const ChosenSharing = { name: 'Chosen · sharing', args: { editHint: 'none', destination: 'footer', collection: 'Design that works' } };
export const ChosenPickingAFolder = { name: 'Chosen · picking a folder', args: { editHint: 'none', destination: 'footer', open: 'folder' } };
export const ChosenSharePicker = { name: 'Chosen · picking a collection', args: { editHint: 'none', destination: 'footer', open: 'collection' } };
export const Overview = { name: 'All six, with and without the edit hint', render: overview, parameters: { controls: { disable: true } } };
export const Refined = {};
export const RefinedNoHint = { name: 'Refined · no edit hint', args: { editHint: 'none' } };
export const RefinedBothHints = { name: 'Refined · hint on title and note', args: { editHint: 'both' } };
export const SoftPills = { name: 'A. Soft pills', args: { take: 'v6a' } };
export const IconPills = { name: 'B. Icon pills', args: { take: 'v6b' } };
export const Sections = { name: 'C. Sections', args: { take: 'v6c' } };
export const InlineSave = { name: 'D. Inline save', args: { take: 'v6d' } };
export const TextLine = { name: 'E. Text line', args: { take: 'v6e' } };
export const OneLibraryPill = { name: 'Refined · one My library pill', args: { destination: 'merged' } };
export const Sharing = { name: 'Refined · sharing', args: { collection: 'Design that works' } };
export const PickingAFolder = { name: 'Refined · picking a folder', args: { open: 'folder' } };

import './add-details/proposals.css';
import { card } from '../card.js';
import { VARIANTS, proposal } from './add-details/variants.js';

function overview() {
  const grid = document.createElement('div'); grid.className = 'fkp-overview';
  const block = (name, about, node) => {
    const b = document.createElement('section'); b.className = 'fkp-overview-item';
    b.innerHTML = `<h3>${name}</h3><p>${about}</p>`; b.append(node); return b;
  };
  VARIANTS.forEach((v, i) => grid.append(block(`${i + 1}. ${v.name}`, v.about, proposal(i))));
  grid.append(block('Current', 'Today\'s card, for comparison (review.html as it ships).', card({ state: 'prefilled' })));
  return grid;
}

export default {
  title: 'Proposals/Add details card',
  parameters: { layout: 'padded', docs: { description: { component: 'Five directions for the card that opens from the dock after a save. All are live — edit the title and note, pick a folder, add and remove tags, share to a collection — and follow the Theme toolbar. None uses a native dropdown: every choice opens the same list picker (search, a check on the current value, a create row). Shared scale: card 16px, fields and buttons 10px, list rows 8px, pills fully round; Inter; sentence case.' } } },
};

export const AllFive = { name: 'All five, side by side', render: overview };

const one = (i, opts) => () => proposal(i, opts);
const about = i => ({ docs: { description: { story: VARIANTS[i].about } } });
const SHARING = { state: { collection: 'Design that works', tab: 'share' } };

export const V1 = { name: '1. Quiet sheet', render: one(0), parameters: about(0) };
export const V1Folder = { name: '1. Quiet sheet · picking a folder', render: one(0, { open: 'folder' }) };
export const V1Sharing = { name: '1. Quiet sheet · sharing', render: one(0, SHARING) };
export const V2 = { name: '2. Properties', render: one(1), parameters: about(1) };
export const V2Folder = { name: '2. Properties · picking a folder', render: one(1, { open: 'folder' }) };
export const V2Sharing = { name: '2. Properties · sharing', render: one(1, SHARING) };
export const V3 = { name: '3. Quick picks', render: one(2), parameters: about(2) };
export const V3Folder = { name: '3. Quick picks · picking a folder', render: one(2, { open: 'folder' }) };
export const V3Sharing = { name: '3. Quick picks · sharing', render: one(2, SHARING) };
export const V4 = { name: '4. Details and share', render: one(3), parameters: about(3) };
export const V4Folder = { name: '4. Details and share · picking a folder', render: one(3, { open: 'folder' }) };
export const V4Sharing = { name: '4. Details and share · sharing', render: one(3, SHARING) };
export const V5 = { name: '5. Icon row', render: one(4), parameters: about(4) };
export const V5Folder = { name: '5. Icon row · picking a folder', render: one(4, { open: 'folder' }) };
export const V5Sharing = { name: '5. Icon row · sharing', render: one(4, SHARING) };

// --- 6. Quiet sheet, refined: controls for the choices still open ------------------------------
import { refinedProposal } from './add-details/variants.js';
const refinedArgTypes = {
  destination: { control: 'inline-radio', options: ['inline', 'merged', 'none'], description: 'In the row with the folder and tags: a "My library" pill plus Share to a collection, one "My library" pill whose list also offers the collections, or Share to a collection alone.' },
  noteIcon: { control: 'boolean', description: 'Note icon beside the note, like the property rows.' },
  siteIcon: { control: 'boolean', description: 'The page\'s icon beside the title.' },
  open: { table: { disable: true } },
  collection: { table: { disable: true } },
};
const refinedStory = (name, args, extra = {}) => ({ name, render: a => refinedProposal(a), args: { destination: 'inline', noteIcon: true, siteIcon: false, ...args }, argTypes: refinedArgTypes, ...extra });
export const V6 = refinedStory('6. Quiet sheet, refined', {}, { parameters: { docs: { description: { story: 'Pritam\'s pick: Quiet sheet with Properties\' boxless note and its icon; nothing above the title — "My library" and Share to a collection sit in the row with the folder and tags. Use the controls to try one merged pill, and which icons show.' } } } });
export const V6Merged = refinedStory('6. Refined · one My library pill', { destination: 'merged' });
export const V6MergedOpen = refinedStory('6. Refined · one My library pill, open', { destination: 'merged', open: 'destination' });
export const V6None = refinedStory('6. Refined · no My library pill', { destination: 'none' });
export const V6SiteIcon = refinedStory('6. Refined · with the page icon', { siteIcon: true });
export const V6Sharing = refinedStory('6. Refined · sharing', { collection: 'Design that works' });

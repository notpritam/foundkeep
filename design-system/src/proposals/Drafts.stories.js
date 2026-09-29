import './drafts.css';
import { STATES, cardDraft, dockDraft, dashboardBanner, dashboardCards, dashboardSection } from './drafts.js';

// Pritam, 2026-09-29: a save that has not reached the library yet is a
// draft — waiting to sync, failed, or saved signed out. Show it in the
// extension, on the dashboard, or both.
function wall(items) {
  const wrap = document.createElement('div'); wrap.className = 'pv-wall';
  for (const [heading, about, node] of items) {
    const block = document.createElement('section'); block.className = 'pv-wall-item';
    block.innerHTML = `<h3>${heading}</h3>${about ? `<p>${about}</p>` : ''}`;
    block.append(node); wrap.append(block);
  }
  return wrap;
}
const titled = (heading, about, node) => { const w = wall([[heading, about, node]]); w.firstElementChild.style.width = 'auto'; return w; };

export default {
  title: 'Proposals/Drafts',
  parameters: { layout: 'padded', controls: { disable: true }, docs: { description: { component: '**Decided (2026-09-29):** B, the quiet count on Library (built into the extension), and C, the banner above the library (built with the website). A continues as Proposals / Draft status. — Saves that exist only in the extension: **waiting to sync** (offline or the server is slow), **didn’t sync** (an error — Retry), or **only in this browser** (saved while signed out — Sign in). Two places in the extension (A, B) and three on the web dashboard (C–E); they combine — for example A with C.' } } },
};
export const OnTheCard = {
  name: 'A. On the Add details card',
  render: () => wall(Object.entries(STATES).map(([state, s]) => [s.label, '', cardDraft(state)])),
};
export const OnTheDock = {
  name: 'B. On the dock',
  render: () => wall([['A count on Library', 'The dock’s Library button carries how many saves are waiting; its tooltip says so.', dockDraft({})], ['Quiet: count only', '', dockDraft({ tooltip: false, count: 3 })]]),
};
export const DashboardBanner = { name: 'C. Dashboard banner', render: () => titled('A banner above the library', 'One line with thumbnails of what is waiting, why, and Sync now (it asks the extension to retry).', dashboardBanner()) };
export const DashboardCards = { name: 'D. Draft cards in the library', render: () => titled('Drafts among your saves', 'The waiting saves appear in the grid, dashed and marked “In your extension”, with their state and the fix.', dashboardCards()) };
export const DashboardSection = { name: 'E. “In your extension” section', render: () => titled('A section above the library', 'One row per draft: what it is, its state, and Retry or Sign in; Sync all for the lot.', dashboardSection()) };

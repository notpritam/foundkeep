// Icons for the details card, in the dock's family: 24px grid, 1.75 stroke,
// round caps and joins, every corner curved.
export const CARD_ICON_PATHS = {
  close: '<path d="M7 7l10 10M17 7 7 17"/>',
  chevron: '<path d="m7.5 10 4.5 4.5 4.5-4.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m15.5 15.5 4 4"/>',
  folder: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3.2a2 2 0 0 1 1.4.6l1.1 1.1a2 2 0 0 0 1.4.6h4.9A2.5 2.5 0 0 1 21 9.8v7.7a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 4 17.5z"/>',
  collection: '<path d="M12 4.2 19.4 8a.6.6 0 0 1 0 1.1L12 12.8 4.6 9.1a.6.6 0 0 1 0-1.1z"/><path d="m4.5 12.6 7.5 3.8 7.5-3.8"/><path d="m4.5 16.2 7.5 3.8 7.5-3.8"/>',
  library: '<rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path d="M8.5 3.5v17M12 8.5h4M12 12h4"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
};
export const icon = (name, size = 16) => `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CARD_ICON_PATHS[name]}</svg>`;

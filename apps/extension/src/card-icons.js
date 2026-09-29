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
  // Kinds of save (the dock's family) and sync states.
  screenshot: '<path d="M4 8.5V7a3 3 0 0 1 3-3h1.5M15.5 4H17a3 3 0 0 1 3 3v1.5M20 15.5V17a3 3 0 0 1-3 3h-1.5M8.5 20H7a3 3 0 0 1-3-3v-1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="2.2"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5a1.5 1.5 0 0 1 2.1 0L19 19.5"/>',
  page: '<path d="M8 3.5h5.5L18.5 8.5V18A2.5 2.5 0 0 1 16 20.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5z"/><path d="M13 3.8V7a1.5 1.5 0 0 0 1.5 1.5h3.7M9 13h6M9 16.5h4"/>',
  post: '<path d="M5 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4.5L8 19.2V16a3 3 0 0 1-3-3z"/>',
  quote: '<path d="M9.5 7.5c-2.6.6-4 2.5-4 5.3V16a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 10.5 16v-2A1.5 1.5 0 0 0 9 12.5H7.6M18 7.5c-2.6.6-4 2.5-4 5.3V16a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 19 16v-2a1.5 1.5 0 0 0-1.5-1.5h-1.4"/>',
  sync: '<path d="M18.5 9.5A7 7 0 0 0 6 7.4L4.8 8.7"/><path d="M4.6 4.9v3.9h3.9"/><path d="M5.5 14.5A7 7 0 0 0 18 16.6l1.2-1.3"/><path d="M19.4 19.1v-3.9h-3.9"/>',
  cloudAlert: '<path d="M7.5 17.5h9.2a3.8 3.8 0 0 0 .6-7.6 5.5 5.5 0 0 0-10.6-.9A4.3 4.3 0 0 0 7.5 17.5z"/><path d="M12 10v3"/><circle cx="12" cy="15.3" r=".9" fill="currentColor" stroke="none"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
};
export const icon = (name, size = 16, className = "") => `<svg class="fk-icon${className ? " " + className : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CARD_ICON_PATHS[name]}</svg>`;

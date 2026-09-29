// The dock's icons and stylesheet, read from dock.js itself (a content script
// that cannot be imported): whatever ships is what the design system shows.
import dockSource from '../../apps/extension/src/dock/dock.js?raw';

const iconBlock = dockSource.match(/const ICON = \{([\s\S]*?)\n\s*\};/)[1];
export const DOCK_ICONS = Object.fromEntries([...iconBlock.matchAll(/^\s*(\w+): '([^']+)',?$/gm)].map(([, name, paths]) => [name, paths]));
export const DOCK_CSS = dockSource.match(/const CSS = `([\s\S]*?)`;/)[1];
export const dockIcon = (name, size = 18, stroke = 1.75) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DOCK_ICONS[name]}</svg>`;
/** Every colour the dock hard-codes (it does not use theme.css tokens: it is always dark). */
export const DOCK_COLORS = [...new Set(DOCK_CSS.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi))];

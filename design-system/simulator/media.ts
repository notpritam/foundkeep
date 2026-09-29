// Answer prefers-reduced-motion / prefers-reduced-transparency the way the
// simulator's toolbar says, so the product's own media queries react to it.
const original = typeof window !== 'undefined' ? window.matchMedia.bind(window) : null;
let forced: Record<string, boolean> = {};

export function setMediaPreferences(prefs: { reducedMotion?: boolean; reducedTransparency?: boolean }) {
  forced = { '(prefers-reduced-motion: reduce)': !!prefs.reducedMotion, '(prefers-reduced-transparency: reduce)': !!prefs.reducedTransparency };
  if (!original) return;
  window.matchMedia = (query: string) => {
    const key = query.replace(/\s+/g, ' ').trim();
    if (!(key in forced)) return original(query);
    return { matches: forced[key], media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList;
  };
}

// Brand type candidates (2026-09-30). Pritam: "the font style will become our
// whole brand identity" — so each pairing is tried on the app, the dashboard
// and the scenic pages at once, through the Type toolbar in both Storybooks
// and the Brand type boards in the hub. The fonts are in brand-fonts.css.
// When one is picked it moves into tokens.json and this file goes.
export type Pairing = {
  id: string; name: string;
  /** Where the pairing comes from: Figma's font pairings guide, or our own. */
  source: string;
  /** What it says about FoundKeep, in a line. */
  mood: string;
  /** Headlines, page titles, the wordmark. `word` is the rotating headline's changing word. */
  display: { family: string; weight: number; tracking: number; italic?: boolean };
  word: { family: string; weight: number; tracking: number; italic?: boolean };
  /** Everything else: body, labels, buttons, fields. */
  text: { family: string };
  /** Headline sizes on the phone's first screen: the lead line and the changing word. */
  lead: [size: number, line: number]; wordSize: [size: number, line: number];
};

const stack = (family: string, fallback: string) => `'${family}', ${fallback}`;
const SANS = 'system-ui, sans-serif', SERIF = 'Georgia, serif', MONO = 'ui-monospace, monospace';

export const PAIRINGS: Record<string, Pairing> = {
  today: {
    id: 'today', name: 'As designed (Inter)', source: 'What ships now', mood: 'Inter on the web and the system font in the app: the baseline to compare against.',
    display: { family: stack('Inter', SANS), weight: 600, tracking: -0.03 }, word: { family: stack('Inter', SANS), weight: 700, tracking: -0.035 },
    text: { family: stack('Inter', SANS) }, lead: [38, 44], wordSize: [48, 56],
  },
  'mono-jakarta': {
    id: 'mono-jakarta', name: 'Space Mono + Plus Jakarta Sans', source: 'Figma pairing 3', mood: 'Catalogue cards and field notes: a typewriter headline over a warm, rounded sans.',
    display: { family: stack('Space Mono', MONO), weight: 700, tracking: -0.045 }, word: { family: stack('Space Mono', MONO), weight: 700, tracking: -0.05, italic: true },
    text: { family: stack('Plus Jakarta Sans', SANS) }, lead: [32, 40], wordSize: [40, 50],
  },
  instrument: {
    id: 'instrument', name: 'Instrument Serif + Instrument Sans', source: 'One foundry, two cuts', mood: 'A quiet library: an editorial serif headline and its matching sans.',
    display: { family: stack('Instrument Serif', SERIF), weight: 400, tracking: -0.01 }, word: { family: stack('Instrument Serif', SERIF), weight: 400, tracking: -0.015, italic: true },
    text: { family: stack('Instrument Sans', SANS) }, lead: [52, 56], wordSize: [64, 70],
  },
  'young-instrument': {
    id: 'young-instrument', name: 'Young Serif + Instrument Sans', source: 'Figma pairing 38', mood: "A collector's shelf: a chunky, friendly serif that feels handmade.",
    display: { family: stack('Young Serif', SERIF), weight: 400, tracking: -0.025 }, word: { family: stack('Young Serif', SERIF), weight: 400, tracking: -0.03 },
    text: { family: stack('Instrument Sans', SANS) }, lead: [40, 46], wordSize: [50, 58],
  },
  'syne-inter': {
    id: 'syne-inter', name: 'Syne + Inter', source: 'Figma pairing 27', mood: 'A design studio: a wide, expressive headline; the body stays Inter.',
    display: { family: stack('Syne', SANS), weight: 700, tracking: -0.035 }, word: { family: stack('Syne', SANS), weight: 800, tracking: -0.04 },
    text: { family: stack('Inter', SANS) }, lead: [38, 44], wordSize: [48, 56],
  },
  'rethink-spectral': {
    id: 'rethink-spectral', name: 'Rethink Sans + Spectral', source: 'Figma pairing 36', mood: 'A reading room: a crisp sans headline, a book serif for everything you read.',
    display: { family: stack('Rethink Sans', SANS), weight: 700, tracking: -0.04 }, word: { family: stack('Spectral', SERIF), weight: 400, tracking: -0.02, italic: true },
    text: { family: stack('Spectral', SERIF) }, lead: [38, 44], wordSize: [54, 60],
  },
  'instrument-geist': {
    id: 'instrument-geist', name: 'Instrument Sans + Geist', source: 'Figma pairing 39', mood: 'A precise tool: two clean grotesques, all interface and no ornament.',
    display: { family: stack('Instrument Sans', SANS), weight: 600, tracking: -0.035 }, word: { family: stack('Instrument Sans', SANS), weight: 600, tracking: -0.04, italic: true },
    text: { family: stack('Geist', SANS) }, lead: [38, 44], wordSize: [48, 56],
  },
};
export const PAIRING_IDS = Object.keys(PAIRINGS);
export const pairing = (id: unknown): Pairing | null => (typeof id === 'string' && id !== 'today' && PAIRINGS[id]) || null;

/** The Type toolbar, in both Storybooks. */
export const brandGlobal = {
  brand: { description: 'Brand type pairing (proposal)', toolbar: { title: 'Type', icon: 'grow', items: Object.values(PAIRINGS).map(p => ({ value: p.id, title: p.name })), dynamicTitle: true } },
};

/** The dashboard and site: brand-type-web.css reads these off <html data-brand>. */
export function applyWebPairing(id: unknown) {
  const p = pairing(id), root = document.documentElement;
  if (!p) { delete root.dataset.brand; return; }
  root.dataset.brand = p.id;
  const vars = { '--brand-display': p.display.family, '--brand-display-weight': String(p.display.weight), '--brand-display-tracking': `${p.display.tracking}em`, '--brand-text': p.text.family };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

/** The app: React Native text styles. letterSpacing is in points, so it follows the size. */
type Face = { fontFamily: string; fontWeight: '400' | '500' | '600' | '700' | '800'; fontStyle: 'normal' | 'italic'; fontSize: number; lineHeight: number; letterSpacing: number };
export type AppFaces = { lead: Face; word: Face; text: { fontFamily: string } };
const face = (f: Pairing['display'], [size, line]: [number, number]): Face => ({ fontFamily: f.family, fontWeight: String(f.weight) as Face['fontWeight'], fontStyle: f.italic ? 'italic' : 'normal', fontSize: size, lineHeight: line, letterSpacing: +(f.tracking * size).toFixed(2) });
export function appFaces(id: unknown): AppFaces | undefined {
  const p = pairing(id);
  return p ? { lead: face(p.display, p.lead), word: face(p.word, p.wordSize), text: { fontFamily: p.text.family } } : undefined;
}

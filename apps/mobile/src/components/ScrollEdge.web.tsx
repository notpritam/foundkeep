import { createElement } from 'react';
import { wash, type ScrollEdgeProps } from './scrollEdgeWash.ts';

/** The scroll edge on the web (Storybook, web previews), where expo-backdrop has no
 * build: stacked backdrop blurs, each stronger and held to a band nearer the edge, so
 * the blur ramps up towards it; and the same wash of the page colour. */
const BLURS = [0.5, 1, 2, 4, 8, 16];
export function ScrollEdge({ edge, height, color, hold = 0 }: ScrollEdgeProps) {
  // Gradients run from away from the edge (0%) towards it (100%); the blur ramps up over the
  // first part and holds at full strength over the last `hold` of it.
  const toward = edge === 'top' ? 'to top' : 'to bottom';
  const fade = (1 - hold) * 100, n = BLURS.length;
  const band = (i: number) => {
    const at = (k: number) => `${Math.min(100, (k * fade) / n).toFixed(1)}%`;
    return i === n - 1 ? `linear-gradient(${toward}, transparent ${at(i)}, black ${at(i + 1)}, black 100%)`
      : `linear-gradient(${toward}, transparent ${at(i)}, black ${at(i + 1)}, transparent ${at(i + 2)})`;
  };
  return createElement('div', { 'aria-hidden': true, style: { position: 'absolute', left: 0, right: 0, [edge]: 0, height, pointerEvents: 'none', zIndex: 1 } },
    ...BLURS.map((blur, i) => createElement('div', { key: blur, style: { position: 'absolute', inset: 0, backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: band(i), WebkitMaskImage: band(i) } })),
    createElement('div', { key: 'wash', style: { position: 'absolute', inset: 0, background: `linear-gradient(${toward}, transparent 0%, ${wash(color)} ${fade.toFixed(1)}%, ${wash(color)} 100%)` } }));
}

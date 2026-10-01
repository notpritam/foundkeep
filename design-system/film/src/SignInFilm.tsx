// The sign-in window's film (proposal, 2026-10-01): an 11-second loop of
// FoundKeep at work, in four scenes — a reel you're watching is shared to
// FoundKeep and shrinks into your library as other finds fly in and settle,
// search finds it again, and Kit, your agent, uses it. The phone shows the
// app's real library (its palette and layout, apps/mobile). A Mac-style
// pointer shows each tap; nothing is outlined. Drawn in a 360 × 400 design
// space and rendered at any multiple of it (three times for the app, 9.6
// times for the 4K master) — everything is drawn at full resolution each
// frame, never scaled up from a smaller picture, so text stays crisp. Motion:
// soft eases, blur-dissolves between screens and captions, slow camera moves
// and a gentle sway; no springs, and the last frames dissolve into the first.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

// Inter stands in for SF Pro, which can't be built into a video.
const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const FPS = 30;
export const DURATION = 330;
/** skyBlur: in design units; scale: pixels per design unit (3 → 1080 × 1200, 9.6 → 3456 × 3840). */
export type FilmProps = { skyBlur: number; scale: number };
const SCENE = { save: 0, place: 84, find: 168, agent: 246, loop: 318 };
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);   // arrive: quick, then a long gentle landing
const GLIDE = Easing.bezier(0.65, 0, 0.35, 1);   // move: ease in and out
const ramp = (f: number, a: number, b: number, easing = SETTLE) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
const mix = (p: number, from: number, to: number) => from + (to - from) * p;
/** Piecewise keyframes, eased in and out between each pair. */
function keys(f: number, at: number[], values: number[]) {
  if (f <= at[0]) return values[0];
  for (let i = 1; i < at.length; i++) if (f <= at[i]) return mix(GLIDE((f - at[i - 1]) / (at[i] - at[i - 1])), values[i - 1], values[i]);
  return values[values.length - 1];
}
/** Text typed out while its box keeps its final size, so nothing around it moves. */
function Typed({ text, f, start, perChar = 3, caret }: { text: string; f: number; start: number; perChar?: number; caret?: ReactNode }) {
  const n = Math.max(0, Math.min(text.length, Math.floor((f - start) / perChar)));
  return <>{text.slice(0, n)}{n < text.length ? caret : null}<span style={{ color: 'transparent' }}>{text.slice(n)}</span></>;
}

// The app's light palette (apps/mobile/src/palettes.json).
const C = { paper: '#F5FAFC', surface: '#FFFFFF', ink: '#233E4B', muted: '#526B76', line: '#D6E7EB', accent: '#237CB4', soft: '#E3F4EE', tag: '#1F6F55', dark: '#0f1011' };
const img = (path: string) => staticFile(path);

/** What sits in the library. "dinner" finds the three recipes. */
type Save = { photo: string | null; source: string; title: string; tag: string; dinner?: boolean };
const SAVES: Save[] = [
  { photo: 'film/pasta.jpg', source: 'Reel · Mara cooks', title: '15-minute pasta al pomodoro', tag: 'Recipes', dinner: true },
  { photo: 'film/lake.jpg', source: 'Photo post', title: 'Lake Bled at sunrise', tag: 'Travel' },
  { photo: null, source: 'Tweet', title: 'Make it work, then make it beautiful.', tag: 'Design' },
  { photo: 'film/chair.jpg', source: 'Article · Dwell', title: 'The quiet power of curved furniture', tag: 'Design' },
  { photo: 'film/ramen.jpg', source: 'Short', title: 'Weeknight shoyu ramen', tag: 'Recipes', dinner: true },
  { photo: 'film/tacos.jpg', source: 'Short', title: 'Street tacos, three ways', tag: 'Recipes', dinner: true },
];

// Geometry, in design units. The window crops the phone, as in the reference.
const PHONE = { w: 240, h: 520, top: 80, bezel: 9 };
const PHONE_X = (360 - PHONE.w) / 2;
const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2 };
const SEEN = 400 - PHONE.top - PHONE.bezel;   // how much of the screen the window shows
const GUTTER = 12, GAP = 8;
const CARD = { w: (SCREEN.w - GUTTER * 2 - GAP) / 2, h: 138, photo: 68 };
const GRID_TOP = 178;
const slot = (i: number) => ({ x: GUTTER + (i % 2) * (CARD.w + GAP), y: GRID_TOP + Math.floor(i / 2) * (CARD.h + GAP) });
/** The phone floats; everything that lines up with its screen uses the same offset. */
const float = (f: number) => Math.sin((f / DURATION) * Math.PI * 4) * 2;
/** A point on the screen, in the stage's coordinates. */
const onScreen = (f: number, x: number, y: number) => ({ x: PHONE_X + PHONE.bezel + x, y: PHONE.top + PHONE.bezel + y + float(f) });

// Where things are on the screen, for the pointer.
const TAP = {
  share: { x: SCREEN.w - GUTTER - 8.5, y: SEEN - 132 + 2 * 32 + 8.5 },
  foundkeep: { x: GUTTER + 4 + 21, y: SEEN - 172 + 9 + 16 + 53 + 19 },
  search: { x: GUTTER + 74, y: 126 },
  kit: { x: SCREEN.w - GUTTER - 54, y: 51 },
};
const PRESS = { share: 16, foundkeep: 40, search: SCENE.find + 16, kit: SCENE.agent - 2 };

export function SignInFilm({ skyBlur, scale }: FilmProps) {
  const f = useCurrentFrame();
  const t = (f / DURATION) * Math.PI * 2;
  return <AbsoluteFill style={{ fontFamily, backgroundColor: '#2a7fcf' }}>
    <div style={{ width: 360, height: 400, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative', overflow: 'hidden' }}>
      <Img src={img('sign-in-backgrounds/sky-cumulus-top-medium.webp')} style={{ position: 'absolute', width: 400, height: 866, left: -20 + Math.sin(t) * 5, top: -170 + Math.cos(t) * 4, objectFit: 'cover', filter: `blur(${skyBlur}px)`, transform: 'scale(1.06)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,24,48,0.12), rgba(4,24,48,0) 35%, rgba(4,24,48,0.10))' }} />
      <Stage f={f}>
        <Phone f={f} />
        <FlyIn f={f} />
        <Pointer f={f} />
      </Stage>
      <Caption f={f} />
    </div>
  </AbsoluteFill>;
}

/** The camera and a gentle sway, applied to the phone, the flying cards and the pointer together, so they never drift apart.
 * Flat (2D) transforms only: 3D ones make the browser flatten the layer to a picture first, which softens text. */
function Stage({ f, children }: { f: number; children: ReactNode }) {
  const at = [0, 70, 96, 168, 186, 214, 236, 252, 300, 330];
  const scale = keys(f, at, [1, 1.035, 1, 1, 1.1, 1.1, 1, 1, 1.03, 1]);
  const y = keys(f, at, [0, -6, 0, 0, 30, 30, 0, 0, -18, 0]);
  const sway = [0, 42, 84, 126, 168, 207, 246, 282, 330];
  const lean = keys(f, sway, [-0.6, 0.3, 0, 0.6, 0, -0.4, 0.4, -0.2, -0.6]);
  const drift = keys(f, sway, [-3, 1.5, 0, 3, 0, -2, 2, -1, -3]);
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px) scale(${scale})`, transformOrigin: '50% 34%' }}>
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${drift}px) rotate(${lean}deg)`, transformOrigin: '50% 60%' }}>{children}</div>
  </div>;
}

const CAPTIONS = [
  { icon: 'elements/reel.webp', text: 'Share any reel, post or article.' },
  { icon: 'elements/photo-post.webp', text: 'It all lands in one place.' },
  { icon: 'elements/article.webp', text: 'Find it again in a second.' },
  { icon: 'elements/agent-orb.webp', text: 'Your agent can use it too.' },
];
/** One caption at a time: it fades out with a little blur and lift, then the next fades in. */
function Caption({ f }: { f: number }) {
  const changes = [SCENE.place, SCENE.find, SCENE.agent, DURATION];
  return <>{CAPTIONS.map((caption, i) => {
    // In: from a little below, out of a soft blur. Out: up and away into the same blur.
    const inAt = i === 0 ? null : changes[i - 1] - 2, outAt = changes[i] - 14;
    const fadeIn = inAt === null ? 1 : ramp(f, inAt, inAt + 14);
    const fadeOut = ramp(f, outAt, outAt + 10, GLIDE);
    // The first caption also fades back in over the last frames, so the loop meets itself.
    const again = i === 0 ? ramp(f, DURATION - 12, DURATION + 2) : 0;
    const shown = i === 0 ? (f >= DURATION - 14 ? again : 1 - fadeOut) : fadeIn * (1 - fadeOut);
    if (shown <= 0.001) return null;
    const rising = i === 0 && f >= DURATION - 14 ? 1 - again : i === 0 ? 0 : 1 - fadeIn;
    const leaving = i === 0 && f >= DURATION - 14 ? 0 : fadeOut;
    return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 24 + rising * 8 - leaving * 8, display: 'flex', justifyContent: 'center', opacity: shown, filter: `blur(${(rising + leaving) * 3}px)`, transform: `scale(${0.97 + shown * 0.03})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 13px 0 8px', borderRadius: 15, background: 'rgba(255,255,255,0.94)', boxShadow: '0 8px 22px rgba(4,24,48,0.16)' }}>
        <Img src={img(caption.icon)} style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{caption.text}</span>
      </div>
    </div>;
  })}</>;
}

/** A Mac-style pointer: it glides to each thing that gets tapped and presses it. */
function Pointer({ f }: { f: number }) {
  const P = (name: keyof typeof TAP) => onScreen(f, TAP[name].x, TAP[name].y);
  const out = (x: number, y: number) => ({ x, y });
  // [frame, where] — the pointer's path through the loop; between visits it fades away.
  const legs: { show: [number, number, number, number]; path: [number, { x: number; y: number }][] }[] = [
    { show: [2, 8, 52, 62], path: [[2, out(320, 330)], [PRESS.share, P('share')], [PRESS.share + 6, P('share')], [PRESS.foundkeep, P('foundkeep')], [PRESS.foundkeep + 6, P('foundkeep')], [62, out(250, 370)]] },
    { show: [SCENE.find - 2, SCENE.find + 4, SCENE.find + 30, SCENE.find + 40], path: [[SCENE.find - 2, out(310, 360)], [PRESS.search, P('search')], [PRESS.search + 8, P('search')], [SCENE.find + 40, out(250, 300)]] },
    { show: [SCENE.agent - 22, SCENE.agent - 16, SCENE.agent + 8, SCENE.agent + 16], path: [[SCENE.agent - 22, out(330, 230)], [PRESS.kit, P('kit')], [PRESS.kit + 6, P('kit')], [SCENE.agent + 16, out(320, 160)]] },
  ];
  const leg = legs.find(l => f >= l.show[0] && f <= l.show[3]);
  if (!leg) return null;
  const opacity = ramp(f, leg.show[0], leg.show[1]) * (1 - ramp(f, leg.show[2], leg.show[3], GLIDE));
  const at = leg.path.map(p => p[0]);
  const x = keys(f, at, leg.path.map(p => p[1].x)), y = keys(f, at, leg.path.map(p => p[1].y));
  const press = Object.values(PRESS).reduce((p, frame) => Math.max(p, Math.sin(ramp(f, frame, frame + 6, GLIDE) * Math.PI)), 0);
  return <svg width={17} height={22} viewBox="0 0 17 22" style={{ position: 'absolute', left: x - 2, top: y - 1.5, opacity, zIndex: 20, overflow: 'visible', transform: `scale(${1 - press * 0.16})`, transformOrigin: '2px 1.5px', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
    <path d="M2 1.5 L2 17.6 L6.1 13.8 L8.9 20.2 L11.7 19 L8.95 12.7 L14.6 12.7 Z" fill="#111" stroke="#fff" strokeWidth={1.3} strokeLinejoin="round" />
  </svg>;
}

/** Scene two: finds from out in the world fly in from the edges as the cards they become, and settle into their places. */
const FLIGHTS = [
  { to: 1, from: { x: 350, y: 70, r: 14 }, at: SCENE.place + 8 },
  { to: 2, from: { x: -110, y: 250, r: -12 }, at: SCENE.place + 16 },
  { to: 3, from: { x: 360, y: 300, r: 10 }, at: SCENE.place + 24 },
];
const FLIGHT = 30;
const landsAt = (i: number) => { const flight = FLIGHTS.find(fl => fl.to === i); return flight ? flight.at + FLIGHT : null; };
function FlyIn({ f }: { f: number }) {
  return <>{FLIGHTS.map(fl => {
    if (f < fl.at || f >= fl.at + FLIGHT) return null;
    const p = ramp(f, fl.at, fl.at + FLIGHT, GLIDE);
    const target = onScreen(f, slot(fl.to).x, slot(fl.to).y);
    return <div key={fl.to} style={{ position: 'absolute', left: mix(p, fl.from.x, target.x), top: mix(p, fl.from.y, target.y) - Math.sin(p * Math.PI) * 30, zIndex: 6,
      opacity: ramp(f, fl.at, fl.at + 8), transform: `rotate(${mix(p, fl.from.r, 0)}deg) scale(${mix(p, 1.1, 1)})`, filter: `drop-shadow(0 ${mix(p, 16, 2)}px ${mix(p, 22, 6)}px rgba(4,24,48,${mix(p, 0.28, 0.08)}))` }}>
      <Card save={SAVES[fl.to]} tagged={0} />
    </div>;
  })}</>;
}

function Phone({ f }: { f: number }) {
  const reel = reelShown(f);
  return <div style={{ position: 'absolute', left: PHONE_X, top: PHONE.top + float(f), width: PHONE.w, height: PHONE.h, borderRadius: 42, background: C.dark, padding: PHONE.bezel, boxSizing: 'border-box',
    boxShadow: '0 26px 60px rgba(4,24,48,0.32), 0 0 0 1.2px #3b3d40 inset' }}>
    <div style={{ position: 'relative', width: SCREEN.w, height: SCREEN.h, borderRadius: 33, overflow: 'hidden', background: C.paper }}>
      <Library f={f} />
      <Kit f={f} />
      <Shrink f={f} />
      <Reel f={f} />
      {/* The status bar fades between white over the reel and ink over the app. */}
      <StatusBar ink="#ffffff" opacity={reel} />
      <StatusBar ink={C.ink} opacity={1 - reel} />
    </div>
  </div>;
}

function StatusBar({ ink, opacity }: { ink: string; opacity: number }) {
  if (opacity <= 0.001) return null;
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 32, zIndex: 10, opacity }}>
    <span style={{ position: 'absolute', left: 22, top: 11, fontSize: 10, fontWeight: 600, color: ink, letterSpacing: -0.2 }}>9:41</span>
    <div style={{ position: 'absolute', left: '50%', top: 8, width: 66, height: 19, marginLeft: -33, borderRadius: 10, background: '#000' }} />
    <div style={{ position: 'absolute', right: 20, top: 12, display: 'flex', gap: 4, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 1.2, alignItems: 'flex-end', height: 7 }}>{[3, 4.5, 6, 7].map(h => <div key={h} style={{ width: 1.8, height: h, borderRadius: 0.6, background: ink }} />)}</div>
      <Glyph name="wifi" color={ink} size={9} />
      <div style={{ width: 15, height: 7.5, borderRadius: 2.2, border: `1px solid ${ink}`, padding: 1, boxSizing: 'border-box' }}><div style={{ width: '78%', height: '100%', background: ink, borderRadius: 1 }} /></div>
    </div>
  </div>;
}

// ── Scene one: a reel you're watching, shared to FoundKeep ──
/** How much of the reel shows: all of it, dissolving away as it shrinks into the library, and back at the end for the loop. */
const reelShown = (frame: number) => frame >= SCENE.loop ? ramp(frame, SCENE.loop, DURATION, GLIDE) : 1 - ramp(frame, SCENE.place - 8, SCENE.place + 2, GLIDE);
const REEL_PHOTO = { x: 0, y: 0, w: SCREEN.w, h: SEEN + 30 };
function Reel({ f: frame }: { f: number }) {
  const shown = reelShown(frame);
  if (shown <= 0) return null;
  // At the end the reel returns as it starts, so the loop is seamless.
  const f = frame >= SCENE.loop ? 0 : frame;
  const sheet = ramp(f, PRESS.share + 2, PRESS.share + 20) * (1 - ramp(f, PRESS.foundkeep + 10, PRESS.foundkeep + 24, GLIDE));
  const tile = Math.sin(ramp(f, PRESS.foundkeep, PRESS.foundkeep + 6, GLIDE) * Math.PI);
  const saved = ramp(f, PRESS.foundkeep + 14, PRESS.foundkeep + 26) * (1 - ramp(f, SCENE.place - 16, SCENE.place - 6, GLIDE));
  return <div style={{ position: 'absolute', inset: 0, opacity: shown, filter: frame >= SCENE.loop ? `blur(${(1 - shown) * 4}px)` : 'none', zIndex: 5, background: '#000' }}>
    <Img src={img('film/pasta.jpg')} style={{ position: 'absolute', left: REEL_PHOTO.x, top: REEL_PHOTO.y, width: REEL_PHOTO.w, height: REEL_PHOTO.h, objectFit: 'cover' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: SEEN + 30, background: 'linear-gradient(180deg, rgba(0,0,0,0.38), rgba(0,0,0,0) 26%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.62))' }} />
    <div style={{ position: 'absolute', left: GUTTER + 2, right: GUTTER + 2, top: 38, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.35)' }}><div style={{ width: `${18 + f * 0.55}%`, height: '100%', background: '#fff', borderRadius: 1 }} /></div>
    <div style={{ position: 'absolute', right: GUTTER, top: SEEN - 132, display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'center' }}>
      <Glyph name="heart" color="#fff" size={17} /><Glyph name="comment" color="#fff" size={17} /><Glyph name="share" color="#fff" size={17} />
    </div>
    <div style={{ position: 'absolute', left: GUTTER + 2, right: 48, top: SEEN - 68, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 19, height: 19, borderRadius: 10, background: 'linear-gradient(135deg,#ffc3a3,#ff7a59)', border: '1.5px solid #fff', boxSizing: 'border-box' }} /><span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>Mara cooks</span></div>
      <span style={{ color: '#fff', fontSize: 9, lineHeight: 1.4, opacity: 0.95 }}>15-minute pasta al pomodoro, the one I make every week</span>
    </div>
    {/* The share sheet, FoundKeep first. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: SEEN - 172, height: 260, transform: `translateY(${(1 - sheet) * 190}px)`, opacity: sheet > 0.001 ? 1 : 0, background: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: `9px ${GUTTER + 4}px`, boxSizing: 'border-box', boxShadow: '0 -10px 30px rgba(0,0,0,0.18)' }}>
      <div style={{ width: 32, height: 4, borderRadius: 2, background: C.line, margin: '0 auto 12px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${C.line}` }}>
        <Img src={img('film/pasta.jpg')} style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 9.5, fontWeight: 600, color: C.ink }}>15-minute pasta al pomodoro</span><span style={{ fontSize: 8, color: C.muted }}>Reel · Mara cooks</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {(['FoundKeep', 'Messages', 'Mail', 'Notes'] as const).map((label, i) => <div key={label} style={{ width: 42, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: i === 0 ? '#1d1d1f' : '#eef2f4', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: i === 0 ? `scale(${1 - tile * 0.08})` : 'none' }}>
            {i === 0 ? <Glyph name="mark" color="#fff" size={18} /> : <Glyph name={(['message', 'mail', 'note'] as const)[i - 1]} color={C.muted} size={15} />}
          </div>
          <span style={{ fontSize: 7.5, color: i === 0 ? C.ink : C.muted, fontWeight: i === 0 ? 600 : 500 }}>{label}</span>
        </div>)}
      </div>
    </div>
    {/* Saved. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 50, display: 'flex', justifyContent: 'center', opacity: saved, filter: `blur(${(1 - saved) * 2}px)`, transform: `translateY(${(1 - saved) * -10}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 12px 0 7px', borderRadius: 13, background: 'rgba(255,255,255,0.97)', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ width: 15, height: 15, borderRadius: 8, background: C.tag, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Glyph name="check" color="#fff" size={9} /></div>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: C.ink }}>Saved to FoundKeep</span>
      </div>
    </div>
  </div>;
}

/** The saved reel shrinks from the whole screen into its card's picture, so it visibly lands in the library. */
const SHRINK = { from: SCENE.place - 10, to: SCENE.place + 18 };
function Shrink({ f }: { f: number }) {
  if (f < SHRINK.from || f >= SHRINK.to) return null;
  const p = ramp(f, SHRINK.from, SHRINK.to, GLIDE), card = slot(0);
  return <Img src={img('film/pasta.jpg')} style={{ position: 'absolute', zIndex: 4, objectFit: 'cover',
    left: mix(p, REEL_PHOTO.x, card.x), top: mix(p, REEL_PHOTO.y, card.y), width: mix(p, REEL_PHOTO.w, CARD.w), height: mix(p, REEL_PHOTO.h, CARD.photo),
    borderRadius: `${mix(p, 0, 14)}px ${mix(p, 0, 14)}px 0 0`, boxShadow: `0 ${mix(p, 0, 10)}px ${mix(p, 0, 24)}px rgba(35,62,75,${mix(p, 0, 0.18)})` }} />;
}

/** A card in the library: the same component in the grid and in flight. */
function Card({ save, tagged, photo = true }: { save: Save; tagged: number; photo?: boolean }) {
  return <div style={{ width: CARD.w, height: CARD.h, borderRadius: 14, background: C.surface, overflow: 'hidden', boxShadow: '0 1px 2px rgba(35,62,75,0.06), 0 4px 14px rgba(35,62,75,0.06)' }}>
    {save.photo ? <div style={{ height: CARD.photo }}>{photo ? <Img src={img(save.photo)} style={{ display: 'block', width: '100%', height: CARD.photo, objectFit: 'cover' }} /> : null}</div>
      : <div style={{ height: CARD.photo, background: '#eaf3fb', padding: '9px 10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 13, height: 13, borderRadius: 7, background: '#8db8e8' }} /><div style={{ width: 36, height: 4, borderRadius: 2, background: '#bcd4ee' }} /></div>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#24476b', lineHeight: 1.3 }}>Make it work, then make it beautiful.</span>
      </div>}
    <div style={{ padding: '8px 9px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 7.2, color: C.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{save.source}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: C.ink, lineHeight: 1.25, height: 23, overflow: 'hidden', letterSpacing: -0.1 }}>{save.title}</span>
      <span style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 7.4, fontWeight: 600, color: C.tag, background: C.soft, padding: '2.5px 7px', borderRadius: 6, opacity: tagged, transform: `scale(${0.85 + tagged * 0.15})`, transformOrigin: 'left center' }}>#{save.tag}</span>
    </div>
  </div>;
}

// ── Scenes two and three: the library, then search ──
function Library({ f }: { f: number }) {
  if (f < SCENE.place - 10) return null;
  const typingAt = PRESS.search + 10;
  const typed = f >= typingAt;
  const chipsOut = ramp(f, SCENE.find + 38, SCENE.find + 48, GLIDE);
  const countIn = ramp(f, SCENE.find + 50, SCENE.find + 62);
  const filter = ramp(f, SCENE.find + 44, SCENE.find + 70, GLIDE);
  const dinner = SAVES.map((s, i) => s.dinner ? i : -1).filter(i => i >= 0);
  const caret = <span style={{ display: 'inline-block', width: 1, height: 11, marginLeft: 1, background: C.ink, verticalAlign: -2, opacity: Math.floor(f / 9) % 2 ? 0 : 1 }} />;
  const appear = ramp(f, SCENE.place - 10, SCENE.place + 6);
  return <div style={{ position: 'absolute', inset: 0, background: C.paper, opacity: appear }}>
    <div style={{ position: 'absolute', inset: 0, filter: `blur(${(1 - appear) * 4}px)` }}>
      {/* The app's header, title and line. */}
      <div style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: 42, height: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 17, height: 17, borderRadius: 5, background: '#16181a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Glyph name="mark" color="#fff" size={11} /></div>
        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: -0.3 }}>FoundKeep</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <div style={{ transform: `scale(${1 - Math.sin(ramp(f, PRESS.kit, PRESS.kit + 6, GLIDE) * Math.PI) * 0.15})` }}><Glyph name="sparkle" color="#7a68f0" size={12} /></div>
          <Glyph name="search" color={C.ink} size={12} /><Glyph name="plus" color={C.ink} size={12} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: GUTTER, top: 70, fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: -0.6 }}>The collection.</div>
      <div style={{ position: 'absolute', left: GUTTER, top: 95, fontSize: 8.5, color: C.muted }}>Recently saved · newest first</div>
      {/* Search: tapped, then "dinner" typed in. */}
      <div style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: 112, height: 28, borderRadius: 10, background: C.surface, boxShadow: `0 0 0 1px ${C.line}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
        <Glyph name="search" color={C.muted} size={11} />
        {f >= PRESS.search + 4 ? <span style={{ fontSize: 9.5, color: C.ink, fontWeight: 500 }}>{typed ? <Typed text="dinner" f={f} start={typingAt} perChar={3} caret={caret} /> : caret}</span>
          : <span style={{ fontSize: 9.5, color: C.muted }}>Search your collection</span>}
      </div>
      {/* Kinds; then, once they've gone, how many matched. */}
      <div style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: 148, height: 20, display: 'flex', alignItems: 'center', gap: 2, opacity: 1 - chipsOut }}>
        {['All', 'Reels', 'Posts', 'Articles', 'Recipes'].map((label, i) => <span key={label} style={{ fontSize: 8.5, fontWeight: 600, height: 20, lineHeight: '20px', padding: '0 8px', borderRadius: 7, background: i === 0 ? C.soft : 'transparent', color: i === 0 ? C.accent : C.muted }}>{label}</span>)}
      </div>
      <div style={{ position: 'absolute', left: GUTTER, top: 151, fontSize: 9, color: C.muted, opacity: countIn, transform: `translateY(${(1 - countIn) * 4}px)` }}><b style={{ color: C.ink }}>3 saves</b> match “dinner”</div>
      {SAVES.map((save, i) => {
        const lands = landsAt(i);
        // The reel's card is there as its picture lands; flown cards appear as they touch down; the rest rise into place.
        const enter = i === 0 ? ramp(f, SHRINK.to - 8, SHRINK.to + 4) : lands !== null ? (f >= lands ? 1 : 0) : ramp(f, SCENE.place + 30 + i * 3, SCENE.place + 50 + i * 3);
        const rise = i === 0 || lands !== null ? 0 : (1 - enter) * 14;
        const from = slot(i), to = save.dinner ? slot(dinner.indexOf(i)) : from;
        const keep = save.dinner ? 1 : 1 - filter;
        const tagged = ramp(f, SCENE.place + 50 + i * 4, SCENE.place + 64 + i * 4);
        return <div key={i} style={{ position: 'absolute', left: mix(filter, from.x, to.x), top: mix(filter, from.y, to.y), opacity: enter * keep,
          transform: `translateY(${rise}px) scale(${0.94 + keep * 0.06})` }}>
          <Card save={save} tagged={tagged} photo={i !== 0 || f >= SHRINK.to} />
        </div>;
      })}
    </div>
  </div>;
}

// ── Scene four: Kit, your agent, using what you saved ──
function Kit({ f }: { f: number }) {
  if (f < SCENE.agent - 2) return null;
  const open = ramp(f, SCENE.agent, SCENE.agent + 20) * (1 - ramp(f, SCENE.loop, DURATION, GLIDE));
  const ask = 'Plan Friday dinner from my saves';
  const asked = ramp(f, SCENE.agent + 14, SCENE.agent + 22);
  const thinking = ramp(f, SCENE.agent + 36, SCENE.agent + 40) * (1 - ramp(f, SCENE.agent + 44, SCENE.agent + 48));
  const answer = ramp(f, SCENE.agent + 44, SCENE.agent + 56);
  const done = ramp(f, SCENE.agent + 62, SCENE.agent + 70);
  const recipes = SAVES.filter(s => s.dinner);
  return <>
    <div style={{ position: 'absolute', inset: 0, background: `rgba(16,28,36,${0.24 * open})`, zIndex: 3 }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 74, bottom: 0, transform: `translateY(${(1 - open) * 320}px)`, background: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 4, padding: `9px ${GUTTER + 2}px`, boxSizing: 'border-box', boxShadow: '0 -10px 30px rgba(16,28,36,0.14)' }}>
      <div style={{ width: 32, height: 4, borderRadius: 2, background: C.line, margin: '0 auto 12px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Img src={img('elements/agent-orb.webp')} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 10.5, fontWeight: 700, color: C.ink }}>Kit</span><span style={{ fontSize: 7.5, color: C.tag, fontWeight: 600 }}>● Your agent · connected to your library</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: asked, transform: `translateY(${(1 - asked) * 8}px)` }}>
        <div style={{ maxWidth: 176, background: C.ink, color: '#fff', fontSize: 9.5, lineHeight: 1.35, padding: '7px 11px', borderRadius: 14, borderBottomRightRadius: 5 }}><Typed text={ask} f={f} start={SCENE.agent + 18} perChar={0.6} /></div>
      </div>
      <div style={{ height: 0, position: 'relative' }}>{thinking > 0 ? <div style={{ position: 'absolute', top: 12, left: 2, display: 'flex', gap: 3, opacity: thinking }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: C.muted, opacity: 0.6, transform: `translateY(${Math.sin(f / 3.5 + i) * 1.5}px)` }} />)}</div> : null}</div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6, opacity: answer, filter: `blur(${(1 - answer) * 2}px)`, transform: `translateY(${(1 - answer) * 8}px)` }}>
        <div style={{ paddingTop: 7 }}><Glyph name="sparkle" color="#7a68f0" size={11} /></div>
        <div style={{ flex: 1, background: '#f3f1ff', borderRadius: 14, borderTopLeftRadius: 5, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 9, color: C.ink, fontWeight: 500 }}>Three you saved:</span>
          {recipes.map((r, i) => {
            const row = ramp(f, SCENE.agent + 50 + i * 4, SCENE.agent + 62 + i * 4);
            return <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: row, transform: `translateX(${(1 - row) * -10}px)` }}>
              <Img src={img(r.photo!)} style={{ width: 23, height: 23, borderRadius: 6, objectFit: 'cover' }} />
              <span style={{ fontSize: 8.5, color: C.ink, fontWeight: 600 }}>{r.title}</span>
            </div>;
          })}
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, height: 18, padding: '0 8px', borderRadius: 9, background: C.soft, opacity: done, transform: `scale(${0.9 + done * 0.1})`, transformOrigin: 'left center' }}>
            <Glyph name="check" color={C.tag} size={8} /><span style={{ fontSize: 8, fontWeight: 600, color: C.tag }}>Added to Friday</span>
          </div>
        </div>
      </div>
    </div>
  </>;
}

type GlyphName = 'heart' | 'comment' | 'share' | 'check' | 'search' | 'mark' | 'sparkle' | 'wifi' | 'plus' | 'message' | 'mail' | 'note';
/** Small line icons, drawn rather than borrowed. */
function Glyph({ name, color, size = 18 }: { name: GlyphName; color: string; size?: number }) {
  const stroke: CSSProperties = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths: Record<GlyphName, ReactNode> = {
    heart: <path style={stroke} d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z" />,
    comment: <path style={stroke} d="M4 5h16v11H9l-5 4z" />,
    share: <path style={stroke} d="M4 12l16-8-6 16-3-7z" />,
    check: <path style={{ ...stroke, strokeWidth: 3 }} d="M5 12.5l4.5 4.5L19 7" />,
    search: <><circle style={stroke} cx="11" cy="11" r="6.5" /><path style={stroke} d="M16 16l4 4" /></>,
    mark: <><path style={{ fill: color }} d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z" /><circle cx="10" cy="7.5" r="1.6" fill="#ff5a4e" /></>,
    sparkle: <path style={{ fill: color }} d="M12 2c.6 4.8 2.7 7.2 8 8-5.3.8-7.4 3.2-8 8-.6-4.8-2.7-7.2-8-8 5.3-.8 7.4-3.2 8-8z" />,
    wifi: <><path style={stroke} d="M2.5 9a14 14 0 0 1 19 0M6 12.6a9 9 0 0 1 12 0M9.4 16.2a4 4 0 0 1 5.2 0" /><circle cx="12" cy="19.5" r="1.4" fill={color} /></>,
    plus: <path style={stroke} d="M12 5v14M5 12h14" />,
    message: <path style={stroke} d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L5 19.5l1.2-3.6C4.5 14.6 3.5 12.9 3.5 11 3.5 7.1 7.3 4 12 4z" />,
    mail: <><rect style={stroke} x="3" y="5.5" width="18" height="13" rx="2" /><path style={stroke} d="M3.5 7l8.5 6 8.5-6" /></>,
    note: <><rect style={stroke} x="5" y="3.5" width="14" height="17" rx="2" /><path style={stroke} d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }}>{paths[name]}</svg>;
}

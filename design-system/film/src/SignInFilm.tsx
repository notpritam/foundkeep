// The sign-in window's film (proposal, 2026-10-01): an 11-second loop of
// FoundKeep at work, in four scenes — a reel you're watching is shared to
// FoundKeep, it lands in your library as other finds fly in and settle, search
// finds it again, and your agent uses it. The phone shows the app's real
// library (its palette and layout, apps/mobile). Drawn in a 360 × 400 design
// space, rendered at three times that. Motion: soft eases and slow camera
// moves, no springs; the last frames dissolve into the first, so it loops.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

// Inter stands in for SF Pro, which can't be built into a video.
const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const FPS = 30;
export const DURATION = 330;
export type FilmProps = { skyBlur: number };
const SCENE = { save: 0, place: 84, find: 168, agent: 246, loop: 318 };
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);   // arrive: quick, then a long gentle landing
const GLIDE = Easing.bezier(0.65, 0, 0.35, 1);   // move: ease in and out
const ramp = (f: number, a: number, b: number, easing = SETTLE) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
const mix = (p: number, from: number, to: number) => from + (to - from) * p;
const typed = (text: string, f: number, start: number, perChar = 2.5) => text.slice(0, Math.max(0, Math.floor((f - start) / perChar)));
/** Piecewise keyframes, eased in and out between each pair. */
function keys(f: number, at: number[], values: number[]) {
  if (f <= at[0]) return values[0];
  for (let i = 1; i < at.length; i++) if (f <= at[i]) return mix(GLIDE((f - at[i - 1]) / (at[i] - at[i - 1])), values[i - 1], values[i]);
  return values[values.length - 1];
}

// The app's light palette (apps/mobile/src/palettes.json).
const C = { paper: '#F5FAFC', surface: '#FFFFFF', ink: '#233E4B', muted: '#526B76', line: '#D6E7EB', accent: '#237CB4', soft: '#E3F4EE', tag: '#1F6F55', dark: '#0f1011' };
const img = (path: string) => staticFile(path);

/** What sits in the library. "dinner" finds the three recipes. */
const SAVES = [
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

export function SignInFilm({ skyBlur }: FilmProps) {
  const f = useCurrentFrame();
  const t = (f / DURATION) * Math.PI * 2;
  return <AbsoluteFill style={{ fontFamily, backgroundColor: '#2a7fcf' }}>
    <div style={{ width: 360, height: 400, transform: 'scale(3)', transformOrigin: 'top left', position: 'relative', overflow: 'hidden' }}>
      <Img src={img('sign-in-backgrounds/sky-cumulus-top-medium.webp')} style={{ position: 'absolute', width: 400, height: 866, left: -20 + Math.sin(t) * 5, top: -170 + Math.cos(t) * 4, objectFit: 'cover', filter: `blur(${skyBlur}px)`, transform: 'scale(1.06)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,24,48,0.12), rgba(4,24,48,0) 35%, rgba(4,24,48,0.10))' }} />
      <Camera f={f}>
        <FlyIn f={f} />
        <Phone f={f} t={t} />
      </Camera>
      <Caption f={f} />
    </div>
  </AbsoluteFill>;
}

/** Slow camera moves: a push-in while the reel plays, a zoom into search, a lift to follow the agent. */
function Camera({ f, children }: { f: number; children: ReactNode }) {
  const at = [0, 70, 96, 168, 186, 214, 236, 252, 300, 330];
  const scale = keys(f, at, [1, 1.035, 1, 1, 1.1, 1.1, 1, 1, 1.03, 1]);
  const y = keys(f, at, [0, -6, 0, 0, 30, 30, 0, 0, -18, 0]);
  return <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px) scale(${scale})`, transformOrigin: '50% 34%' }}>{children}</div>;
}

const CAPTIONS = [
  { icon: 'elements/reel.webp', text: 'Share any reel, post or article.' },
  { icon: 'elements/photo-post.webp', text: 'It all lands in one place.' },
  { icon: 'elements/article.webp', text: 'Find it again in a second.' },
  { icon: 'elements/agent-orb.webp', text: 'Your agent can use it too.' },
];
/** One pill: each scene's line rises in as the last one rises away; the first returns at the end so the loop meets itself. */
function Caption({ f }: { f: number }) {
  const changes = [SCENE.place, SCENE.find, SCENE.agent, DURATION];
  return <>{CAPTIONS.map((caption, i) => {
    let shown: number, y: number;
    if (i === 0) {
      const leave = ramp(f, changes[0] - 8, changes[0] + 4, GLIDE), back = ramp(f, SCENE.loop + 4, DURATION);
      shown = f < SCENE.loop ? 1 - leave : back;
      y = f < SCENE.loop ? -12 * leave : 12 * (1 - back);
    } else {
      const enter = ramp(f, changes[i - 1] - 8, changes[i - 1] + 10), leave = ramp(f, changes[i] - 8, changes[i] + 4, GLIDE);
      shown = enter * (1 - leave);
      y = 12 * (1 - enter) - 12 * leave;
    }
    if (shown <= 0.001) return null;
    return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 24 + y, display: 'flex', justifyContent: 'center', opacity: shown }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 13px 0 8px', borderRadius: 15, background: 'rgba(255,255,255,0.94)', boxShadow: '0 8px 22px rgba(4,24,48,0.16)' }}>
        <Img src={img(caption.icon)} style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{caption.text}</span>
      </div>
    </div>;
  })}</>;
}

/** Scene two: finds from out in the world fly in from the edges, arc down and settle into their places. */
const FLIGHTS = [
  { src: 'elements/reel.webp', from: { x: -40, y: 120, r: -16 }, to: 0, at: SCENE.place - 2 },
  { src: 'elements/photo-post.webp', from: { x: 330, y: 60, r: 14 }, to: 1, at: SCENE.place + 6 },
  { src: 'elements/tweet.webp', from: { x: -50, y: 300, r: 10 }, to: 2, at: SCENE.place + 14 },
  { src: 'elements/article.webp', from: { x: 340, y: 280, r: -12 }, to: 3, at: SCENE.place + 20 },
];
const FLIGHT = 30;
const landsAt = (i: number) => { const flight = FLIGHTS.find(fl => fl.to === i); return flight ? flight.at + FLIGHT - 4 : null; };
function FlyIn({ f }: { f: number }) {
  return <>{FLIGHTS.map(fl => {
    if (f < fl.at || f > fl.at + FLIGHT + 4) return null;
    const p = ramp(f, fl.at, fl.at + FLIGHT, GLIDE);
    const target = slot(fl.to);
    // Land exactly on the card's place, at the card's size, then hand over to the card.
    const size = mix(p, 86, CARD.w);
    const tx = PHONE_X + PHONE.bezel + target.x + CARD.w / 2 - size / 2, ty = PHONE.top + PHONE.bezel + target.y + CARD.h / 2 - size / 2;
    const fade = ramp(f, fl.at, fl.at + 6) * (1 - ramp(f, fl.at + FLIGHT - 4, fl.at + FLIGHT + 4));
    return <Img key={fl.src} src={img(fl.src)} style={{ position: 'absolute', width: size, height: size, objectFit: 'contain', zIndex: 4,
      left: mix(p, fl.from.x, tx), top: mix(p, fl.from.y, ty) - Math.sin(p * Math.PI) * 36, opacity: fade,
      transform: `rotate(${mix(p, fl.from.r, 0)}deg)`, filter: `drop-shadow(0 ${mix(p, 14, 3)}px ${mix(p, 20, 6)}px rgba(4,24,48,${mix(p, 0.3, 0.12)}))` }} />;
  })}</>;
}

function Phone({ f, t }: { f: number; t: number }) {
  return <div style={{ position: 'absolute', left: PHONE_X, top: PHONE.top + Math.sin(t * 2) * 2, width: PHONE.w, height: PHONE.h, borderRadius: 42, background: C.dark, padding: PHONE.bezel, boxSizing: 'border-box',
    boxShadow: '0 26px 60px rgba(4,24,48,0.32), 0 0 0 1.2px #3b3d40 inset' }}>
    <div style={{ position: 'relative', width: SCREEN.w, height: SCREEN.h, borderRadius: 33, overflow: 'hidden', background: C.paper }}>
      <Library f={f} />
      <AgentSheet f={f} />
      <Reel f={f} />
      <StatusBar light={f < SCENE.place + 4 || f >= SCENE.loop + 6} />
    </div>
  </div>;
}

function StatusBar({ light }: { light: boolean }) {
  const ink = light ? '#ffffff' : C.ink;
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 32, zIndex: 10 }}>
    <span style={{ position: 'absolute', left: 22, top: 11, fontSize: 10, fontWeight: 600, color: ink, letterSpacing: -0.2 }}>9:41</span>
    <div style={{ position: 'absolute', left: '50%', top: 8, width: 66, height: 19, marginLeft: -33, borderRadius: 10, background: '#000' }} />
    <div style={{ position: 'absolute', right: 20, top: 12, display: 'flex', gap: 4, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 1.2, alignItems: 'flex-end', height: 7 }}>{[3, 4.5, 6, 7].map(h => <div key={h} style={{ width: 1.8, height: h, borderRadius: 0.6, background: ink }} />)}</div>
      <Glyph name="wifi" color={ink} size={9} />
      <div style={{ width: 15, height: 7.5, borderRadius: 2.2, border: `1px solid ${ink}`, padding: 1, boxSizing: 'border-box', opacity: 0.95 }}><div style={{ width: '78%', height: '100%', background: ink, borderRadius: 1 }} /></div>
    </div>
  </div>;
}

// ── Scene one: a reel you're watching, shared to FoundKeep ──
function Reel({ f: frame }: { f: number }) {
  // At the end the reel comes back as it starts, so the loop is seamless.
  const f = frame >= SCENE.loop ? 0 : frame;
  const opacity = frame >= SCENE.loop ? ramp(frame, SCENE.loop, DURATION, GLIDE) : 1 - ramp(frame, SCENE.place - 4, SCENE.place + 8, GLIDE);
  if (opacity <= 0) return null;
  const sheet = ramp(f, 16, 34) * (1 - ramp(f, 50, 64, GLIDE));
  const press = ramp(f, 36, 46, GLIDE);
  const saved = ramp(f, 54, 66);
  return <div style={{ position: 'absolute', inset: 0, opacity, zIndex: 5, background: '#000' }}>
    <Img src={img('film/pasta.jpg')} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: SEEN + 30, objectFit: 'cover', transform: `scale(${1.08 + f * 0.0011})` }} />
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
        {(['FoundKeep', 'Messages', 'Mail', 'Notes'] as const).map((label, i) => <div key={label} style={{ width: 42, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: i === 0 ? '#1d1d1f' : '#eef2f4', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: i === 0 ? `0 0 0 ${2.5 * (1 - saved)}px rgba(35,124,180,${0.25 + 0.35 * Math.sin(press * Math.PI)})` : 'none', transform: i === 0 ? `scale(${1 - Math.sin(press * Math.PI) * 0.09})` : 'none' }}>
            {i === 0 ? <Glyph name="mark" color="#fff" size={18} /> : <Glyph name={(['message', 'mail', 'note'] as const)[i - 1]} color={C.muted} size={15} />}
          </div>
          <span style={{ fontSize: 7.5, color: i === 0 ? C.ink : C.muted, fontWeight: i === 0 ? 600 : 500 }}>{label}</span>
          {i === 0 ? <div style={{ position: 'absolute', left: 21, top: 19, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17, background: 'rgba(35,124,180,0.25)', opacity: Math.sin(press * Math.PI), transform: `scale(${0.4 + press * 0.9})` }} /> : null}
        </div>)}
      </div>
    </div>
    {/* Saved. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 50, display: 'flex', justifyContent: 'center', opacity: saved, transform: `translateY(${(1 - saved) * -12}px) scale(${0.96 + saved * 0.04})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 12px 0 7px', borderRadius: 13, background: 'rgba(255,255,255,0.97)', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ width: 15, height: 15, borderRadius: 8, background: C.tag, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Glyph name="check" color="#fff" size={9} /></div>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: C.ink }}>Saved to FoundKeep</span>
      </div>
    </div>
  </div>;
}

// ── Scenes two and three: the library, then search ──
function Library({ f }: { f: number }) {
  if (f < SCENE.place - 6) return null;
  const query = typed('dinner', f, SCENE.find + 22, 3);
  const focus = ramp(f, SCENE.find + 8, SCENE.find + 20);
  const filter = ramp(f, SCENE.find + 44, SCENE.find + 68, GLIDE);
  const dinner = SAVES.map((s, i) => s.dinner ? i : -1).filter(i => i >= 0);
  const caret = <span style={{ display: 'inline-block', width: 1, height: 11, marginLeft: 1, background: C.accent, verticalAlign: -2, opacity: Math.floor(f / 9) % 2 ? 0 : 1 }} />;
  return <div style={{ position: 'absolute', inset: 0, background: C.paper, opacity: ramp(f, SCENE.place - 6, SCENE.place + 8) }}>
    {/* The app's header, title and line. */}
    <div style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: 42, height: 18, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 17, height: 17, borderRadius: 5, background: '#16181a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Glyph name="mark" color="#fff" size={11} /></div>
      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: -0.3 }}>FoundKeep</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}><Glyph name="archive" color={C.ink} size={12} /><Glyph name="search" color={C.ink} size={12} /><Glyph name="plus" color={C.ink} size={12} /></div>
    </div>
    <div style={{ position: 'absolute', left: GUTTER, top: 70, fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: -0.6 }}>The collection.</div>
    <div style={{ position: 'absolute', left: GUTTER, top: 95, fontSize: 8.5, color: C.muted }}>Recently saved · newest first</div>
    {/* Search: focused, then "dinner" typed in. */}
    <div style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: 112, height: 28, borderRadius: 10, background: C.surface, boxShadow: `0 0 0 ${1 + focus * 0.5}px ${focus > 0.5 ? C.accent : C.line}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
      <Glyph name="search" color={C.muted} size={11} />
      {query ? <span style={{ fontSize: 9.5, color: C.ink, fontWeight: 500 }}>{query}{caret}</span> : focus > 0.5 ? caret : <span style={{ fontSize: 9.5, color: C.muted }}>Search your collection</span>}
    </div>
    {/* Kinds, then how many matched. */}
    <div style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: 148, height: 20, display: 'flex', alignItems: 'center', gap: 2, opacity: 1 - filter }}>
      {['All', 'Reels', 'Posts', 'Articles', 'Recipes'].map((label, i) => <span key={label} style={{ fontSize: 8.5, fontWeight: 600, height: 20, lineHeight: '20px', padding: '0 8px', borderRadius: 7, background: i === 0 ? C.soft : 'transparent', color: i === 0 ? C.accent : C.muted }}>{label}</span>)}
    </div>
    <div style={{ position: 'absolute', left: GUTTER, top: 151, fontSize: 9, color: C.muted, opacity: filter }}><b style={{ color: C.ink }}>3 saves</b> match “dinner”</div>
    {SAVES.map((save, i) => {
      const lands = landsAt(i);
      const enter = lands !== null ? ramp(f, lands, lands + 8) : ramp(f, SCENE.place + 24 + i * 3, SCENE.place + 44 + i * 3);
      const from = slot(i), to = save.dinner ? slot(dinner.indexOf(i)) : from;
      const keep = save.dinner ? 1 : 1 - filter;
      const tagged = ramp(f, SCENE.place + 44 + i * 4, SCENE.place + 58 + i * 4);
      const fresh = i === 0 ? ramp(f, SCENE.place + 26, SCENE.place + 36) * (1 - ramp(f, SCENE.place + 62, SCENE.place + 80)) : 0;
      const at = { x: mix(filter, from.x, to.x), y: mix(filter, from.y, to.y) };
      return <div key={i} style={{ position: 'absolute', left: at.x, top: at.y, width: CARD.w, height: CARD.h, borderRadius: 14, background: C.surface, overflow: 'hidden',
        boxShadow: `0 1px 2px rgba(35,62,75,0.06), 0 4px 14px rgba(35,62,75,0.06), 0 0 0 ${fresh * 1.6}px ${C.accent}`, opacity: enter * keep,
        transform: `translateY(${lands !== null ? 0 : (1 - enter) * 16}px) scale(${(lands !== null ? 0.98 + enter * 0.02 : 0.96 + enter * 0.04) * (0.92 + keep * 0.08)})` }}>
        {save.photo ? <Img src={img(save.photo)} style={{ display: 'block', width: '100%', height: CARD.photo, objectFit: 'cover' }} />
          : <div style={{ height: CARD.photo, background: '#eaf3fb', padding: '9px 10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 13, height: 13, borderRadius: 7, background: '#8db8e8' }} /><div style={{ width: 36, height: 4, borderRadius: 2, background: '#bcd4ee' }} /></div>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#24476b', lineHeight: 1.3 }}>Make it work, then make it beautiful.</span>
          </div>}
        <div style={{ padding: '8px 9px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 7.2, color: C.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{save.source}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: C.ink, lineHeight: 1.25, height: 23, overflow: 'hidden', letterSpacing: -0.1 }}>{save.title}</span>
          <span style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 7.4, fontWeight: 600, color: C.tag, background: C.soft, padding: '2.5px 7px', borderRadius: 6, opacity: tagged, transform: `scale(${0.8 + tagged * 0.2})`, transformOrigin: 'left center' }}>#{save.tag}</span>
        </div>
      </div>;
    })}
  </div>;
}

// ── Scene four: your agent, using what you saved ──
function AgentSheet({ f }: { f: number }) {
  if (f < SCENE.agent - 2) return null;
  const open = ramp(f, SCENE.agent, SCENE.agent + 20) * (1 - ramp(f, SCENE.loop, DURATION, GLIDE));
  const ask = 'Plan Friday dinner from my saves';
  const asked = ramp(f, SCENE.agent + 12, SCENE.agent + 20);
  const thinking = ramp(f, SCENE.agent + 34, SCENE.agent + 38) * (1 - ramp(f, SCENE.agent + 42, SCENE.agent + 46));
  const answer = ramp(f, SCENE.agent + 42, SCENE.agent + 54);
  const done = ramp(f, SCENE.agent + 60, SCENE.agent + 68);
  const recipes = SAVES.filter(s => s.dinner);
  return <>
    <div style={{ position: 'absolute', inset: 0, background: `rgba(16,28,36,${0.24 * open})`, zIndex: 3 }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 74, bottom: 0, transform: `translateY(${(1 - open) * 320}px)`, background: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 4, padding: `9px ${GUTTER + 2}px`, boxSizing: 'border-box', boxShadow: '0 -10px 30px rgba(16,28,36,0.14)' }}>
      <div style={{ width: 32, height: 4, borderRadius: 2, background: C.line, margin: '0 auto 12px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Img src={img('elements/agent-orb.webp')} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 10.5, fontWeight: 700, color: C.ink }}>Your agent</span><span style={{ fontSize: 7.5, color: C.tag, fontWeight: 600 }}>● Connected to your library</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: asked, transform: `translateY(${(1 - asked) * 8}px)` }}>
        <div style={{ maxWidth: 176, background: C.ink, color: '#fff', fontSize: 9.5, lineHeight: 1.35, padding: '7px 11px', borderRadius: 14, borderBottomRightRadius: 5, minHeight: 13 }}>{typed(ask, f, SCENE.agent + 16, 0.7)}</div>
      </div>
      {thinking > 0 ? <div style={{ display: 'flex', gap: 3, marginTop: 12, marginLeft: 2, opacity: thinking }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: C.muted, opacity: 0.6, transform: `translateY(${Math.sin(f / 3.5 + i) * 1.5}px)` }} />)}</div> : null}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, opacity: answer, transform: `translateY(${(1 - answer) * 8}px)` }}>
        <div style={{ paddingTop: 7 }}><Glyph name="sparkle" color="#7a68f0" size={11} /></div>
        <div style={{ flex: 1, background: '#f3f1ff', borderRadius: 14, borderTopLeftRadius: 5, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 9, color: C.ink, fontWeight: 500 }}>Three you saved:</span>
          {recipes.map((r, i) => {
            const row = ramp(f, SCENE.agent + 48 + i * 4, SCENE.agent + 60 + i * 4);
            return <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: row, transform: `translateX(${(1 - row) * -10}px)` }}>
              <Img src={img(r.photo!)} style={{ width: 23, height: 23, borderRadius: 6, objectFit: 'cover' }} />
              <span style={{ fontSize: 8.5, color: C.ink, fontWeight: 600 }}>{r.title}</span>
            </div>;
          })}
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, height: 18, padding: '0 8px', borderRadius: 9, background: C.soft, opacity: done, transform: `scale(${0.85 + done * 0.15})`, transformOrigin: 'left center' }}>
            <Glyph name="check" color={C.tag} size={8} /><span style={{ fontSize: 8, fontWeight: 600, color: C.tag }}>Added to Friday</span>
          </div>
        </div>
      </div>
    </div>
  </>;
}

type GlyphName = 'heart' | 'comment' | 'share' | 'check' | 'search' | 'mark' | 'sparkle' | 'wifi' | 'archive' | 'plus' | 'message' | 'mail' | 'note';
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
    archive: <><rect style={stroke} x="3" y="4" width="18" height="5" rx="1.5" /><path style={stroke} d="M5 9v10h14V9M12 12v5M9.5 14.5L12 17l2.5-2.5" /></>,
    plus: <path style={stroke} d="M12 5v14M5 12h14" />,
    message: <path style={stroke} d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L5 19.5l1.2-3.6C4.5 14.6 3.5 12.9 3.5 11 3.5 7.1 7.3 4 12 4z" />,
    mail: <><rect style={stroke} x="3" y="5.5" width="18" height="13" rx="2" /><path style={stroke} d="M3.5 7l8.5 6 8.5-6" /></>,
    note: <><rect style={stroke} x="5" y="3.5" width="14" height="17" rx="2" /><path style={stroke} d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }}>{paths[name]}</svg>;
}

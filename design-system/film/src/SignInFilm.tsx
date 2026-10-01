// The sign-in window's film (proposal, 2026-10-01): an 11-second loop of
// FoundKeep at work, in four scenes — save a reel from anywhere, it lands in
// your library with everything else, find it again, and your agent uses it.
// Drawn in a 360 × 400 design space and rendered at three times that size.
// Motion: long, soft ease-outs (no springs), like the app; every loop is
// seamless because the last frames dissolve into the first.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

// Inter stands in for SF Pro, which can't be built into a video.
const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const FPS = 30;
export const DURATION = 330;
const SCENE = { save: 0, place: 84, find: 168, agent: 246, loop: 318 };
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const GLIDE = Easing.bezier(0.65, 0, 0.35, 1);
/** 0 → 1 between frames a and b (clamped), eased. */
const ramp = (f: number, a: number, b: number, easing = SETTLE) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
const mix = (p: number, from: number, to: number) => from + (to - from) * p;
const typed = (text: string, f: number, start: number, perChar = 3) => text.slice(0, Math.max(0, Math.floor((f - start) / perChar)));

const C = { ink: '#1d1d1f', muted: '#6e6e73', line: '#e5e5ea', soft: '#f2f2f7', accent: '#0d7a50', mint: '#e3f4ec', white: '#ffffff' };
const img = (path: string) => staticFile(path);

/** What sits in the library. Matching "dinner": the three recipes. */
const SAVES = [
  { photo: 'film/pasta.jpg', kind: 'Reel', title: '15-minute pasta al pomodoro', tag: 'Recipes', dinner: true },
  { photo: 'film/lake.jpg', kind: 'Photo post', title: 'Lake Bled at sunrise', tag: 'Travel' },
  { photo: null, kind: 'Tweet', title: '“Make it work, then make it beautiful.”', tag: 'Design' },
  { photo: 'film/chair.jpg', kind: 'Article', title: 'The quiet power of curved furniture', tag: 'Design' },
  { photo: 'film/ramen.jpg', kind: 'Short', title: 'Weeknight shoyu ramen', tag: 'Recipes', dinner: true },
  { photo: 'film/kyoto.jpg', kind: 'Reel', title: 'Kyoto after dark', tag: 'Travel' },
  { photo: 'film/tacos.jpg', kind: 'Short', title: 'Street tacos, three ways', tag: 'Recipes', dinner: true },
  { photo: 'film/sneaker.jpg', kind: 'Post', title: 'Cloud runner in pastel', tag: 'Wishlist' },
];

// Phone and screen geometry, in design units.
const PHONE = { x: 64, y: 100, w: 232, h: 500, bezel: 9 };
const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2 };
/** The window cuts the phone off (as in the reference), so only the top of its screen shows. */
const SEEN = 400 - PHONE.y - PHONE.bezel - 6;
const GRID = { top: 128, pad: 9, gap: 8, cardH: 132 };
const CARD_W = (SCREEN.w - GRID.pad * 2 - GRID.gap) / 2;
const slot = (i: number) => ({ x: GRID.pad + (i % 2) * (CARD_W + GRID.gap), y: GRID.top + Math.floor(i / 2) * (GRID.cardH + GRID.gap) });

export function SignInFilm() {
  const f = useCurrentFrame();
  const t = (f / DURATION) * Math.PI * 2;
  return <AbsoluteFill style={{ fontFamily, backgroundColor: '#1a78c8' }}>
    <div style={{ width: 360, height: 400, transform: 'scale(3)', transformOrigin: 'top left', position: 'relative', overflow: 'hidden' }}>
      {/* The sky, drifting very slightly. */}
      <Img src={img('sign-in-backgrounds/sky-cumulus-top-medium.webp')} style={{ position: 'absolute', width: 380, height: 823, left: -10 + Math.sin(t) * 4, top: -150 + Math.cos(t) * 3, objectFit: 'cover', filter: 'blur(1.2px)', transform: 'scale(1.04)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,24,48,0.10), rgba(4,24,48,0) 40%, rgba(4,24,48,0.12))' }} />
      <FlyIn f={f} />
      <Phone f={f} t={t} />
      <Captions f={f} />
    </div>
  </AbsoluteFill>;
}

/** The caption pills above the phone: the scene's line in front, the next one waiting behind it. */
const CAPTIONS = [
  { icon: 'elements/reel.webp', text: 'Save any reel, post or article.' },
  { icon: 'elements/photo-post.webp', text: 'It all lands in one place.' },
  { icon: 'elements/article.webp', text: 'Find it again in a second.' },
  { icon: 'elements/agent-orb.webp', text: 'Your agent can use it too.' },
];
function Captions({ f }: { f: number }) {
  // c climbs by one at each scene change; at the loop it reaches 4, which is 0 again.
  const c = ramp(f, SCENE.place - 6, SCENE.place + 6, GLIDE) + ramp(f, SCENE.find - 6, SCENE.find + 6, GLIDE) + ramp(f, SCENE.agent - 6, SCENE.agent + 6, GLIDE) + ramp(f, SCENE.loop + 1, DURATION, GLIDE);
  return <>{CAPTIONS.map((caption, i) => {
    let d = (((i - c) % 4) + 4) % 4;
    if (d > 2.5) d -= 4;
    const y = interpolate(d, [-1, 0, 1, 2], [-16, 0, 23, 36]);
    const scale = interpolate(d, [-1, 0, 1, 2], [0.97, 1, 0.92, 0.86]);
    const opacity = interpolate(d, [-1, -0.4, 0, 1, 2], [0, 0.4, 1, 0.6, 0]);
    const front = d < 0.5;
    return <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 30 + y, display: 'flex', justifyContent: 'center', opacity, transform: `scale(${scale})`, zIndex: front ? 3 : 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px 6px 7px', borderRadius: 999, background: front ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.55)', boxShadow: front ? '0 6px 18px rgba(4,24,48,0.18)' : 'none', backdropFilter: 'blur(6px)' }}>
        <Img src={img(caption.icon)} style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{caption.text}</span>
      </div>
    </div>;
  })}</>;
}

/** Scene two opens with things from out in the world flying into the phone. */
function FlyIn({ f }: { f: number }) {
  const items = [
    { src: 'elements/reel.webp', from: { x: -30, y: 150, r: -14 }, to: 0, at: SCENE.place - 4 },
    { src: 'elements/tweet.webp', from: { x: 330, y: 120, r: 12 }, to: 2, at: SCENE.place + 1 },
    { src: 'elements/article.webp', from: { x: 320, y: 300, r: 10 }, to: 3, at: SCENE.place + 6 },
  ];
  return <>{items.map(item => {
    const p = ramp(f, item.at, item.at + 26, GLIDE);
    if (p <= 0 || p >= 1) return null;
    const target = slot(item.to);
    const tx = PHONE.x + PHONE.bezel + target.x + CARD_W / 2 - 40, ty = PHONE.y + PHONE.bezel + target.y + 30 - 40;
    const appear = ramp(f, item.at, item.at + 6);
    return <Img key={item.src} src={img(item.src)} style={{ position: 'absolute', width: 80, height: 80, objectFit: 'contain', zIndex: 4,
      left: mix(p, item.from.x, tx), top: mix(p, item.from.y, ty) - Math.sin(p * Math.PI) * 30,
      opacity: appear * (1 - ramp(f, item.at + 18, item.at + 26)),
      transform: `rotate(${mix(p, item.from.r, 0)}deg) scale(${mix(p, 1.15, 0.55)})`, filter: 'drop-shadow(0 8px 14px rgba(4,24,48,0.25))' }} />;
  })}</>;
}

function Phone({ f, t }: { f: number; t: number }) {
  // A gentle float and a slow push-in through each scene, both looping.
  const scene = f < SCENE.place ? f / SCENE.place : f < SCENE.find ? (f - SCENE.place) / 84 : f < SCENE.agent ? (f - SCENE.find) / 78 : (f - SCENE.agent) / 84;
  const push = 1 + 0.02 * Math.sin(scene * Math.PI);
  return <div style={{ position: 'absolute', left: PHONE.x, top: PHONE.y + Math.sin(t * 2) * 2.5, width: PHONE.w, height: PHONE.h, borderRadius: 40, background: '#0f1011', padding: PHONE.bezel, boxSizing: 'border-box',
    boxShadow: '0 30px 60px rgba(4,24,48,0.35), 0 0 0 1.5px #3a3b3e inset', transform: `scale(${push})`, transformOrigin: '50% 30%' }}>
    <div style={{ position: 'relative', width: SCREEN.w, height: SCREEN.h, borderRadius: 32, overflow: 'hidden', background: C.white }}>
      <Library f={f} />
      <AgentSheet f={f} />
      <Reel f={f} />
      <StatusBar dark={f < SCENE.place + 6 || f >= SCENE.loop + 6} />
    </div>
  </div>;
}

function StatusBar({ dark }: { dark: boolean }) {
  const ink = dark ? C.white : C.ink;
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', zIndex: 10 }}>
    <span style={{ fontSize: 9.5, fontWeight: 600, color: ink }}>9:41</span>
    <div style={{ position: 'absolute', left: '50%', top: 7, width: 62, height: 18, marginLeft: -31, borderRadius: 10, background: '#000' }} />
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      <div style={{ width: 13, height: 7, borderRadius: 2, border: `1px solid ${ink}`, padding: 1, boxSizing: 'border-box' }}><div style={{ width: '75%', height: '100%', background: ink, borderRadius: 1 }} /></div>
    </div>
  </div>;
}

// ── Scene one: a reel you come across, saved to FoundKeep from the share sheet ──
function Reel({ f: frame }: { f: number }) {
  // The last frames bring the reel back at its start, so the loop is seamless.
  const f = frame >= SCENE.loop ? 0 : frame;
  const opacity = frame >= SCENE.loop ? ramp(frame, SCENE.loop, DURATION, GLIDE) : 1 - ramp(frame, SCENE.place - 2, SCENE.place + 8, GLIDE);
  if (opacity <= 0) return null;
  const sheet = ramp(f, 18, 32) * (1 - ramp(f, 48, 60, GLIDE));
  const tap = ramp(f, 38, 50);
  const saved = ramp(f, 52, 62);
  return <div style={{ position: 'absolute', inset: 0, opacity, zIndex: 5, background: '#000' }}>
    <Img src={img('film/pasta.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.06 + f * 0.0012})` }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: SEEN + 20, background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 25%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6))' }} />
    {/* Progress, the creator and caption, and the actions down the side. */}
    <div style={{ position: 'absolute', left: 12, right: 12, top: 34, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.35)' }}><div style={{ width: `${20 + f * 0.6}%`, height: '100%', background: C.white, borderRadius: 2 }} /></div>
    <div style={{ position: 'absolute', left: 12, top: SEEN - 78, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 18, height: 18, borderRadius: 9, background: 'linear-gradient(135deg,#ffc3a3,#ff7a59)', border: '1.5px solid #fff' }} /><span style={{ color: C.white, fontSize: 9.5, fontWeight: 600 }}>Mara cooks</span></div>
      <span style={{ color: C.white, fontSize: 9, width: 140, lineHeight: 1.35 }}>15-minute pasta al pomodoro, the one I make every week</span>
    </div>
    <div style={{ position: 'absolute', right: 10, top: SEEN - 150, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <Glyph name="heart" color={C.white} /><Glyph name="comment" color={C.white} /><Glyph name="share" color={C.white} />
    </div>
    {/* The share sheet, with FoundKeep in it. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: SEEN - 128, height: 300, transform: `translateY(${(1 - sheet) * 140}px)`, opacity: sheet > 0 ? 1 : 0, background: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '8px 14px', boxSizing: 'border-box' }}>
      <div style={{ width: 30, height: 4, borderRadius: 2, background: C.line, margin: '0 auto 10px' }} />
      <div style={{ fontSize: 10, fontWeight: 600, color: C.ink, marginBottom: 12 }}>Share</div>
      <div style={{ display: 'flex', gap: 14 }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: i === 0 ? C.accent : C.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: i === 0 ? `0 0 0 ${2 + tap * 2}px rgba(13,122,80,${0.25 * (1 - saved)})` : 'none', transform: i === 0 ? `scale(${1 - Math.sin(tap * Math.PI) * 0.08})` : 'none' }}>
            {i === 0 ? <Glyph name="bookmark" color={C.white} size={16} /> : <div style={{ width: 14, height: 14, borderRadius: i === 3 ? 3 : 7, background: '#c7c7cc' }} />}
          </div>
          <span style={{ fontSize: 7.5, color: i === 0 ? C.ink : C.muted, fontWeight: i === 0 ? 600 : 400 }}>{['FoundKeep', 'Messages', 'Mail', 'Copy'][i]}</span>
          {i === 0 ? <div style={{ position: 'absolute', left: 19, top: 19, width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, background: 'rgba(0,0,0,0.25)', opacity: Math.sin(tap * Math.PI) * 0.8, transform: `scale(${0.5 + tap})` }} /> : null}
        </div>)}
      </div>
    </div>
    {/* Saved. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 46, display: 'flex', justifyContent: 'center', opacity: saved, transform: `translateY(${(1 - saved) * -14}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.96)', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Glyph name="check" color={C.white} size={9} /></div>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: C.ink }}>Saved to FoundKeep</span>
      </div>
    </div>
  </div>;
}

// ── Scenes two and three: the library, then search ──
function Library({ f }: { f: number }) {
  if (f < SCENE.place - 4) return null;
  const query = typed('dinner', f, SCENE.find + 10, 3);
  const focus = ramp(f, SCENE.find, SCENE.find + 10);
  const filter = ramp(f, SCENE.find + 34, SCENE.find + 56, GLIDE);
  const dinner = SAVES.map((s, i) => s.dinner ? i : -1).filter(i => i >= 0);
  return <div style={{ position: 'absolute', inset: 0, background: '#fbfbfd', opacity: ramp(f, SCENE.place - 4, SCENE.place + 6) }}>
    <div style={{ position: 'absolute', left: 12, top: 38, right: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <div style={{ width: 13, height: 13, borderRadius: 4, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Glyph name="bookmark" color={C.white} size={8} /></div>
        <span style={{ fontSize: 8.5, fontWeight: 600, color: C.ink }}>FoundKeep</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: -0.5 }}>The collection.</div>
    </div>
    {/* Search: focused, then "dinner" typed into it. */}
    <div style={{ position: 'absolute', left: 9, right: 9, top: 84, height: 24, borderRadius: 9, background: C.white, boxShadow: `0 0 0 ${1 + focus * 0.6}px ${focus > 0.5 ? C.accent : C.line}`, display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px', transform: `scale(${1 + focus * 0.015})` }}>
      <Glyph name="search" color={C.muted} size={10} />
      {query ? <span style={{ fontSize: 9, color: C.ink, fontWeight: 500 }}>{query}<span style={{ opacity: Math.floor(f / 8) % 2 ? 0 : 1, color: C.accent }}>|</span></span>
        : <span style={{ fontSize: 9, color: C.muted }}>{focus > 0.5 ? <span style={{ opacity: Math.floor(f / 8) % 2 ? 0 : 1, color: C.accent }}>|</span> : 'Search your collection'}</span>}
    </div>
    {/* Kinds, or the count once the search has matched. */}
    <div style={{ position: 'absolute', left: 9, top: 113, display: 'flex', gap: 4, opacity: 1 - filter }}>
      {['All', 'Reels', 'Recipes', 'Travel', 'Design'].map((label, i) => <span key={label} style={{ fontSize: 7.5, fontWeight: 600, padding: '3px 7px', borderRadius: 999, background: i === 0 ? C.ink : C.soft, color: i === 0 ? C.white : C.muted }}>{label}</span>)}
    </div>
    <div style={{ position: 'absolute', left: 11, top: 114, fontSize: 8.5, color: C.muted, opacity: filter }}><b style={{ color: C.ink }}>3 saves</b> match “dinner”</div>
    {SAVES.map((save, i) => {
      const enter = ramp(f, i === 0 ? SCENE.place + 22 : i === 2 ? SCENE.place + 26 : i === 3 ? SCENE.place + 30 : SCENE.place + 8 + i * 3, (i === 0 ? SCENE.place + 22 : i === 2 ? SCENE.place + 26 : i === 3 ? SCENE.place + 30 : SCENE.place + 8 + i * 3) + 16);
      const from = slot(i), to = save.dinner ? slot(dinner.indexOf(i)) : from;
      const keep = save.dinner ? 1 : 1 - filter;
      const tagged = ramp(f, SCENE.place + 40 + i * 4, SCENE.place + 52 + i * 4);
      const fresh = i === 0 ? ramp(f, SCENE.place + 24, SCENE.place + 34) * (1 - ramp(f, SCENE.place + 60, SCENE.place + 76)) : 0;
      return <div key={i} style={{ position: 'absolute', left: mix(filter, from.x, to.x), top: mix(filter, from.y, to.y), width: CARD_W, height: GRID.cardH, borderRadius: 12, background: C.white, overflow: 'hidden',
        boxShadow: `0 1px 2px rgba(0,0,0,0.06), 0 0 0 ${fresh * 2}px ${C.accent}`, opacity: enter * keep, transform: `translateY(${(1 - enter) * 20}px) scale(${(0.95 + enter * 0.05) * (0.9 + keep * 0.1)})` }}>
        {save.photo ? <Img src={img(save.photo)} style={{ width: '100%', height: 74, objectFit: 'cover', display: 'block' }} />
          : <div style={{ height: 74, background: '#eef4ff', padding: 8, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 6, background: '#7aa7ff' }} /><div style={{ width: 34, height: 4, borderRadius: 2, background: '#b9cdf5' }} /></div>
            <span style={{ fontSize: 8.5, fontWeight: 600, color: '#1f3b6e', lineHeight: 1.3 }}>Make it work, then make it beautiful.</span>
          </div>}
        <div style={{ padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 6.8, color: C.muted, fontWeight: 500 }}>{save.kind}</span>
          <span style={{ fontSize: 8.2, fontWeight: 600, color: C.ink, lineHeight: 1.25, height: 21, overflow: 'hidden' }}>{save.title}</span>
          <span style={{ alignSelf: 'flex-start', fontSize: 6.8, fontWeight: 600, color: C.accent, background: C.mint, padding: '2px 6px', borderRadius: 999, opacity: tagged, transform: `scale(${0.7 + tagged * 0.3})`, transformOrigin: 'left center' }}>#{save.tag}</span>
        </div>
      </div>;
    })}
  </div>;
}

// ── Scene four: your agent, using what you saved ──
function AgentSheet({ f }: { f: number }) {
  if (f < SCENE.agent - 2) return null;
  const open = ramp(f, SCENE.agent, SCENE.agent + 16) * (1 - ramp(f, SCENE.loop, DURATION, GLIDE));
  const ask = 'Plan Friday dinner from my saves';
  const asked = ramp(f, SCENE.agent + 10, SCENE.agent + 18);
  const thinking = ramp(f, SCENE.agent + 36, SCENE.agent + 40) * (1 - ramp(f, SCENE.agent + 44, SCENE.agent + 48));
  const answer = ramp(f, SCENE.agent + 44, SCENE.agent + 54);
  const done = ramp(f, SCENE.agent + 58, SCENE.agent + 66);
  const recipes = SAVES.filter(s => s.dinner);
  return <>
    <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.22 * open})`, zIndex: 3 }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 68, bottom: 0, transform: `translateY(${(1 - open) * 300}px)`, background: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, zIndex: 4, padding: '8px 12px', boxSizing: 'border-box', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)' }}>
      <div style={{ width: 30, height: 4, borderRadius: 2, background: C.line, margin: '0 auto 9px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <Img src={img('elements/agent-orb.webp')} style={{ width: 22, height: 22, objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>Your agent</span><span style={{ fontSize: 7, color: C.accent, fontWeight: 600 }}>● Connected to your library</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: asked, transform: `translateY(${(1 - asked) * 8}px)` }}>
        <div style={{ maxWidth: 150, background: C.ink, color: C.white, fontSize: 9, lineHeight: 1.35, padding: '7px 10px', borderRadius: 13, borderBottomRightRadius: 4, minHeight: 12 }}>{typed(ask, f, SCENE.agent + 14, 0.7)}</div>
      </div>
      {thinking > 0 ? <div style={{ display: 'flex', gap: 3, marginTop: 10, opacity: thinking }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: C.muted, transform: `translateY(${Math.sin((f / 4) + i) * 1.5}px)` }} />)}</div> : null}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, opacity: answer, transform: `translateY(${(1 - answer) * 8}px)` }}>
        <Glyph name="sparkle" color="#7b6cff" size={12} />
        <div style={{ flex: 1, background: '#f3f2ff', borderRadius: 13, borderTopLeftRadius: 4, padding: '7px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 8.5, color: C.ink, fontWeight: 500 }}>Three you saved:</span>
          {recipes.map((r, i) => {
            const row = ramp(f, SCENE.agent + 48 + i * 4, SCENE.agent + 58 + i * 4);
            return <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: row, transform: `translateX(${(1 - row) * -12}px)` }}>
              <Img src={img(r.photo!)} style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
              <span style={{ fontSize: 8, color: C.ink, fontWeight: 600 }}>{r.title}</span>
            </div>;
          })}
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, padding: '3px 7px', borderRadius: 999, background: C.mint, opacity: done, transform: `scale(${0.8 + done * 0.2})`, transformOrigin: 'left center' }}>
            <Glyph name="check" color={C.accent} size={8} /><span style={{ fontSize: 7.5, fontWeight: 600, color: C.accent }}>Added to Friday</span>
          </div>
        </div>
      </div>
    </div>
  </>;
}

/** Small line icons, drawn rather than borrowed. */
function Glyph({ name, color, size = 18 }: { name: 'heart' | 'comment' | 'share' | 'check' | 'search' | 'bookmark' | 'sparkle'; color: string; size?: number }) {
  const stroke: CSSProperties = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths: Record<typeof name, ReactNode> = {
    heart: <path style={stroke} d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z" />,
    comment: <path style={stroke} d="M4 5h16v11H9l-5 4z" />,
    share: <path style={stroke} d="M4 12l16-8-6 16-3-7z" />,
    check: <path style={{ ...stroke, strokeWidth: 3 }} d="M5 12.5l4.5 4.5L19 7" />,
    search: <><circle style={stroke} cx="11" cy="11" r="6.5" /><path style={stroke} d="M16 16l4 4" /></>,
    bookmark: <path style={{ ...stroke, fill: color }} d="M7 4h10v16l-5-3.5L7 20z" />,
    sparkle: <path style={{ fill: color }} d="M12 2c.6 4.8 2.7 7.2 8 8-5.3.8-7.4 3.2-8 8-.6-4.8-2.7-7.2-8-8 5.3-.8 7.4-3.2 8-8z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>{paths[name]}</svg>;
}

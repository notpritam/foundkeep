// The poll (2026-10-01): Pritam's three shortlisted sign-in screens side by
// side, numbered, at 1920 × 1080, to post and ask which is better. Each phone
// plays its screen as captured frame by frame from the App Storybook
// (scripts/capture-story.mjs → <public dir>/<1|2|3>/0000.jpg …), so what you
// see is the real screen, not a redrawing.
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const POLL = { fps: 30, frames: 390 };
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SETTLE });
const INK = '#233E4B', MUTED = '#526B76';

// The screens are 402 × 874 points; at 0.888 they fit 800 px of phone height.
const SCREEN = { w: 357, h: 776 }, BEZEL = 12, GAP = 120;
const PHONE = { w: SCREEN.w + BEZEL * 2, h: SCREEN.h + BEZEL * 2 };
const OPTIONS = [
  { dir: '1', name: 'Elements flying in', light: true },
  { dir: '2', name: 'White page with a film', light: false },
  { dir: '3', name: 'Sky with a soft film', light: true },
];

export function PollFilm() {
  const f = useCurrentFrame();
  const left = (1920 - (PHONE.w * 3 + GAP * 2)) / 2;
  const title = ramp(f, 0, 18);
  return <AbsoluteFill style={{ fontFamily, background: 'radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #f1f6f9 55%, #e7eff4 100%)' }}>
    <div style={{ position: 'absolute', top: 44, left: 0, right: 0, textAlign: 'center', opacity: title, transform: `translateY(${(1 - title) * 10}px)` }}>
      <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1.2, color: INK }}>Which sign-in should FoundKeep ship?</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 500, color: MUTED }}>Reply 1, 2 or 3</div>
    </div>
    {OPTIONS.map((option, i) => {
      const enter = ramp(f, 4 + i * 4, 22 + i * 4);
      const frame = String(Math.min(f, POLL.frames - 1)).padStart(4, '0');
      const ink = option.light ? '#ffffff' : INK;
      return <div key={option.dir} style={{ position: 'absolute', left: left + i * (PHONE.w + GAP), top: 168, width: PHONE.w, opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}>
        <div style={{ position: 'relative', width: PHONE.w, height: PHONE.h, borderRadius: 66, background: '#0f1011', padding: BEZEL, boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(35,62,75,0.22), 0 0 0 2px #3b3d40 inset' }}>
          <div style={{ position: 'relative', width: SCREEN.w, height: SCREEN.h, borderRadius: 54, overflow: 'hidden', background: '#000' }}>
            <Img src={staticFile(`${option.dir}/${frame}.jpg`)} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* The status bar the screens leave room for. */}
            <span style={{ position: 'absolute', left: 38, top: 22, fontSize: 17, fontWeight: 600, color: ink, letterSpacing: -0.3 }}>9:41</span>
            <div style={{ position: 'absolute', left: '50%', top: 12, width: 112, height: 33, marginLeft: -56, borderRadius: 17, background: '#000' }} />
            <div style={{ position: 'absolute', right: 34, top: 25, width: 26, height: 12, borderRadius: 4, border: `1.5px solid ${ink}`, padding: 1.5, boxSizing: 'border-box', opacity: 0.95 }}><div style={{ width: '78%', height: '100%', borderRadius: 2, background: ink }} /></div>
          </div>
        </div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: INK, color: '#fff', fontSize: 21, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{option.dir}</div>
          <span style={{ fontSize: 24, fontWeight: 600, color: INK, letterSpacing: -0.4 }}>{option.name}</span>
        </div>
      </div>;
    })}
  </AbsoluteFill>;
}

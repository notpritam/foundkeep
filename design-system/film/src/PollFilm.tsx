// The shortlist film (2026-10-01): Pritam's three shortlisted sign-in screens
// side by side on a slowly moving gradient — the screens only, no words, so he
// can add his own when he posts it. Each phone plays its screen as captured
// frame by frame from the App Storybook (scripts/capture-story.mjs →
// <public dir>/<1|2|3>/0000.jpg …), so it is the real screen, not a redrawing.
// Two shapes: wide (1920 × 1080) and tall, for Reels (1080 × 1920), each
// rendered at any multiple (2 → 4K).
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['600'], subsets: ['latin'] });

export const POLL = { fps: 30, frames: 390 };
/** count: how many phones (3 for the sign-in poll, 4 for the app tour: a row when wide, 2 × 2 when tall);
 * frames: how long; skyUntil: the frame before which the screens show the sky (a white status bar after
 * which it turns dark) — for the app tour, which starts on sign-in and moves to the Library. */
export type PollProps = { shape: 'wide' | 'tall'; scale: number; count?: number; frames?: number; skyUntil?: number };
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SETTLE });

// A phone at the screens' own size (402 × 874 points) in a thin bezel; each shape sizes and spaces it.
const SCREEN = { w: 402, h: 874 }, BEZEL = 13;
const PHONE = { w: SCREEN.w + BEZEL * 2, h: SCREEN.h + BEZEL * 2 };
const SHAPES = {
  wide: { w: 1920, h: 1080, phone: 1, gap: 120 },
  tall: { w: 1080, h: 1920, phone: 0.7, gap: 34 },
};
const SCREENS = [{ dir: '1', light: true }, { dir: '2', light: false }, { dir: '3', light: true }];
/** Four phones: a row when wide, two by two when tall. */
const FOUR = { wide: { phone: 0.92, gap: 40 }, tall: { phone: 0.93, gap: 60 } };

/** Soft colour fields drifting on slow loops — sky blues with a little lilac, mint and peach. Positions are fractions of the frame. */
const FIELDS = [
  { color: '#5aa9f0', size: 1.0, x: 0.12, y: 0.2, dx: 0.10, dy: 0.08, speed: 1, phase: 0 },
  { color: '#b9a8ff', size: 0.86, x: 0.82, y: 0.18, dx: 0.08, dy: 0.10, speed: 1, phase: 0.3 },
  { color: '#9fe3c8', size: 0.82, x: 0.25, y: 0.9, dx: 0.12, dy: 0.06, speed: 1, phase: 0.55 },
  { color: '#ffc9ae', size: 0.75, x: 0.78, y: 0.86, dx: 0.09, dy: 0.08, speed: 1, phase: 0.8 },
  { color: '#2f7fd6', size: 0.69, x: 0.5, y: 0.45, dx: 0.14, dy: 0.10, speed: 2, phase: 0.15 },
];
function Gradient({ f, w, h, frames = POLL.frames }: { f: number; w: number; h: number; frames?: number }) {
  const t = (f / frames) * Math.PI * 2, unit = Math.max(w, h) * 0.57;
  return <AbsoluteFill style={{ background: 'linear-gradient(160deg, #dcecfb 0%, #eaf2fb 45%, #f2eefb 100%)', overflow: 'hidden' }}>
    {FIELDS.map((field, i) => {
      const size = field.size * unit;
      const x = (field.x + Math.sin(t * field.speed + field.phase * Math.PI * 2) * field.dx) * w;
      const y = (field.y + Math.cos(t * field.speed + field.phase * Math.PI * 2) * field.dy) * h;
      return <div key={i} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${field.color}, transparent)`, opacity: 0.9, filter: 'blur(60px)' }} />;
    })}
  </AbsoluteFill>;
}

export function PollFilm({ shape, scale, count = 3, frames = POLL.frames, skyUntil }: PollProps) {
  const f = useCurrentFrame();
  const S = SHAPES[shape], four = count === 4 ? FOUR[shape] : null;
  const phone = four?.phone ?? S.phone, gap = four?.gap ?? S.gap, pw = PHONE.w * phone, ph = PHONE.h * phone;
  const grid = shape === 'tall' && count === 4;
  const across = grid ? 2 : count, down = grid ? 2 : 1;
  const left = (S.w - (pw * across + gap * (across - 1))) / 2, top = (S.h - (ph * down + gap * (down - 1))) / 2;
  const screens = count === 3 && skyUntil === undefined ? SCREENS : Array.from({ length: count }, (_, i) => ({ dir: String(i + 1), light: skyUntil !== undefined && f < skyUntil }));
  return <AbsoluteFill style={{ fontFamily, backgroundColor: '#e6f0fa' }}>
    <div style={{ width: S.w, height: S.h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative', overflow: 'hidden' }}>
      <Gradient f={f} w={S.w} h={S.h} frames={frames} />
      {screens.map((screen, i) => {
        const enter = ramp(f, i * 4, 18 + i * 4);
        const frame = String(Math.min(f, frames - 1)).padStart(4, '0');
        const ink = screen.light ? '#ffffff' : '#233E4B';
        const col = i % across, row = Math.floor(i / across);
        return <div key={screen.dir} style={{ position: 'absolute', left: left + col * (pw + gap), top: top + row * (ph + gap) + (1 - enter) * 26, width: PHONE.w, height: PHONE.h, opacity: enter, transform: `scale(${phone})`, transformOrigin: 'top left' }}>
          <div style={{ width: PHONE.w, height: PHONE.h, borderRadius: 70, background: '#0f1011', padding: BEZEL, boxSizing: 'border-box', boxShadow: '0 40px 90px rgba(20,48,84,0.28), 0 0 0 2px #3b3d40 inset' }}>
            <div style={{ position: 'relative', width: SCREEN.w, height: SCREEN.h, borderRadius: 58, overflow: 'hidden', background: '#000' }}>
              <Img src={staticFile(`${screen.dir}/${frame}.jpg`)} style={{ width: '100%', height: '100%', display: 'block' }} />
              {/* The status bar the screens leave room for. */}
              <span style={{ position: 'absolute', left: 42, top: 24, fontSize: 19, fontWeight: 600, color: ink, letterSpacing: -0.3 }}>9:41</span>
              <div style={{ position: 'absolute', left: '50%', top: 13, width: 124, height: 36, marginLeft: -62, borderRadius: 18, background: '#000' }} />
              <div style={{ position: 'absolute', right: 38, top: 28, width: 29, height: 13, borderRadius: 4, border: `1.6px solid ${ink}`, padding: 1.6, boxSizing: 'border-box', opacity: 0.95 }}><div style={{ width: '78%', height: '100%', borderRadius: 2, background: ink }} /></div>
            </div>
          </div>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

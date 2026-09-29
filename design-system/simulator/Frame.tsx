// The simulator's frames. A framed story renders twice: the outer page draws
// the device (bezel, status bar, Dynamic Island, home indicator, keyboard or a
// browser bar) around an iframe exactly the device's size, and that iframe
// renders the story itself (`simulator=inner`). The story then gets a real
// viewport: window size, media queries and 100vh match the device.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Device } from './devices.ts';

export const isInner = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('simulator') === 'inner';

/** Inner frame: report errors to the outer page, where the render check sees them. */
export function relayErrorsToParent() {
  if (!isInner() || window.parent === window) return;
  const send = (message: string) => window.parent.postMessage({ type: 'fk-simulator-error', message }, '*');
  window.addEventListener('error', e => send(String(e.message)));
  window.addEventListener('unhandledrejection', e => send(String((e.reason as Error)?.message || e.reason)));
  const error = console.error.bind(console);
  console.error = (...args: unknown[]) => { send(args.map(String).join(' ').slice(0, 400)); error(...args); };
}
/** Outer page: print what inner frames report. */
export function listenForInnerErrors() {
  if (isInner()) return;
  window.addEventListener('message', e => { if (e.data?.type === 'fk-simulator-error') console.error(`[simulator] ${e.data.message}`); });
}

export function innerUrl(storyId: string, globals: Record<string, unknown>) {
  const g = Object.entries(globals).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => `${k}:${v}`).join(';');
  return `iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&simulator=inner&globals=${encodeURIComponent(g)}`;
}

function useFit(width: number, height: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 32) / width, (window.innerHeight - 32) / height));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, [width, height]);
  return scale;
}
function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const scale = useFit(width, height);
  return <div style={{ width: width * scale, height: height * scale, margin: '0 auto' }}>
    <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
  </div>;
}

const KEYBOARD = { ios: 291, android: 280, web: 0 };
function StatusBar({ device, dark }: { device: Device; dark: boolean }) {
  const ink = dark ? '#fff' : '#000';
  const icons = <svg width="68" height="12" viewBox="0 0 68 12" fill={ink} aria-hidden="true">
    <rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" />
    <path d="M31 3.5a8 8 0 0 1 10 0l-1.3 1.4a6 6 0 0 0-7.4 0zM33.2 6a4.8 4.8 0 0 1 5.6 0l-1.3 1.4a3 3 0 0 0-3 0zM36 11l-1.6-1.8a2.4 2.4 0 0 1 3.2 0z" />
    <rect x="45" y="1" width="20" height="10" rx="3" fill="none" stroke={ink} opacity=".45" /><rect x="47" y="3" width="15" height="6" rx="1.5" /><rect x="66" y="4.5" width="1.5" height="3" rx=".7" opacity=".45" />
  </svg>;
  const style: CSSProperties = { position: 'absolute', inset: '0 0 auto 0', height: device.insets.top, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: device.island ? '0 34px 0 50px' : '0 16px', font: '600 15px -apple-system, system-ui, sans-serif', color: ink, pointerEvents: 'none', zIndex: 2, boxSizing: 'border-box' };
  return <div style={style}><span>9:41</span>{device.island ? <span style={{ position: 'absolute', left: '50%', top: 11, width: 124, height: 36, marginLeft: -62, borderRadius: 20, background: '#000' }} /> : null}{icons}</div>;
}
function Keyboard({ device, dark }: { device: Device; dark: boolean }) {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const key: CSSProperties = { flex: 1, height: 42, margin: '0 3px', borderRadius: 6, background: dark ? '#6b6b6e' : '#fff', color: dark ? '#fff' : '#000', display: 'grid', placeItems: 'center', font: '400 22px -apple-system, system-ui', boxShadow: '0 1px 0 rgba(0,0,0,.3)' };
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 'auto 0 0 0', height: KEYBOARD[device.platform], background: dark ? '#2b2b2d' : '#d1d3d9', padding: '8px 3px', boxSizing: 'border-box', zIndex: 2 }}>
    {rows.map((row, i) => <div key={row} style={{ display: 'flex', marginBottom: 11, padding: i === 1 ? '0 18px' : i === 2 ? '0 46px' : 0 }}>{[...row].map(c => <span key={c} style={key}>{c}</span>)}</div>)}
    <div style={{ display: 'flex', padding: '0 3px' }}><span style={{ ...key, flex: 2.4, fontSize: 15 }}>123</span><span style={{ ...key, flex: 6 }}>space</span><span style={{ ...key, flex: 2.4, fontSize: 15, background: dark ? '#4cc38a' : '#0d7a50', color: '#fff' }}>return</span></div>
  </div>;
}

/** insetContent: the page inside knows nothing of safe areas (a live web build), so
 * keep it clear of the status bar and home indicator, as iOS would. */
export function PhoneFrame({ device, src, dark, keyboard = false, insetContent = false, background }: { device: Device; src: string; dark: boolean; keyboard?: boolean; insetContent?: boolean; background?: string }) {
  const bezel = device.kind === 'tablet' ? 16 : 12;
  const kb = keyboard ? KEYBOARD[device.platform] : 0;
  return <Scaled width={device.width + bezel * 2} height={device.height + bezel * 2}>
    <div style={{ padding: bezel, borderRadius: device.radius + bezel, background: '#1b1c1e', boxShadow: '0 0 0 1px #3a3b3e, 0 30px 80px rgba(0,0,0,.35)' }}>
      <div style={{ position: 'relative', width: device.width, height: device.height, borderRadius: device.radius, overflow: 'hidden', background: background || (dark ? '#000' : '#fff') }}>
        <iframe title={`${device.label} screen`} src={src} style={{ display: 'block', width: device.width, height: device.height - kb - (insetContent ? device.insets.top + device.insets.bottom : 0), marginTop: insetContent ? device.insets.top : 0, border: 0, background }} />
        {insetContent ? <span aria-hidden="true" style={{ position: 'absolute', inset: '0 0 auto 0', height: device.insets.top, background }} /> : null}
        <StatusBar device={device} dark={dark} />
        {keyboard ? <Keyboard device={device} dark={dark} /> : null}
        {device.insets.bottom ? <span aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: 8, width: 134, height: 5, marginLeft: -67, borderRadius: 3, background: dark ? '#fff' : '#000', opacity: keyboard ? 0 : 0.85, pointerEvents: 'none', zIndex: 3 }} /> : null}
      </div>
    </div>
  </Scaled>;
}

export function BrowserFrame({ device, src, dark, url }: { device: Device; src: string; dark: boolean; url: string }) {
  if (device.kind === 'phone' || device.kind === 'tablet') return <PhoneFrame device={device} src={src} dark={dark} />;
  const bar = 40;
  return <Scaled width={device.width} height={device.height + bar}>
    <div style={{ borderRadius: device.radius, overflow: 'hidden', border: `1px solid ${dark ? '#2a2c30' : '#d9dbde'}`, boxShadow: '0 30px 80px rgba(0,0,0,.25)', background: dark ? '#08090a' : '#fff' }}>
      <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: dark ? '#1a1c20' : '#eceef0', boxSizing: 'border-box' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
        <span style={{ flex: 1, maxWidth: 520, margin: '0 auto', height: 26, borderRadius: 7, background: dark ? '#0f1011' : '#fff', color: dark ? '#a5aab2' : '#686868', font: '400 13px Inter, system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{url}</span>
      </div>
      <iframe title={`${device.label} window`} src={src} style={{ display: 'block', width: device.width, height: device.height, border: 0 }} />
    </div>
  </Scaled>;
}

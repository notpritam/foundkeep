// The Live pages: the real app and dashboard, running on the throwaway demo
// (deploy/demo), inside the simulator's frames.
import type { ReactNode } from 'react';
import type { Device } from './devices.ts';
import { BrowserFrame, PhoneFrame } from './Frame.tsx';

export const DEMO_EMAIL = 'lena@demo.foundkeep.invalid', DEMO_PASSWORD = 'keep-good-finds-demo';
/** The demo gateway beside this Storybook: omni--8814 → omni--8818, or port 8818 locally. */
export function demoOrigin() {
  const { protocol, hostname } = location;
  return hostname.includes('--8814.') ? `${protocol}//${hostname.replace('--8814.', '--8818.')}` : `${protocol}//${hostname}:8818`;
}

function Aside({ children, open, wide = false }: { children: ReactNode; open: string; wide?: boolean }) {
  return <aside style={{ width: wide ? 'auto' : 300, maxWidth: wide ? 760 : undefined, flex: 'none', font: '14px/1.55 Inter, system-ui, sans-serif', color: '#202020' }}>
    {children}
    <p style={{ margin: '14px 0 0' }}><strong>Sign in with email</strong><br /><code>{DEMO_EMAIL}</code><br /><code>{DEMO_PASSWORD}</code></p>
    <p style={{ margin: '14px 0 0' }}><a href={open} target="_blank" rel="noreferrer" style={{ color: '#0d7a50' }}>Open in a new tab ↗</a></p>
    <p style={{ margin: '14px 0 0', color: '#686868', fontSize: 13 }}>A throwaway demo with the sample library. Reset it with <code>/usr/bin/node deploy/demo/seed.mjs</code>. Sign-ins are rate limited (10 per 15 minutes).</p>
  </aside>;
}

export function LiveApp({ device, dark }: { device: Device; dark: boolean }) {
  const src = demoOrigin() + '/app/';
  return <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', padding: 24 }}>
    <div style={{ flex: 1 }}><PhoneFrame device={device} src={src} dark={dark} insetContent background={dark ? '#16191d' : '#f5fafc'} /></div>
    <Aside open={src}><h2 style={{ font: '600 18px Inter, system-ui', margin: 0 }}>The real app, live</h2>
      <p style={{ margin: '8px 0 0' }}>The FoundKeep app’s own web build — every tap is real, against a demo backend.</p>
      <p style={{ margin: '8px 0 0', color: '#686868' }}>Close to iOS but not exact: fonts, blur, native sheets and the share sheet differ. TestFlight and the Android build stay the last check.</p></Aside>
  </div>;
}

export function LiveDashboard({ device, dark }: { device: Device; dark: boolean }) {
  const src = demoOrigin() + '/login';
  // The window is as wide as the canvas, so the note sits above it.
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
    <Aside open={src} wide><h2 style={{ font: '600 18px Inter, system-ui', margin: 0 }}>The real dashboard, live</h2>
      <p style={{ margin: '8px 0 0' }}>The FoundKeep dashboard as it ships — every click is real, against the same demo backend as the live app.</p></Aside>
    <BrowserFrame device={device} src={src} dark={dark} url="foundkeep.app/dashboard" />
  </div>;
}

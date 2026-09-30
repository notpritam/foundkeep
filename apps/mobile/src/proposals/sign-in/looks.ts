// Proposal (sign-in, 2026-09-30): the three looks for the first screen. When
// Pritam picks one, it moves into the real screen and this folder is deleted.
import { Platform, type ViewStyle } from 'react-native';

export type LookName = 'sky' | 'meadow' | 'paper';
export type Look = {
  /** Full-screen background, as a CSS gradient. */
  background: string;
  /** Soft shapes behind the objects (clouds, glow), as CSS radial gradients. */
  haze: { x: number; y: number; w: number; h: number; color: string }[];
  ink: string; muted: string;
  /** Text under the buttons, where the backdrop is at its lightest. */
  bottomInk: string; bottomMuted: string;
  emblem: { fill: string; ring: string; glow: string };
  primary: { background: string; ink: string; border: string };
  secondary: { background: string; ink: string; border: string };
  statusBar: 'light' | 'dark';
};

export function look(name: LookName, scheme: 'light' | 'dark'): Look {
  if (name === 'sky') return {
    background: 'linear-gradient(180deg, #1678cc 0%, #248ddc 52%, #6cc0f1 76%, #d4f0fd 100%)',
    haze: [{ x: -0.1, y: 0.06, w: 0.7, h: 0.12, color: 'rgba(255,255,255,.75)' }, { x: 0.45, y: 0.22, w: 0.75, h: 0.14, color: 'rgba(255,255,255,.55)' }, { x: -0.2, y: 0.82, w: 0.9, h: 0.16, color: 'rgba(255,255,255,.8)' }, { x: 0.25, y: 0.35, w: 0.5, h: 0.3, color: 'rgba(255,255,255,.28)' }],
    ink: '#ffffff', muted: 'rgba(255,255,255,.82)', bottomInk: '#0b2e4a', bottomMuted: '#3b5a70',
    emblem: { fill: 'rgba(255,255,255,.22)', ring: 'rgba(255,255,255,.55)', glow: 'rgba(255,255,255,.7)' },
    primary: { background: '#0b0c0d', ink: '#ffffff', border: '#0b0c0d' },
    secondary: { background: '#ffffff', ink: '#202020', border: 'rgba(255,255,255,0)' },
    statusBar: 'light',
  };
  if (name === 'meadow') return {
    background: 'linear-gradient(180deg, #08563a 0%, #0d7a50 50%, #3fbf87 76%, #d6f3e4 100%)',
    haze: [{ x: 0.2, y: 0.3, w: 0.6, h: 0.32, color: 'rgba(214,243,228,.35)' }, { x: -0.25, y: 0.8, w: 1, h: 0.18, color: 'rgba(255,255,255,.45)' }, { x: 0.5, y: 0.02, w: 0.7, h: 0.12, color: 'rgba(191,238,214,.35)' }],
    ink: '#ffffff', muted: 'rgba(255,255,255,.84)', bottomInk: '#063a26', bottomMuted: '#2f5a47',
    emblem: { fill: 'rgba(255,255,255,.18)', ring: 'rgba(255,255,255,.5)', glow: 'rgba(191,238,214,.8)' },
    primary: { background: '#0b0c0d', ink: '#ffffff', border: '#0b0c0d' },
    secondary: { background: '#ffffff', ink: '#202020', border: 'rgba(255,255,255,0)' },
    statusBar: 'light',
  };
  const dark = scheme === 'dark';
  return {
    background: dark ? 'linear-gradient(180deg, #08090a 0%, #0f1011 60%, #0d1612 100%)' : 'linear-gradient(180deg, #fafafa 0%, #f4f6f4 60%, #e8f3ec 100%)',
    haze: [{ x: 0.15, y: 0.3, w: 0.7, h: 0.34, color: dark ? 'rgba(76,195,138,.16)' : 'rgba(13,122,80,.10)' }],
    ink: dark ? '#f7f8f8' : '#202020', muted: dark ? '#a5aab2' : '#686868', bottomInk: dark ? '#f7f8f8' : '#202020', bottomMuted: dark ? '#a5aab2' : '#686868',
    emblem: { fill: dark ? '#1a1c20' : '#ffffff', ring: dark ? '#34373d' : '#e4e4e4', glow: dark ? 'rgba(76,195,138,.35)' : 'rgba(13,122,80,.18)' },
    primary: { background: dark ? '#f7f8f8' : '#0b0c0d', ink: dark ? '#08090a' : '#ffffff', border: dark ? '#f7f8f8' : '#0b0c0d' },
    secondary: { background: dark ? '#1a1c20' : '#ffffff', ink: dark ? '#f7f8f8' : '#202020', border: dark ? '#34373d' : '#e4e4e4' },
    statusBar: dark ? 'light' : 'dark',
  };
}

/** A CSS gradient as a React Native style: web draws it as a background
 * image, iOS and Android (new architecture) through experimental_backgroundImage. */
export const gradient = (css: string): ViewStyle => (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;

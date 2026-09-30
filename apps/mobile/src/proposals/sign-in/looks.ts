// Proposal (sign-in, 2026-09-30): the two looks for the first screen (Pritam:
// "sky or meadow"). When he picks one it moves into the real screen and this
// folder is deleted.
import { Platform, type ViewStyle } from 'react-native';

export type LookName = 'sky' | 'meadow';
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

// Both looks are bright scenes in light and dark alike; the email sheet over
// them follows the theme.
export function look(name: LookName, _scheme: 'light' | 'dark'): Look {
  if (name === 'sky') return {
    background: 'linear-gradient(180deg, #0e5aa8 0%, #156dc0 48%, #1a78c8 72%, #6dbdf0 86%, #d4f0fd 100%)',
    haze: [{ x: -0.1, y: 0.06, w: 0.7, h: 0.12, color: 'rgba(255,255,255,.75)' }, { x: 0.45, y: 0.22, w: 0.75, h: 0.14, color: 'rgba(255,255,255,.55)' }, { x: -0.2, y: 0.82, w: 0.9, h: 0.16, color: 'rgba(255,255,255,.8)' }, { x: 0.25, y: 0.35, w: 0.5, h: 0.3, color: 'rgba(255,255,255,.28)' }],
    ink: '#ffffff', muted: 'rgba(255,255,255,.82)', bottomInk: '#0b2e4a', bottomMuted: '#3b5a70',
    emblem: { fill: 'rgba(255,255,255,.22)', ring: 'rgba(255,255,255,.55)', glow: 'rgba(255,255,255,.7)' },
    primary: { background: '#0b0c0d', ink: '#ffffff', border: '#0b0c0d' },
    secondary: { background: '#ffffff', ink: '#202020', border: 'rgba(255,255,255,0)' },
    statusBar: 'light',
  };
  return {
    background: 'linear-gradient(180deg, #07492f 0%, #0a6a44 48%, #0d7a50 72%, #4cc28c 86%, #d6f3e4 100%)',
    haze: [{ x: 0.2, y: 0.3, w: 0.6, h: 0.32, color: 'rgba(214,243,228,.35)' }, { x: -0.25, y: 0.8, w: 1, h: 0.18, color: 'rgba(255,255,255,.45)' }, { x: 0.5, y: 0.02, w: 0.7, h: 0.12, color: 'rgba(191,238,214,.35)' }],
    ink: '#ffffff', muted: 'rgba(255,255,255,.84)', bottomInk: '#063a26', bottomMuted: '#2f5a47',
    emblem: { fill: 'rgba(255,255,255,.18)', ring: 'rgba(255,255,255,.5)', glow: 'rgba(191,238,214,.8)' },
    primary: { background: '#0b0c0d', ink: '#ffffff', border: '#0b0c0d' },
    secondary: { background: '#ffffff', ink: '#202020', border: 'rgba(255,255,255,0)' },
    statusBar: 'light',
  };
}

/** A CSS gradient as a React Native style: web draws it as a background
 * image, iOS and Android (new architecture) through experimental_backgroundImage. */
export const gradient = (css: string): ViewStyle => (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;

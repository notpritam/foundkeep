// The Type toolbar on the app (simulator/brand-type.ts): text that sets no
// family of its own takes the pairing — the display face from 22pt up (screen
// and section titles), the text face below. Icon fonts set their own family.
import { createContext } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import type { Pairing } from '../../simulator/brand-type.ts';

/** The pairing chosen in the Type toolbar (preview.tsx), or null for the app as designed. */
export const BrandType = createContext<Pairing | null>(null);

export function brandText(style: StyleProp<TextStyle>, brand: Pairing | null): TextStyle | null {
  if (!brand) return null;
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return null;
  const size = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
  if (size < 22) return { fontFamily: brand.text.family };
  const d = brand.display;
  return { fontFamily: d.family, fontWeight: String(d.weight) as TextStyle['fontWeight'], fontStyle: 'normal', letterSpacing: +(d.tracking * size).toFixed(2) };
}

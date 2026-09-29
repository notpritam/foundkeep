// Dynamic Type for the web preview: the app's text scales by the simulator's
// text size, honouring each label's maxFontSizeMultiplier, as iOS does.
import { createContext } from 'react';
import { StyleSheet, type TextProps } from 'react-native';

export const TextScale = createContext(1);
export function scaledText(props: Pick<TextProps, 'style' | 'maxFontSizeMultiplier' | 'allowFontScaling'>, scale: number) {
  if (scale === 1 || props.allowFontScaling === false) return null;
  const flat = StyleSheet.flatten(props.style) || {};
  const cap = props.maxFontSizeMultiplier;
  const factor = cap && cap >= 1 ? Math.min(scale, cap) : scale;
  return { fontSize: (typeof flat.fontSize === 'number' ? flat.fontSize : 14) * factor, ...(typeof flat.lineHeight === 'number' ? { lineHeight: flat.lineHeight * factor } : {}) };
}

// Storybook stand-in for apps/mobile/src/components/AdaptiveText.tsx: the same
// Text, scaled by the simulator's text size (the web ignores fontScale), in
// the Type toolbar's pairing when one is chosen (brand-text.ts).
import { forwardRef, useContext } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { TextScale, scaledText } from '../../simulator/text-scale.ts';
import { BrandType, brandText } from './brand-text.ts';

export const AdaptiveText = forwardRef<NativeText, TextProps>(function AdaptiveText(props, ref) {
  const scale = useContext(TextScale), brand = useContext(BrandType);
  return <NativeText {...props} ref={ref} style={[props.style, brandText(props.style, brand), scaledText(props, scale)]} />;
});

// Storybook stand-in for apps/mobile/src/components/AdaptiveText.tsx: the same
// Text, scaled by the simulator's text size (the web ignores fontScale).
import { forwardRef, useContext } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { TextScale, scaledText } from '../../simulator/text-scale.ts';

export const AdaptiveText = forwardRef<NativeText, TextProps>(function AdaptiveText(props, ref) {
  const scale = useContext(TextScale);
  return <NativeText {...props} ref={ref} style={[props.style, scaledText(props, scale)]} />;
});

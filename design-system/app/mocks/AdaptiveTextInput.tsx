// Storybook stand-in for apps/mobile/src/components/AdaptiveTextInput.tsx:
// the same themed field, scaled by the simulator's text size.
import { forwardRef, useContext } from 'react';
import { TextInput as NativeTextInput, type TextInputProps } from 'react-native';
import { palettes } from '../../../apps/mobile/src/theme.ts';
import { useMaterial } from '../../../apps/mobile/src/components/ScenicSurface.tsx';
import { TextScale, scaledText } from '../../simulator/text-scale.ts';

export const AdaptiveTextInput = forwardRef<NativeTextInput, TextInputProps>(function AdaptiveTextInput(props, ref) {
  const { scheme } = useMaterial();
  const palette = palettes[scheme];
  const scale = useContext(TextScale);
  return <NativeTextInput {...props} ref={ref} style={[props.style, { color: palette.ink }, scaledText(props, scale)]}
    placeholderTextColor={palette.muted} selectionColor={palette.accent} cursorColor={palette.accent} />;
});

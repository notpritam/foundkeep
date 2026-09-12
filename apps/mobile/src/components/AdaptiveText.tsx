import { forwardRef } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { useMaterial } from './ScenicSurface.tsx';

/** Remeasure text when iOS changes Dynamic Type while the app stays mounted.
 * Remount only the native label, preserving forms, navigation, and drafts. */
export const AdaptiveText = forwardRef<NativeText, TextProps>(function AdaptiveText(props, ref) {
  const { fontScale } = useMaterial();
  return <NativeText key={fontScale} {...props} ref={ref} />;
});

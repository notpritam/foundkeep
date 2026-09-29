import type { Preview } from '@storybook/react-native-web-vite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider } from '../../../apps/mobile/src/appearance/AppearanceProvider.tsx';
import { MaterialProvider } from '../../../apps/mobile/src/components/ScenicSurface.tsx';
import { StorySession } from '../src/StoryApp.tsx';

const preview: Preview = {
  decorators: [Story => <SafeAreaProvider><AppearanceProvider><MaterialProvider><StorySession><Story /></StorySession></MaterialProvider></AppearanceProvider></SafeAreaProvider>],
  parameters: { layout: 'centered' },
};
export default preview;

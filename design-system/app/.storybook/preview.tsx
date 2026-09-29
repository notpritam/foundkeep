import type { Preview } from '@storybook/react-native-web-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider } from '../../../apps/mobile/src/appearance/AppearanceProvider.tsx';
import { MaterialProvider } from '../../../apps/mobile/src/components/ScenicSurface.tsx';
import { StorySession } from '../src/StoryApp.tsx';
import { appHandlers } from '../src/handlers.ts';

// The sample world answers every API and image request (src/handlers.ts).
initialize({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: './mockServiceWorker.js' } });

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [Story => <SafeAreaProvider><AppearanceProvider><MaterialProvider><StorySession><Story /></StorySession></MaterialProvider></AppearanceProvider></SafeAreaProvider>],
  parameters: { layout: 'centered', msw: { handlers: appHandlers } },
};
export default preview;

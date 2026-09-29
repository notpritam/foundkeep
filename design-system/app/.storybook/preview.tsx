import type { Decorator, Preview } from '@storybook/react-native-web-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AppearanceContext } from '../../../apps/mobile/src/appearance/AppearanceProvider.tsx';
import { MaterialProvider } from '../../../apps/mobile/src/components/ScenicSurface.tsx';
import { palettes } from '../../../apps/mobile/src/theme.ts';
import { StoryRoute } from '../mocks/expo-router.tsx';
import { StorySession } from '../src/StoryApp.tsx';
import { BillingProvider } from '../../../apps/mobile/src/billing/BillingProvider.tsx';
import { appHandlers } from '../src/handlers.ts';
import { APP_DEVICES, DEVICES, accessibilityGlobals, simulatorGlobals, textSizeGlobal } from '../../simulator/devices.ts';
import { PhoneFrame, innerUrl, isInner, listenForInnerErrors, relayErrorsToParent } from '../../simulator/Frame.tsx';
import { setMediaPreferences } from '../../simulator/media.ts';
import { TextScale } from '../../simulator/text-scale.ts';

// The sample world answers every API and image request (src/handlers.ts).
initialize({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: './mockServiceWorker.js' } });
relayErrorsToParent();
listenForInnerErrors();
if (isInner()) document.head.insertAdjacentHTML('beforeend', '<style>html,body,#storybook-root{height:100%;margin:0}body{padding:0!important;display:block!important}#storybook-root{display:flex;flex-direction:column}</style>');

const none = { top: 0, bottom: 0, left: 0, right: 0 };
/** Screens (parameters.simulator) render inside the device; components render as they are.
 * parameters.route = { pathname, params, header } is the route a screen sees; parameters.session
 * picks the sample session; parameters.msw.handlers.story overrides the sample world. */
const simulator: Decorator = (Story, { id, globals, parameters }) => {
  const device = DEVICES[globals.device] || DEVICES['iphone-17-pro'];
  const scheme = globals.theme === 'dark' ? 'dark' : 'light';
  if (parameters.simulator && !isInner()) return <PhoneFrame device={device} src={innerUrl(id, globals)} dark={scheme === 'dark'} keyboard={!!parameters.keyboard} />;
  setMediaPreferences({ reducedMotion: globals.motion === 'reduced', reducedTransparency: globals.transparency === 'reduced' });
  const insets = parameters.simulator ? device.insets : none;
  const palette = palettes[scheme];
  const story = parameters.route ? <StoryRoute route={parameters.route} colors={palette}><Story /></StoryRoute> : <Story />;
  return <SafeAreaInsetsContext.Provider value={insets}><SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width: device.width, height: device.height }}>
    <AppearanceContext.Provider value={{ preference: scheme, scheme, setPreference: async () => {} }}>
      <TextScale.Provider value={Number(globals.textSize) || 1}>
        <MaterialProvider key={`${globals.transparency}-${globals.motion}`}><StorySession mode={parameters.session}>{parameters.session === 'signed-out' ? story : <BillingProvider>{story}</BillingProvider>}</StorySession></MaterialProvider>
      </TextScale.Provider>
    </AppearanceContext.Provider>
  </SafeAreaFrameContext.Provider></SafeAreaInsetsContext.Provider>;
};

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [simulator],
  globalTypes: simulatorGlobals(APP_DEVICES, { ...textSizeGlobal, ...accessibilityGlobals }),
  initialGlobals: { device: 'iphone-17-pro', theme: 'light', textSize: '1', motion: 'full', transparency: 'full' },
  parameters: { options: { storySort: { order: ['Start here', 'Current', 'Proposals', 'Components', '*'] } }, layout: 'centered', msw: { handlers: { story: [], world: appHandlers } } },
};
export default preview;

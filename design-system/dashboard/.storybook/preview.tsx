import type { Decorator, Preview } from '@storybook/nextjs-vite';
import '../../../apps/site/app/global.css';
import '../../../apps/site/app/appearance.css';
import '../../../apps/site/app/interface.css';
import '../../../apps/site/app/customer.css';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { ThemeProvider } from '../../../apps/site/components/appearance/theme';
import { DEVICES, WEB_DEVICES, simulatorGlobals } from '../../simulator/devices.ts';
import { dashboardHandlers } from '../src/handlers.ts';
import { BrowserFrame, innerUrl, isInner, listenForInnerErrors, relayErrorsToParent } from '../../simulator/Frame.tsx';

// The sample world answers every /api request and private image (src/handlers.ts).
initialize({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: './mockServiceWorker.js' } });
relayErrorsToParent();
listenForInnerErrors();
if (isInner()) document.head.insertAdjacentHTML('beforeend', '<style>html,body,#storybook-root{min-height:100%;margin:0}body{padding:0!important;display:block!important}</style>');

/** Pages (parameters.simulator) render in a browser window of the chosen size; components render as they are. */
const simulator: Decorator = (Story, { id, globals, parameters }) => {
  const dark = globals.theme === 'dark', theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  // The dashboard's ThemeProvider reads the stored preference, so components
  // that ask useTheme() (Settings, the mind map, the header toggle) agree.
  try { localStorage.setItem('foundkeep.appearance', theme); } catch { /* storage unavailable */ }
  if (parameters.simulator && !isInner()) {
    const device = DEVICES[globals.device] || DEVICES.desktop;
    return <BrowserFrame device={device} src={innerUrl(id, globals)} dark={dark} url={parameters.url || 'foundkeep.app/dashboard'} />;
  }
  return <ThemeProvider key={theme}><Story /></ThemeProvider>;
};

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [simulator],
  globalTypes: simulatorGlobals(WEB_DEVICES),
  initialGlobals: { device: 'desktop', theme: 'light' },
  parameters: { options: { storySort: { order: ['Start here', 'Flow map', 'Live', 'Current', 'Proposals', 'Components', '*'] } }, layout: 'centered', nextjs: { appDirectory: true }, msw: { handlers: { story: [], world: dashboardHandlers } } },
};
export default preview;

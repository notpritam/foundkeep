import type { Decorator, Preview } from '@storybook/nextjs-vite';
import '../../../apps/site/app/global.css';
import '../../../apps/site/app/appearance.css';
import '../../../apps/site/app/interface.css';
import '../../../apps/site/app/customer.css';
import { DEVICES, WEB_DEVICES, simulatorGlobals } from '../../simulator/devices.ts';
import { BrowserFrame, innerUrl, isInner, listenForInnerErrors, relayErrorsToParent } from '../../simulator/Frame.tsx';

relayErrorsToParent();
listenForInnerErrors();
if (isInner()) document.head.insertAdjacentHTML('beforeend', '<style>html,body,#storybook-root{min-height:100%;margin:0}body{padding:0!important;display:block!important}</style>');

/** Pages (parameters.simulator) render in a browser window of the chosen size; components render as they are. */
const simulator: Decorator = (Story, { id, globals, parameters }) => {
  const dark = globals.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (parameters.simulator && !isInner()) {
    const device = DEVICES[globals.device] || DEVICES.desktop;
    return <BrowserFrame device={device} src={innerUrl(id, globals)} dark={dark} url={parameters.url || 'foundkeep.app/dashboard'} />;
  }
  return <Story />;
};

const preview: Preview = {
  decorators: [simulator],
  globalTypes: simulatorGlobals(WEB_DEVICES),
  initialGlobals: { device: 'desktop', theme: 'light' },
  parameters: { options: { storySort: { order: ['Start here', 'Current', 'Proposals', 'Components', '*'] } }, layout: 'centered', nextjs: { appDirectory: true } },
};
export default preview;

import './drafts-banner.css';
import { draftsBanner } from './drafts-banner.js';

export default {
  title: 'Web/Planned/Drafts banner',
  render: args => draftsBanner(args),
  args: { count: 3, failed: 1, signedOut: 1 },
  argTypes: { count: { control: { type: 'range', min: 1, max: 12 } }, failed: { control: { type: 'range', min: 0, max: 3 } }, signedOut: { control: { type: 'range', min: 0, max: 3 } } },
  parameters: { layout: 'padded', docs: { description: { component: 'Planned for the website (launch tracker P5.19): the banner above the library for saves still in the extension — waiting, failed or saved signed out — with **Sync now**. Chosen 2026-09-29; built when the dashboard moves onto the design system. Shown on a mock of the library.' } } },
};
export const ThreeWaiting = { name: 'Three saves waiting' };
export const OneWaiting = { name: 'One save waiting', args: { count: 1, failed: 0, signedOut: 0 } };

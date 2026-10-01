import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FlowMap, type Flow } from '../../simulator/flow-map.tsx';

// Every app flow in the order a person meets it. Proposals are added to a step
// (proposal: '<story id>') as each flow's variants land.
const flows: Flow[] = [
  { title: 'Sign in', steps: [{ label: 'Sign in', current: 'current-sign-in--sign-in-screen', proposal: 'proposals-sign-in--first-screen' }, { label: 'Create an account', current: 'current-sign-in--create-account' }, { label: 'Save your recovery code', current: 'current-sign-in--save-recovery-code' }, { label: 'Recover an account', current: 'current-sign-in--recover-account' }, { label: 'Apple or Google failed', current: 'current-sign-in--apple-or-google-failed' }] },
  { title: 'First run', steps: [{ label: 'Save from anywhere', current: 'current-onboarding--save-from-anywhere' }] },
  { title: 'Library', steps: [{ label: 'Library', current: 'current-library--library' }, { label: 'Loading', current: 'current-library--loading' }, { label: 'Empty', current: 'current-library--empty' }, { label: 'Could not load', current: 'current-library--could-not-load' }] },
  { title: 'Save detail', note: 'Opened from a card in the Library.', steps: [
    { label: 'Page', current: 'current-save-detail--bookmark' }, { label: 'Region screenshot', current: 'current-save-detail--region-screenshot' }, { label: 'Full page', current: 'current-save-detail--full-page' },
    { label: 'Image', current: 'current-save-detail--image' }, { label: 'Post on X', current: 'current-save-detail--post-on-x' }, { label: 'Highlight', current: 'current-save-detail--highlight' },
    { label: 'Note', current: 'current-save-detail--note' }, { label: 'Document', current: 'current-save-detail--document' }, { label: 'Audio', current: 'current-save-detail--audio' },
    { label: 'Video', current: 'current-save-detail--video' }, { label: 'Still preparing', current: 'current-save-detail--processing' }, { label: 'Could not be read', current: 'current-save-detail--failed' }, { label: 'Saved together', current: 'current-save-detail--batch' }] },
  { title: 'Saving', note: 'The iOS share sheet is native and is designed as stand-ins when its flow comes up.', steps: [{ label: 'New note', current: 'current-saving--new-note-screen' }] },
  { title: 'You and plans', steps: [{ label: 'You', current: 'current-you--you' }, { label: 'You, on Pro', current: 'current-you--you-on-pro' }, { label: 'Your plan (Free)', current: 'current-you--plan-free' }, { label: 'Your plan (Pro)', current: 'current-you--plan-pro' }] },
  { title: 'Links', steps: [{ label: 'Opening a FoundKeep link', current: 'current-links--open-from-the-web' }] },
];

const meta: Meta = { title: 'Flow map', tags: ['expected-http-errors'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Every app screen in flow order. Current is today; Proposal fills in flow by flow.' } } } };
export default meta;
export const App: StoryObj = { name: 'Flow map', render: (_, { globals }) => <FlowMap flows={flows} base="/app/" width={402} height={874} globals={`device:iphone-17-pro;theme:${globals.theme || 'light'}`} /> };

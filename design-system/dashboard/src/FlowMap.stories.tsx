import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FlowMap, type Flow } from '../../simulator/flow-map.tsx';

// Every dashboard flow in the order a person meets it. Proposals are added to a
// step (proposal: '<story id>') as each flow's variants land.
const flows: Flow[] = [
  { title: 'Sign in', steps: [{ label: 'Log in', current: 'current-sign-in--log-in' }, { label: 'Sign up', current: 'current-sign-in--sign-up' }, { label: 'Recover an account', current: 'current-sign-in--recover' }, { label: 'Apple or Google return', current: 'current-sign-in--o-auth-return' }] },
  { title: 'Library', steps: [{ label: 'Library', current: 'current-library--library' }, { label: 'Empty', current: 'current-library--empty' }, { label: 'A save open over it', current: 'current-library--save-open' }] },
  { title: 'Save detail (full page)', steps: [{ label: 'Page', current: 'current-save-detail--page' }, { label: 'Screenshot', current: 'current-save-detail--screenshot' }, { label: 'Post on X', current: 'current-save-detail--post' }, { label: 'Highlight', current: 'current-save-detail--highlight' }, { label: 'Note', current: 'current-save-detail--note' }, { label: 'Document', current: 'current-save-detail--document' }] },
  { title: 'Collections', note: 'Public discovery (/collections) joins when its flow is proposed.', steps: [{ label: 'Your collections', current: 'current-account-pages--your-collections' }, { label: 'One collection', current: 'current-account-pages--one-collection' }, { label: 'Public collection page', current: 'current-public--collection-page' }] },
  { title: 'Explore', steps: [{ label: 'Mind map', current: 'current-account-pages--mind-map-page' }, { label: 'Agents', current: 'current-account-pages--agents-page' }] },
  { title: 'Account', steps: [{ label: 'Apps & devices', current: 'current-account-pages--apps-and-devices' }, { label: 'Plans (Free)', current: 'current-account-pages--plans-free' }, { label: 'Plans (Pro)', current: 'current-account-pages--plans-pro' }, { label: 'Settings', current: 'current-account-pages--account-settings' }, { label: 'Capture settings', current: 'current-account-pages--capture-settings' }, { label: 'Processing settings', current: 'current-account-pages--processing-settings' }] },
];

const meta: Meta = { title: 'Flow map', tags: ['expected-http-errors'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Every dashboard page in flow order. Current is today; Proposal fills in flow by flow.' } } } };
export default meta;
export const Dashboard: StoryObj = { name: 'Flow map', render: (_, { globals }) => <FlowMap flows={flows} base="/dashboard/" width={1440} height={900} globals={`device:desktop;theme:${globals.theme || 'light'}`} /> };

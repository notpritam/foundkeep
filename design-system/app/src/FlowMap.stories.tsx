import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FlowMap, type Flow } from '../../simulator/flow-map.tsx';

// Every app flow in the order a person meets it, as decided (Final), or as the app is today where it
// isn't designed yet. A step's proposal is a variation tried beside it (Tried).
const flows: Flow[] = [
  { title: 'Sign in', steps: [{ label: 'Sign in', current: 'final-1-sign-in--sign-in-screen', proposal: 'tried-sign-in--with-film' }, { label: "Apple and Google can't be reached", current: 'final-1-sign-in--providers-unavailable' }, { label: 'After Continue with Google', current: 'final-1-sign-in--handoff', proposal: 'tried-sign-in-handoff--gather' }, { label: 'Sign-in couldn’t be verified', current: 'final-1-sign-in--apple-or-google-failed' }, { label: 'Save your recovery code', current: 'final-1-sign-in--save-recovery-code' }] },
  { title: 'First run', steps: [{ label: 'Save from any app', current: 'final-2-first-run--save-from-anywhere', proposal: 'tried-first-run--watch' }] },
  { title: 'Home', note: 'The final design; the app still shows the Library as it is today (In the app today).', steps: [{ label: 'Home', current: 'final-3-home-search-and-ask-kit--library', proposal: 'tried-home-and-ask-kit--home-greeting' }, { label: 'In the app today', current: 'in-the-app-today-library--with-scroll-edge' }, { label: 'Loading', current: 'in-the-app-today-library--loading' }, { label: 'Empty', current: 'in-the-app-today-library--empty' }, { label: 'Could not load', current: 'in-the-app-today-library--could-not-load' }] },
  { title: 'Search', steps: [{ label: 'Search', current: 'final-3-home-search-and-ask-kit--search' }, { label: 'Search for a word', current: 'final-3-home-search-and-ask-kit--search-word' }] },
  { title: 'Ask Kit', steps: [{ label: 'Ask Kit', current: 'final-3-home-search-and-ask-kit--kit' }, { label: 'One question', current: 'final-3-home-search-and-ask-kit--question' }, { label: 'A follow-up', current: 'final-3-home-search-and-ask-kit--follow-up', proposal: 'tried-home-and-ask-kit--kit-list' }] },
  { title: 'Save detail', note: 'Opened from a card. Next to design — today’s screens.', steps: [
    { label: 'Page', current: 'in-the-app-today-save-detail--bookmark' }, { label: 'Region screenshot', current: 'in-the-app-today-save-detail--region-screenshot' }, { label: 'Full page', current: 'in-the-app-today-save-detail--full-page' },
    { label: 'Image', current: 'in-the-app-today-save-detail--image' }, { label: 'Post on X', current: 'in-the-app-today-save-detail--post-on-x' }, { label: 'Highlight', current: 'in-the-app-today-save-detail--highlight' },
    { label: 'Note', current: 'in-the-app-today-save-detail--note' }, { label: 'Document', current: 'in-the-app-today-save-detail--document' }, { label: 'Audio', current: 'in-the-app-today-save-detail--audio' },
    { label: 'Video', current: 'in-the-app-today-save-detail--video' }, { label: 'Still preparing', current: 'in-the-app-today-save-detail--processing' }, { label: 'Could not be read', current: 'in-the-app-today-save-detail--failed' }, { label: 'Saved together', current: 'in-the-app-today-save-detail--batch' }] },
  { title: 'Saving', note: 'The iOS share sheet is native and is designed as stand-ins when its flow comes up.', steps: [{ label: 'New note', current: 'in-the-app-today-saving--new-note-screen' }] },
  { title: 'You and plans', steps: [{ label: 'You', current: 'in-the-app-today-you--you' }, { label: 'You, on Pro', current: 'in-the-app-today-you--you-on-pro' }, { label: 'Your plan (Free)', current: 'in-the-app-today-you--plan-free' }, { label: 'Your plan (Pro)', current: 'in-the-app-today-you--plan-pro' }] },
  { title: 'Links', steps: [{ label: 'Opening a FoundKeep link', current: 'in-the-app-today-links--open-from-the-web' }] },
];

const meta: Meta = { title: 'Flow map', tags: ['expected-http-errors'], parameters: { layout: 'fullscreen', docs: { description: { component: 'Every app screen in flow order: the final design, or the app today where a flow isn’t designed yet; beside it, a variation that was tried.' } } } };
export default meta;
export const App: StoryObj = { name: 'Flow map', render: (_, { globals }) => <FlowMap flows={flows} base="/app/" width={402} height={874} globals={`device:iphone-17-pro;theme:${globals.theme || 'light'}`} /> };

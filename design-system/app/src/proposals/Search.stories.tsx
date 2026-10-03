import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DockProvider } from '../../../../apps/mobile/src/components/FloatingDock.tsx';
import { SearchProposal, type SearchLook, type SearchState } from '../../../../apps/mobile/src/proposals/search/Search.tsx';

// Search, recent folders and tags, and Kit (proposal, 2026-10-03): one field — searching is asking Kit —
// in four places, each in three states (the Library, a word, a question), on today's Library and its locked card. The board
// (Search and Kit / Four ways) switches every phone between the states at once.
type Args = { state: SearchState };
const meta: Meta<Args> = {
  title: 'Proposals/Search and Kit',
  parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/collection', params: {} } },
  args: { state: 'library' },
  argTypes: { state: { options: ['library', 'word', 'question'] } },
};
export default meta;
type Story = StoryObj<Args>;
// Remounted when the state changes, so each state opens as it would.
const look = (name: SearchLook): Story['render'] => args => <DockProvider><SearchProposal key={args.state} look={name} state={args.state} /></DockProvider>;
export const DockSearch: Story = { name: 'Search beside + in the dock', render: look('dock') };
export const AskBar: Story = { name: 'Search or ask Kit, above the dock', render: look('bar') };
export const SearchTab: Story = { name: 'Search as a tab in the dock', render: look('tab') };
export const SearchFirst: Story = { name: 'Search heading the Library', render: look('top') };

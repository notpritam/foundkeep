import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SearchAndKit, type LockedState } from '../../../../apps/mobile/src/proposals/kit/Locked.tsx';

// Search and Ask Kit, locked 2026-10-03 (Pritam): the magnifier on top opens Search, its field at the
// bottom; Kit's orb beside + opens Ask Kit, a conversation with one short line per answer. Every
// state, to look at and refine one by one. The tried versions: Proposals/Ask Kit, Proposals/Search and Kit.
const meta: Meta = { title: 'Final/3 Home, search and Ask Kit', parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/collection', params: {} } } };
export default meta;
type Story = StoryObj;
const at = (state: LockedState): Story => ({ render: () => <SearchAndKit state={state} /> });
export const Library: Story = { name: 'The Library', ...at('library') };
export const Search: Story = { name: 'Search, just opened', ...at('search') };
export const SearchWord: Story = { name: 'Search for a word', ...at('word') };
export const Kit: Story = { name: 'Ask Kit, just opened', ...at('kit') };
export const Question: Story = { name: 'Ask Kit, one question', ...at('question') };
export const FollowUp: Story = { name: 'Ask Kit, a follow-up', ...at('followup') };

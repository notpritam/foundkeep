import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { LibraryProposal, type LibraryLook } from '../../../../apps/mobile/src/proposals/library/Library.tsx';
import { StoryTabs } from '../StoryTabs.tsx';

// The Library (proposal, 2026-10-02): four layouts, each a real screen on the
// sample world with the app's dock. Side by side: Library / Four ways on the page.
const meta: Meta = { title: 'Proposals/Library', parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/collection', params: {} } } };
export default meta;
type Story = StoryObj;
const look = (name: LibraryLook): Story['render'] => () => <StoryTabs active="collection"><LibraryProposal look={name} /></StoryTabs>;
export const Cards: Story = { name: 'Cards', render: look('cards') };
export const Grid: Story = { name: 'Grid, like Photos', render: look('grid') };
export const Shelves: Story = { name: 'Shelves by kind', render: look('shelves') };
export const List: Story = { name: 'List', render: look('list') };

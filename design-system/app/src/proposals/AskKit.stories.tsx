import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DockProvider } from '../../../../apps/mobile/src/components/FloatingDock.tsx';
import { KitProposal, type KitEntry, type KitLook, type KitState } from '../../../../apps/mobile/src/proposals/kit/Kit.tsx';

// Ask Kit (proposal, 2026-10-03): search from the magnifier on top; Kit beside + in the dock (its logo,
// or "Ask Kit"), opening at the bottom — four ways to hold the conversation, in five states: the
// Library, searching, Kit just opened, one question, a follow-up. Board:
// Ask Kit / Four conversations switches every phone at once. You can type and tap in any of them.
type Args = { state: KitState; entry: KitEntry };
const meta: Meta<Args> = {
  title: 'Tried/Ask Kit',
  parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/collection', params: {} } },
  args: { state: 'followup', entry: 'orb' },
  argTypes: { state: { options: ['library', 'search', 'open', 'first', 'followup'] }, entry: { options: ['orb', 'pill'] } },
};
export default meta;
type Story = StoryObj<Args>;
const look = (name: KitLook): Story['render'] => args => <DockProvider><KitProposal key={args.state} look={name} state={args.state} entry={args.entry} /></DockProvider>;
export const Chat: Story = { name: 'A conversation (picked)', render: look('chat') };
export const Grid: Story = { name: 'Answers laid out like the Library', render: look('grid') };
export const Half: Story = { name: 'A half sheet; the Library is the answer', render: look('half') };
export const Trail: Story = { name: 'What Kit understood, as chips', render: look('trail') };

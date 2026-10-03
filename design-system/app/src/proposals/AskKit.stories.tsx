import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DockProvider } from '../../../../apps/mobile/src/components/FloatingDock.tsx';
import { KitProposal, type KitLook, type KitState } from '../../../../apps/mobile/src/proposals/kit/Kit.tsx';

// Ask Kit (proposal, 2026-10-03): the bar above the dock, opening at the bottom — four ways to
// hold a conversation, each in three states: just opened, one question, a follow-up. Board:
// Ask Kit / Four conversations switches every phone at once. You can type and tap in any of them.
type Args = { state: KitState };
const meta: Meta<Args> = {
  title: 'Proposals/Ask Kit',
  parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/collection', params: {} } },
  args: { state: 'followup' },
  argTypes: { state: { options: ['open', 'first', 'followup'] } },
};
export default meta;
type Story = StoryObj<Args>;
const look = (name: KitLook): Story['render'] => args => <DockProvider><KitProposal key={args.state} look={name} state={args.state} /></DockProvider>;
export const Chat: Story = { name: 'A conversation', render: look('chat') };
export const Grid: Story = { name: 'Answers laid out like the Library', render: look('grid') };
export const Half: Story = { name: 'A half sheet; the Library is the answer', render: look('half') };
export const Trail: Story = { name: 'What Kit understood, as chips', render: look('trail') };

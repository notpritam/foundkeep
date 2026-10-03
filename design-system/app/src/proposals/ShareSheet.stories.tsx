import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ShareSheetProposal, type ShareKind, type ShareLook, type ShareState } from '../../../../apps/mobile/src/proposals/share/ShareSheet.tsx';

// Sharing into FoundKeep from another app (2026-10-03): three cleaner shapes. Today's sheet, drawn
// after the iPhone share extension: In the app today/Share sheet. Board: Open/Share sheet.
type Args = { kind: ShareKind; state: ShareState };
const meta: Meta<Args> = {
  title: 'Open/Share sheet',
  args: { kind: 'reel', state: 'ready' },
  argTypes: {
    kind: { options: ['reel', 'youtube', 'post', 'page', 'photos', 'text'], control: { type: 'select' } },
    state: { options: ['ready', 'saving', 'saved', 'offline', 'connect'], control: { type: 'select' } },
  },
  parameters: { simulator: true, layout: 'fullscreen', route: { pathname: '/share', params: {} } },
};
export default meta;
type Story = StoryObj<Args>;
const look = (name: string, value: ShareLook): Story => ({ name, render: ({ kind, state }) => <ShareSheetProposal look={value} kind={kind} state={state} /> });
export const Card = look('One card, one button', 'card');
export const Instant = look('Saved the moment you share', 'instant');
export const NoteFirst = look('Note first, the iPhone’s own pattern', 'note');

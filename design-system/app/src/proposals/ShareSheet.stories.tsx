import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ShareSheetProposal, type ShareKind, type ShareLook, type ShareState } from '../../../../apps/mobile/src/proposals/share/ShareSheet.tsx';

// Sharing into FoundKeep from another app (2026-10-03): cleaner shapes — one card, one button picked
// as the direction, three more like it, each while typing too. Today's sheet, drawn
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
const look = (name: string, value: ShareLook, typing = false): Story => ({ name, render: ({ kind, state }) => <ShareSheetProposal look={value} kind={kind} state={state} typing={typing} />, ...(typing ? { parameters: { keyboard: true } } : {}) });
// The direction (Pritam, 2026-10-03: "one card, one button is good"), and three more like it —
// each also while you type a note, the keyboard up.
export const Card = look('One card, one button', 'card');
export const CardTyping = look('One card · typing a note', 'card', true);
export const Composer = look('Composer: the note and Save as one bar', 'composer');
export const ComposerTyping = look('Composer · typing a note', 'composer', true);
export const Library = look('The Library’s card, folders one tap away', 'library');
export const LibraryTyping = look('Library card · typing a note', 'library', true);
export const Bar = look('A bar on the keyboard: Folder and Save', 'bar');
export const BarTyping = look('Keyboard bar · typing a note', 'bar', true);
// Set aside.
export const Instant = look('Saved the moment you share', 'instant');
export const NoteFirst = look('Note first, the iPhone’s own pattern', 'note');

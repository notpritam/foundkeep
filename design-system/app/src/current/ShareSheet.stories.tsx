import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ShareSheetProposal, type ShareKind, type ShareState } from '../../../../apps/mobile/src/proposals/share/ShareSheet.tsx';

// Today's share sheet — the iPhone share extension (share-extension/ShareViewController.swift),
// drawn in React Native for comparison, since the native sheet can't run here. The cleaner shapes:
// Open/Share sheet.
type Args = { kind: ShareKind; state: ShareState };
const meta: Meta<Args> = {
  title: 'In the app today/Share sheet',
  args: { kind: 'reel', state: 'ready' },
  argTypes: {
    kind: { options: ['reel', 'youtube', 'post', 'page', 'photos', 'text'], control: { type: 'select' } },
    state: { options: ['ready', 'saving', 'saved', 'offline', 'connect'], control: { type: 'select' } },
  },
  parameters: { simulator: true, layout: 'fullscreen', route: { pathname: '/share', params: {} } },
};
export default meta;
export const ShareSheet: StoryObj<Args> = { name: 'Share sheet (drawn after the native one)', render: ({ kind, state }) => <ShareSheetProposal look="today" kind={kind} state={state} /> };

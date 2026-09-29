import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { GalleryCard } from '../../../apps/mobile/src/components/GalleryCard.tsx';
import type { Capture } from '../../../apps/mobile/src/api/types.ts';

const now = Date.parse('2026-09-29T09:00:00Z');
const bookmark = { id: 'bookmark', clientId: 'story', batchId: null, type: 'bookmark', status: 'done', sourceTitle: 'The half-life of a good idea',
  sourceUrl: 'https://themargin.example/half-life', summary: 'Most of what we read is gone within a week.', selectionText: null, noteText: null,
  articleText: null, ocrText: null, category: null, tags: [], userTags: ['Memory'], folder: { id: 'f-reading', name: 'Reading list' },
  blobUrl: null, fileName: null, fileMime: null, fileBytes: 0, fileUrl: null, width: null, height: null, capturedAt: now, createdAt: now, updatedAt: now,
  enrichError: null, provenance: { siteName: 'The Margin', captureMethod: 'extension' } } as unknown as Capture;

const meta: Meta<typeof GalleryCard> = {
  title: 'App/Proof/Gallery card',
  component: GalleryCard,
  args: { capture: bookmark, onOpen: () => {} },
  decorators: [Story => <View style={{ width: 180 }}><Story /></View>],
};
export default meta;
export const Bookmark: StoryObj<typeof GalleryCard> = {};

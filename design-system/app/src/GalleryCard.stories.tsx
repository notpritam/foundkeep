import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { GalleryCard } from '../../../apps/mobile/src/components/GalleryCard.tsx';
import { saves } from '../../fixtures/world.ts';

const meta: Meta<typeof GalleryCard> = {
  title: 'Proof/Gallery card',
  component: GalleryCard,
  args: { capture: saves.bookmark, onOpen: () => {} },
  decorators: [Story => <View style={{ width: 180 }}><Story /></View>],
};
export default meta;
export const Bookmark: StoryObj<typeof GalleryCard> = {};
export const Screenshot: StoryObj<typeof GalleryCard> = { args: { capture: saves.region } };

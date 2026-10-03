import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { JumpBackIn, type PlaceFilter } from '../../../../apps/mobile/src/components/JumpBackIn.tsx';
import { recentPlaces } from '../../../../apps/mobile/src/collection/places.ts';
import { library } from '../../../fixtures/world.ts';

// Jump back in, locked 2026-10-03 (Pritam): the folders saves went into as cards with their last
// saves, then the tags as chips — worked out from the sample library. Tap to choose; again to clear.
const meta: Meta = { title: 'Current/Jump back in', parameters: { layout: 'fullscreen', controls: { disable: true } } };
export default meta;
type Story = StoryObj;
function Live({ start = null }: { start?: PlaceFilter }) {
  const [selected, setSelected] = useState<PlaceFilter>(start);
  return <View style={{ paddingVertical: 24 }}><JumpBackIn places={recentPlaces(library)} selected={selected} onChoose={setSelected} /></View>;
}
export const JumpBack: Story = { name: 'Jump back in', render: () => <Live /> };
export const FolderChosen: Story = { name: 'A folder chosen', render: () => <Live start={{ kind: 'folder', id: 'f-kitchen', name: 'Kitchen' }} /> };
export const TagChosen: Story = { name: 'A tag chosen', render: () => <Live start={{ kind: 'tag', id: 'Cooking', name: 'Cooking' }} /> };

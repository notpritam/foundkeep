import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import CollectionScreen from '../../../../apps/mobile/src/app/(app)/(tabs)/collection.tsx';
import { StoryTabs } from '../StoryTabs.tsx';

const meta: Meta = {
  title: 'Current/Library',
  parameters: { simulator: true, layout: 'fullscreen', docs: { description: { component: 'Today’s Library tab, on the sample world.' } } },
};
export default meta;
export const Library: StoryObj = { render: () => <StoryTabs active="collection"><CollectionScreen /></StoryTabs> };

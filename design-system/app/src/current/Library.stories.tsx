import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { http, HttpResponse } from 'msw';
import CollectionScreen, { CollectionScreen as Collection } from '../../../../apps/mobile/src/app/(app)/(tabs)/collection.tsx';
import { StoryTabs } from '../StoryTabs.tsx';

const meta: Meta = {
  title: 'Current/Library',
  parameters: { simulator: true, layout: 'fullscreen', route: { pathname: '/collection', params: {} }, docs: { description: { component: 'Today’s Library tab, on the sample world.' } } },
  render: () => <StoryTabs active="collection"><CollectionScreen /></StoryTabs>,
};
export default meta;
type Story = StoryObj;
export const Library: Story = {};
// Today's screen with the scroll edge (2026-10-02, Pritam's reference): the list runs under a see-through
// top bar and the dock, blurring as it passes. Not in the app until picked.
export const WithScrollEdge: Story = { name: 'Library, with the scroll edge', render: () => <StoryTabs active="collection"><Collection scrollEdge /></StoryTabs> };
export const Empty: Story = { name: 'Empty library', parameters: { msw: { handlers: { story: [http.get('*/api/mobile/captures', () => HttpResponse.json({ captures: [], nextCursor: null, total: 0 }))] } } } };
export const Loading: Story = { name: 'Loading', parameters: { msw: { handlers: { story: [http.get('*/api/mobile/captures', () => new Promise<Response>(() => {}))] } } } };
export const CouldNotLoad: Story = { name: 'Could not load', tags: ['expected-http-errors'], parameters: { msw: { handlers: { story: [http.get('*/api/mobile/captures', () => HttpResponse.json({ error: 'unavailable', message: 'Your collection could not load.' }, { status: 503 }))] } } } };

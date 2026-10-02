import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { GalleryCard } from '../../../../apps/mobile/src/components/GalleryCard.tsx';
import { saves } from '../../../fixtures/world.ts';

// The Library's card, locked 2026-10-03 (Pritam): today's style, concise — icons, no tags — with
// a glass caption. One story for each kind of save, so each can be looked at and refined on its
// own later; all of them side by side: Proposals/Cards › Every kind of save.
const meta: Meta = { title: 'Current/Library card', parameters: { layout: 'centered', controls: { disable: true } } };
export default meta;
type Story = StoryObj;
const card = (key: keyof typeof saves): Story => ({ render: () => <View style={{ width: 178 }}><GalleryCard capture={saves[key]} onOpen={() => {}} /></View> });
export const LinkWithPicture: Story = { name: 'Link, with a picture', ...card('recipe') };
export const Article: Story = { name: 'Article', ...card('bookmark') };
export const Product: Story = { name: 'Product', ...card('product') };
export const LinkBeingRead: Story = { name: 'Link, still being read', ...card('processing') };
export const LinkFailed: Story = { name: 'Link that couldn’t be read', ...card('failed') };
export const PostWithPhoto: Story = { name: 'Post on X, with a photo', ...card('photoPost') };
export const Post: Story = { name: 'Post on X', ...card('post') };
export const Reel: Story = { name: 'Reel (Instagram)', ...card('reel') };
export const Short: Story = { name: 'Short (YouTube)', ...card('short') };
export const TikTok: Story = { name: 'Video (TikTok)', ...card('ridge') };
export const YouTube: Story = { name: 'Video (YouTube)', ...card('video') };
export const Pin: Story = { name: 'Pin (Pinterest)', ...card('pin') };
export const Photo: Story = { name: 'Photo from the iPhone', ...card('desk') };
export const InstagramPost: Story = { name: 'Post on Instagram', ...card('poster') };
export const Region: Story = { name: 'Screenshot of a region', ...card('region') };
export const FullPage: Story = { name: 'Full-page screenshot', ...card('fullpage') };
export const Highlight: Story = { name: 'Highlight', ...card('highlight') };
export const Note: Story = { name: 'Note', ...card('note') };
export const PDF: Story = { name: 'PDF', ...card('document') };
export const VoiceMemo: Story = { name: 'Voice memo', ...card('audio') };
export const SavedTogether: Story = { name: 'Saved together', ...card('batchA') };

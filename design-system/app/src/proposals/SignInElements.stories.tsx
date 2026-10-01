import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { FirstScreen as Screen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';

// The floating elements on the locked first screen (2026-10-01). Pritam chose
// GPT-6 Astra as the only family: all 30 of its objects are here to pick from
// (assets/images/elements, prompts in PROMPTS.md), with the ways they could move.
const GROUPS: { title: string; note: string | null; items: { name: string; source: ImageSourcePropType }[] }[] = [
  { title: 'On the screen now', note: 'What you come across while browsing, and your agent. In “spotlight”, each lifts forward when the headline says its word.', items: [
    { name: 'Reel', source: require('../../../../apps/mobile/assets/images/elements/reel.webp') },
    { name: 'Tweet', source: require('../../../../apps/mobile/assets/images/elements/tweet.webp') },
    { name: 'Photo post', source: require('../../../../apps/mobile/assets/images/elements/photo-post.webp') },
    { name: 'Agent orb', source: require('../../../../apps/mobile/assets/images/elements/agent-orb.webp') },
    { name: 'Article', source: require('../../../../apps/mobile/assets/images/elements/article.webp') },
    { name: 'Short', source: require('../../../../apps/mobile/assets/images/elements/short.webp') },
    { name: 'Thread', source: require('../../../../apps/mobile/assets/images/elements/thread.webp') },
    { name: 'Agent reply', source: require('../../../../apps/mobile/assets/images/elements/agent-reply.webp') },
  ] },
  { title: 'More you come across', note: null, items: [
    { name: 'Recipe', source: require('../../../../apps/mobile/assets/images/elements/recipe.webp') },
    { name: 'Podcast', source: require('../../../../apps/mobile/assets/images/elements/podcast.webp') },
    { name: 'Map pin', source: require('../../../../apps/mobile/assets/images/elements/map-pin.webp') },
    { name: 'Product', source: require('../../../../apps/mobile/assets/images/elements/product.webp') },
    { name: 'Ticket', source: require('../../../../apps/mobile/assets/images/elements/ticket.webp') },
    { name: 'Sticky note', source: require('../../../../apps/mobile/assets/images/elements/sticky-note.webp') },
    { name: 'Photo', source: require('../../../../apps/mobile/assets/images/elements/photo.webp') },
    { name: 'Video', source: require('../../../../apps/mobile/assets/images/elements/video.webp') },
    { name: 'Webpage', source: require('../../../../apps/mobile/assets/images/elements/webpage.webp') },
  ] },
  { title: 'Keeping and finding', note: null, items: [
    { name: 'Link', source: require('../../../../apps/mobile/assets/images/elements/link.webp') },
    { name: 'Bookmark', source: require('../../../../apps/mobile/assets/images/elements/bookmark.webp') },
    { name: 'Heart', source: require('../../../../apps/mobile/assets/images/elements/heart.webp') },
    { name: 'Comment', source: require('../../../../apps/mobile/assets/images/elements/comment.webp') },
    { name: 'Browser', source: require('../../../../apps/mobile/assets/images/elements/browser.webp') },
    { name: 'Cursor', source: require('../../../../apps/mobile/assets/images/elements/cursor.webp') },
    { name: 'Folder', source: require('../../../../apps/mobile/assets/images/elements/folder.webp') },
    { name: 'Collection', source: require('../../../../apps/mobile/assets/images/elements/collection.webp') },
    { name: 'Highlight', source: require('../../../../apps/mobile/assets/images/elements/highlight.webp') },
    { name: 'Voice memo', source: require('../../../../apps/mobile/assets/images/elements/voice.webp') },
  ] },
  { title: 'Your agent', note: null, items: [
    { name: 'Command', source: require('../../../../apps/mobile/assets/images/elements/command.webp') },
    { name: 'Connector', source: require('../../../../apps/mobile/assets/images/elements/connector.webp') },
    { name: 'Search with sparkle', source: require('../../../../apps/mobile/assets/images/elements/search-sparkle.webp') },
  ] },
];

function Gallery() {
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Elements</Text>
    <Text style={styles.intro}>All 30 GPT-6 Astra objects, on the sky they float over. Pick the ones you want around “Keep Every”; the rest go.</Text>
    {GROUPS.map(group => <View key={group.title} style={styles.group}>
      <Text style={styles.family}>{group.title}</Text>
      {group.note ? <Text style={styles.note}>{group.note}</Text> : null}
      <View style={styles.grid}>{group.items.map(item => <View key={item.name} style={styles.tile}>
        <View style={styles.sky}><Image source={item.source} style={styles.img} accessibilityLabel={item.name} /></View>
        <Text style={styles.name}>{item.name}</Text>
      </View>)}</View>
    </View>)}
  </ScrollView>;
}

const meta: Meta = { title: 'Proposals/Sign-in elements', parameters: { controls: { disable: true } } };
export default meta;
type Story = StoryObj;
const onScreen = { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} } };
export const Candidates: Story = { name: 'All elements', render: () => <Gallery />, parameters: { layout: 'fullscreen' } };
export const MoveDrift: Story = { name: 'Movement · drift (today)', render: () => <Screen movement="drift" />, parameters: onScreen };
export const MoveSpotlight: Story = { name: 'Movement · spotlight on the word', render: () => <Screen movement="spotlight" />, parameters: onScreen };
export const MoveOrbit: Story = { name: 'Movement · orbit', render: () => <Screen movement="orbit" />, parameters: onScreen };
export const MoveBob: Story = { name: 'Movement · bob and sway', render: () => <Screen movement="bob" />, parameters: onScreen };
export const MoveRise: Story = { name: 'Movement · rise like bubbles', render: () => <Screen movement="rise" />, parameters: onScreen };

const styles = StyleSheet.create({
  page: { padding: 32, gap: 8, maxWidth: 1200 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: '#202020' },
  intro: { fontSize: 15, lineHeight: 22, color: '#5c5c5c', maxWidth: 640 },
  group: { marginTop: 24, gap: 6 },
  family: { fontSize: 19, fontWeight: '600', color: '#202020' },
  note: { fontSize: 14, color: '#686868', marginBottom: 6, maxWidth: 640 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  tile: { width: 150, gap: 8 },
  sky: { width: 150, height: 150, borderRadius: 18, backgroundColor: '#2f86d6', alignItems: 'center', justifyContent: 'center' },
  img: { width: 100, height: 100, resizeMode: 'contain' },
  name: { fontSize: 14, fontWeight: '500', color: '#202020' },
});

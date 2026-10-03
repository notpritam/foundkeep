import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CollectionScreen as Collection } from '../../../../apps/mobile/src/app/(app)/(tabs)/collection.tsx';
import { GalleryCard } from '../../../../apps/mobile/src/components/GalleryCard.tsx';
import type { SaveCardComponent } from '../../../../apps/mobile/src/components/GalleryList.tsx';
import { usePalette } from '../../../../apps/mobile/src/proposals/library/parts.tsx';
import { MarkedCard, PillsCard, QuietCard } from '../../../../apps/mobile/src/proposals/cards/SaveCards.tsx';
import { ConciseCard, IconsCard } from '../../../../apps/mobile/src/proposals/cards/TodayCards.tsx';
import { BeforeCard } from '../../../../apps/mobile/src/proposals/cards/BeforeCard.tsx';
import { GlassEverywhereCard } from '../../../../apps/mobile/src/proposals/cards/GlassEverywhereCard.tsx';
import { saves } from '../../../fixtures/world.ts';
import { StoryTabs } from '../StoryTabs.tsx';

// The Library's cards for every kind of save (2026-10-02). Pritam picked today's style, made
// concise — icons, no tags — with a glass caption: now the app's GalleryCard. Beside it the card
// it replaced, the concise proposal as picked, the icons arrangement, and the three clean ones
// first proposed (quiet, with pills, marked), kept for the log. Each kind side by
// side, and each inside today's Library. Board: Library / Cards for every kind of save.
const meta: Meta = { title: 'Tried/Cards', parameters: { controls: { disable: true } } };
export default meta;
type Story = StoryObj;

const KINDS: [string, keyof typeof saves][] = [
  ['Link, with a picture', 'recipe'], ['Article', 'bookmark'], ['Product', 'product'], ['Link, still being read', 'processing'], ['Link that couldn’t be read', 'failed'],
  ['Post on X, with a photo', 'photoPost'], ['Post on X', 'post'], ['Reel (Instagram)', 'reel'], ['Short (YouTube)', 'short'], ['Video (TikTok)', 'ridge'], ['Video (YouTube)', 'video'],
  ['Pin (Pinterest)', 'pin'], ['Photo from the iPhone', 'desk'], ['Post on Instagram', 'poster'], ['Screenshot of a region', 'region'], ['Full-page screenshot', 'fullpage'],
  ['Highlight', 'highlight'], ['Note', 'note'], ['PDF', 'document'], ['Voice memo', 'audio'], ['Saved together', 'batchA'],
];
const COLUMNS: [string, SaveCardComponent][] = [['Before', BeforeCard], ['In the app: concise, glass caption', GalleryCard], ['Glass everywhere (tried)', GlassEverywhereCard], ['Concise (picked)', ConciseCard], ['Icons', IconsCard], ['Quiet', QuietCard], ['With pills', PillsCard], ['Marked', MarkedCard]];
const open = () => {};

function Kinds() {
  const P = usePalette();
  return <ScrollView style={{ backgroundColor: P.paper }} contentContainerStyle={styles.page}>
    <View style={styles.row}><View style={styles.label} />{COLUMNS.map(([name]) => <Text key={name} style={[styles.column, styles.head, { color: P.ink }]}>{name}</Text>)}</View>
    {KINDS.map(([kind, key]) => <View key={key} style={[styles.row, { borderTopColor: P.line }]}>
      <Text style={[styles.label, { color: P.muted }]}>{kind}</Text>
      {COLUMNS.map(([name, Card]) => <View key={name} style={styles.column}><Card capture={saves[key]} onOpen={open} /></View>)}
    </View>)}
  </ScrollView>;
}
export const EveryKind: Story = { name: 'Every kind of save', render: () => <Kinds />, parameters: { layout: 'fullscreen' } };
const inLibrary = (Card: SaveCardComponent): Story => ({ render: () => <StoryTabs active="collection"><Collection scrollEdge card={Card} /></StoryTabs>, parameters: { simulator: true, layout: 'fullscreen', route: { pathname: '/collection', params: {} } } });
export const InLibraryBefore: Story = { name: 'In the Library · before', ...inLibrary(BeforeCard) };
export const InLibraryConcise: Story = { name: 'In the Library · today, concise (picked)', ...inLibrary(ConciseCard) };
export const InLibraryIcons: Story = { name: 'In the Library · today, icons', ...inLibrary(IconsCard) };
export const InLibraryQuiet: Story = { name: 'In the Library · quiet', ...inLibrary(QuietCard) };
export const InLibraryPills: Story = { name: 'In the Library · with pills', ...inLibrary(PillsCard) };
export const InLibraryMarked: Story = { name: 'In the Library · marked', ...inLibrary(MarkedCard) };

const styles = StyleSheet.create({
  page: { padding: 24, gap: 0 },
  row: { flexDirection: 'row', gap: 24, alignItems: 'flex-start', paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  label: { width: 150, fontSize: 14, lineHeight: 19, paddingTop: 6 },
  column: { width: 178 },
  head: { fontSize: 15, fontWeight: '700' },
});

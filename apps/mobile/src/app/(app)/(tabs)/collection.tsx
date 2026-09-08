import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { CaptureType } from '../../../api/types.ts';
import { Brand, Message, Screen } from '../../../components/ui.tsx';
import { OrganizationPicker, type OrganizationChoice } from '../../../components/OrganizationPicker.tsx';
import { GalleryList } from '../../../components/GalleryList.tsx';
import { useCollection } from '../../../collection/useCollection.ts';
import { useSession } from '../../../session/SessionProvider.tsx';
import { colors } from '../../../theme.ts';

const filters: Array<{ type?: CaptureType; label: string }> = [
  { label: 'All' }, { type: 'bookmark', label: 'Links' }, { type: 'image', label: 'Images' }, { type: 'note', label: 'Notes' },
  { type: 'document', label: 'Documents' }, { type: 'selection', label: 'Highlights' }, { type: 'screenshot', label: 'Screenshots' },
  { type: 'audio', label: 'Audio' }, { type: 'video', label: 'Video' }, { type: 'tweet', label: 'Posts' }, { type: 'file', label: 'Files' },
];
export default function CollectionScreen() {
  const { policy, updateRequired } = useSession();
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [type, setType] = useState<CaptureType>();
  const [organization, setOrganization] = useState<OrganizationChoice>({ folderId: undefined, userTags: [] });
  const [searching, setSearching] = useState(false);
  const { height, fontScale } = useWindowDimensions();
  useEffect(() => { const timer = setTimeout(() => setSearchQuery(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const collection = useCollection({ q: searchQuery || undefined, type, folderId: organization.folderId === null ? 'unfiled' : organization.folderId, tag: organization.userTags[0] });
  const canWrite = policy.capture.note && !updateRequired;
  return <Screen>
    {/* Outside the list: header, search and filters stay anchored during scrolling. */}
    <View testID="collection-header" style={styles.header}>
      <View style={styles.top}><Brand compact /><Pressable accessibilityRole="button" accessibilityLabel="Write a new note" accessibilityState={{ disabled: !canWrite }} disabled={!canWrite} onPress={() => router.push('/(app)/new-note')} style={({ pressed }) => [styles.add, pressed && { opacity: .7 }, !canWrite && { opacity: .4 }]}><Ionicons name="add" size={25} color={colors.ink} /></Pressable></View>
      {!searching && height > 550 && fontScale < 1.8 ? <View style={styles.heading}><Text style={styles.title}>All your finds.</Text><Text style={styles.subtitle}>A little of everything you love.</Text></View> : null}
      {updateRequired ? <Message error>Update Foundkeep in the App Store to keep saving.</Message> : <Message>{policy.notice}</Message>}
      <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput testID="collection-search" value={query} onChangeText={setQuery} onFocus={() => setSearching(true)} onBlur={() => setSearching(false)} maxLength={200} accessibilityLabel="Search saved items" placeholder="Search your collection" placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" /></View>
      <OrganizationPicker value={organization} onChange={setOrganization} filter />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
        {filters.map(filter => <Pressable key={filter.label} accessibilityRole="button" accessibilityState={{ selected: type === filter.type }} onPress={() => setType(filter.type)} style={({ pressed }) => [styles.filter, type === filter.type && styles.filterActive, pressed && { opacity: .7 }]}><Text style={[styles.filterText, type === filter.type && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}
      </ScrollView>
    </View>
    <GalleryList collection={collection} filtered={Boolean(searchQuery || type || organization.folderId !== undefined || organization.userTags.length)} />
  </Screen>;
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10, gap: 10, backgroundColor: colors.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paleMoss },
  heading: { gap: 5, paddingTop: 2, paddingBottom: 2 }, title: { color: colors.ink, fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -.9 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  search: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface }, searchInput: { flex: 1, minHeight: 44, color: colors.ink, fontSize: 16, paddingVertical: 8 },
  filters: { gap: 8 }, filter: { paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, filterActive: { backgroundColor: colors.ink, borderColor: colors.ink }, filterText: { color: colors.muted, fontSize: 13, fontWeight: '600' }, filterTextActive: { color: colors.paper },
});

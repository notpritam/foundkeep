import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View, type ListRenderItemInfo } from 'react-native';
import type { Capture } from '../api/types.ts';
import { galleryColumns } from '../collection/preview.ts';
import { useCollection } from '../collection/useCollection.ts';
import { MotionBoundary } from './motion.tsx';
import { GalleryCard } from './GalleryCard.tsx';
import { GallerySkeleton } from './Shimmer.tsx';
import { Button, Message } from './ui.tsx';
import { colors, typography } from '../theme.ts';

export function GalleryList({ collection, filtered = false }: { collection: ReturnType<typeof useCollection>; filtered?: boolean }) {
  const { width, height, fontScale } = useWindowDimensions();
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [viewportHeight, setViewportHeight] = useState(height / 2);
  const [footerVisible, setFooterVisible] = useState(false);
  const viewability = useRef(({ viewableItems }: { viewableItems: Array<{ item: Capture }> }) => setVisibleIds(new Set(viewableItems.map(item => item.item.id)))).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;
  const columns = galleryColumns(width, fontScale);
  const { captures, loading, refreshing, loadingMore, total, error, refresh, loadMore } = collection;
  const open = useCallback((capture: Capture) => router.push({ pathname: '/(app)/capture/[id]', params: { id: capture.id } }), []);
  const renderItem = useCallback(({ item }: ListRenderItemInfo<Capture>) => <View style={{ width: columns === 1 ? '100%' : '48.5%' }}><MotionBoundary enabled={visibleIds.has(item.id)}><GalleryCard capture={item} onOpen={open} /></MotionBoundary></View>, [columns, open, visibleIds]);
  return <FlatList
    key={columns} testID="gallery-list" data={captures} numColumns={columns} keyExtractor={item => item.id} renderItem={renderItem}
    style={styles.list} contentContainerStyle={[styles.content, !captures.length && { flexGrow: 1 }]}
    columnWrapperStyle={columns === 2 ? styles.row : undefined} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
    onViewableItemsChanged={viewability} viewabilityConfig={viewabilityConfig}
    onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; setFooterVisible(contentOffset.y + layoutMeasurement.height > contentSize.height - 320); }} scrollEventThrottle={100}
    keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
    initialNumToRender={8} maxToRenderPerBatch={6} windowSize={7}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.moss} />}
    onEndReached={() => { if (!error && !loading) void loadMore(); }} onEndReachedThreshold={.35}
    ListHeaderComponent={captures.length && error ? <View style={styles.error}><Message error>{error}</Message><Button secondary label="Try again" onPress={() => void refresh()} /></View> : null}
    ListFooterComponent={loadingMore ? <View style={{ paddingTop: 12 }}><MotionBoundary enabled={footerVisible}><GallerySkeleton columns={columns} viewportHeight={200} /></MotionBoundary></View> : captures.length ? <Text style={styles.count}>{captures.length < total ? `${captures.length} of ${total} finds` : `${total} ${total === 1 ? 'find' : 'finds'} · yours to keep`}</Text> : null}
    ListEmptyComponent={loading ? <GallerySkeleton columns={columns} viewportHeight={viewportHeight} /> : error ? <View style={styles.empty}><Text style={typography.heading}>Couldn’t open your collection.</Text><Message error>{error}</Message><Button label="Try again" onPress={() => void refresh()} /></View> : <View style={styles.empty}>
      <Text style={[typography.title, { textAlign: 'center' }]}>{filtered ? 'No finds this time.' : 'A home for your good finds.'}</Text>
      <Text style={[typography.body, styles.emptyCopy]}>{filtered ? 'Try another word or choose All.' : 'Share a link, a photo, or a passing thought. Find it all here.'}</Text>
      {!filtered ? <Button secondary label="See how to save" onPress={() => router.push('/(app)/onboarding')} /> : null}
    </View>}
  />;
}
const styles = StyleSheet.create({ list: { flex: 1 }, content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 }, row: { justifyContent: 'space-between', alignItems: 'flex-start' }, error: { gap: 10, paddingBottom: 16 }, empty: { flex: 1, paddingVertical: 40, paddingHorizontal: 16, gap: 18, alignItems: 'center', justifyContent: 'center' }, emptyCopy: { color: colors.muted, textAlign: 'center', maxWidth: 300 }, count: { ...typography.small, textAlign: 'center', paddingVertical: 24 } });

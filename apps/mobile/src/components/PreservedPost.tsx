import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, StyleSheet, View } from 'react-native';
import { AdaptiveIcon as Ionicons } from './AdaptiveIcon.tsx';
import { AdaptiveText as Text } from './AdaptiveText.tsx';
import { FrostedPanel } from './ScenicSurface.tsx';
import { preservedAssetSource } from '../collection/preview.ts';
import { useSession } from '../session/SessionProvider.tsx';
import { useThemedStyles } from '../appearance/AppearanceProvider.tsx';
import { colors, typography } from '../theme.ts';
import type { Preservation, PreservationAsset } from '../api/types.ts';

const KB = 1024, MB = 1024 * 1024;
const readableBytes = (value: number) => value < KB ? `${value} B` : value < MB ? `${(value / KB).toFixed(1)} KB` : `${(value / MB).toFixed(1)} MB`;
const WORKING = new Set(['pending', 'running']);

const HEADINGS: Record<string, string> = { post: 'Saved post', article: 'Linked article', transcript: 'Video subtitles and description' };

/** Shows the server-kept copy of a social post — its text, photos, video and
 * linked article — beneath the capture's own note and summary. Polls while the
 * copy is still being made. Renders nothing until there is something to show. */
export function PreservedPost({ id, revision }: { id: string; revision: number }) {
  const styles = useThemedStyles(baseStyles);
  const { client, token, account } = useSession();
  const [saved, setSaved] = useState<Preservation | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const working = useRef(false);
  working.current = !!saved && WORKING.has(saved.status);

  useEffect(() => {
    let live = true;
    const load = async (reload = false) => {
      try {
        const value = await client.getPreservation(id, reload ? { reload: true } : {});
        if (live) setSaved(value.preservation);
      } catch { /* a transient read leaves the last known state in place; the poll and foreground listener recover it */ }
    };
    void load();
    // Retry until a copy is loaded, then only while it is still being made, so a
    // dropped first request cannot leave the panel permanently empty.
    const poll = setInterval(() => { if (AppState.currentState === 'active' && (!saved || working.current)) void load(true); }, 4_000);
    const appState = AppState.addEventListener('change', state => { if (state === 'active' && (!saved || working.current)) void load(true); });
    return () => { live = false; clearInterval(poll); appState.remove(); };
  }, [client, id, account?.id, token, saved]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try { const value = await client.retryPreservation(id); setSaved(value.preservation); }
    catch { /* keep the current view; the note already explains the gap */ }
    finally { setRetrying(false); }
  }, [client, id]);

  const openAsset = useCallback(async (asset: PreservationAsset) => {
    const owned = preservedAssetSource(id, asset.id, token, account?.id, revision);
    if (!owned) return;
    setOpening(asset.id); setAssetError(null);
    try {
      const target = `${FileSystem.cacheDirectory}${asset.id}-${asset.title.replace(/[^\w.-]+/g, '_').slice(0, 80)}`;
      const result = await FileSystem.downloadAsync(`${owned.uri}&download=1`, target, { headers: owned.headers });
      if (result.status !== 200) throw new Error('download failed');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: asset.mime || undefined, dialogTitle: asset.title });
    } catch { setAssetError('That video could not be saved. Check your connection and try again.'); }
    finally { setOpening(null); }
  }, [id, token, account?.id, revision]);

  if (!saved) return null;
  const images = saved.assets.filter(a => a.kind === 'image');
  const videos = saved.assets.filter(a => a.kind === 'video');
  const texts = saved.assets.filter(a => a.text && ['post', 'article', 'transcript'].includes(a.kind));
  const hasContent = images.length + videos.length + texts.length > 0;

  return (
    <FrostedPanel style={styles.panel}>
      <View style={styles.header}>
        <Ionicons name="bookmark-outline" size={18} color={colors.accent} />
        <Text style={typography.heading}>Saved copy</Text>
        {working.current ? <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 'auto' }} /> : null}
      </View>

      {working.current && !hasContent ? <Text style={typography.small}>Keeping a copy of this post…</Text> : null}

      {texts.map(asset => (
        <View key={asset.id} style={styles.block}>
          <Text style={typography.label}>{HEADINGS[asset.kind] ?? 'Saved text'}</Text>
          <Text selectable style={styles.body}>{asset.text}</Text>
        </View>
      ))}

      {images.map(asset => {
        const source = preservedAssetSource(id, asset.id, token, account?.id, revision);
        return source ? <Image key={asset.id} source={source} style={styles.image} resizeMode="contain" accessibilityLabel={asset.title} accessible /> : null;
      })}

      {videos.map(asset => (
        <Pressable key={asset.id} accessibilityRole="button" accessibilityLabel={`Save video ${asset.title}`} onPress={() => void openAsset(asset)} style={styles.file}>
          <Ionicons name="videocam-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}><Text style={styles.fileName}>{asset.title}</Text><Text style={typography.small}>Video · {readableBytes(asset.bytes)}</Text></View>
          {opening === asset.id ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="share-outline" size={20} color={colors.muted} />}
        </Pressable>
      ))}

      {assetError ? <Text style={styles.note}>{assetError}</Text> : null}
      {saved.error ? <Text style={styles.note}>{saved.error}</Text> : null}
      {['partial', 'failed'].includes(saved.status) ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Try keeping this post again" onPress={() => void retry()} disabled={retrying} style={styles.retry}>
          {retrying ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.retryText}>Try again</Text>}
        </Pressable>
      ) : null}
    </FrostedPanel>
  );
}

const baseStyles = StyleSheet.create({
  panel: { gap: 12, padding: 16, borderRadius: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  block: { gap: 4 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: colors.accentSoft },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  fileName: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.accentSoft },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});

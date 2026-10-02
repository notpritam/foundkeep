// What the first-run film shows inside its window, drawn at a phone's size
// (375 × 600) and scaled down: a post in an X-style timeline app, a reel in a
// Reels-style app, the iOS 26 share sheet (Liquid Glass, inset from the
// edges, apps in a row with More at the end, favourite actions as round
// icons), its Apps list, and FoundKeep's own save sheet in the app's current
// design. Generic look-alikes — no other company's logo or name — with the
// film's generated photographs, never anyone's real saves.
import { Animated, Image, Platform, StyleSheet, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';

export const SCREEN = { width: 375, height: 600 };
const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });
const backgroundImage = (css: string) => (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
const glass = (Platform.OS === 'web' ? { backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)' } : {}) as ViewStyle;
export const FILM_PHOTOS = { kyoto: require('../../assets/images/film/kyoto.jpg'), ramen: require('../../assets/images/film/ramen.jpg') };
const ICON = require('../../assets/images/icon.png');

// ——— An X-style post ———

/** Where things are in XPost, in its own units. */
export const X_AT = { share: { x: 347, y: 498 }, photo: { x: 16, y: 170, width: 343, height: 262 } };
export function XPost({ photo }: { photo: ImageSourcePropType }) {
  return <View style={x.screen}>
    <View style={x.bar}><Ionicons name="arrow-back" size={22} color="#0f1419" /><Text style={x.barTitle}>Post</Text><View style={{ width: 22 }} /></View>
    <View style={x.head}>
      <View style={x.avatar}><Text style={x.avatarText}>ST</Text></View>
      <View style={x.names}><Text style={x.name}>Slow Travels</Text><Text style={x.handle}>@slowtravels</Text></View>
      <View style={x.follow}><Text style={x.followText}>Follow</Text></View>
    </View>
    <Text style={x.text}>Two days in Kyoto. The best part was getting lost in Gion after dark.</Text>
    <Image source={photo} style={x.photo} accessible={false} />
    <Text style={x.meta}>9:41 PM · Oct 1, 2026 · <Text style={x.metaStrong}>48.2K</Text> Views</Text>
    <View style={x.rule} />
    <View style={x.actions}>
      <Action icon="chatbubble-outline" count="86" /><Action icon="repeat" count="1.2K" /><Action icon="heart-outline" count="8.4K" /><Action icon="bookmark-outline" count="312" />
      <Ionicons name="share-outline" size={20} color="#536471" />
    </View>
  </View>;
}
function Action({ icon, count }: { icon: string; count: string }) {
  return <View style={x.action}><Ionicons name={icon as 'repeat'} size={19} color="#536471" /><Text style={x.count}>{count}</Text></View>;
}

// ——— A reel ———

export const REEL_AT = { share: { x: 346, y: 378 } };
export function Reel({ photo, zoom }: { photo: ImageSourcePropType; zoom?: ViewStyle['transform'] }) {
  return <View style={r.screen}>
    <View style={[StyleSheet.absoluteFill, { transform: zoom }]}><Image source={photo} style={r.photo} accessible={false} /></View>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, backgroundImage('linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6) 100%)')]} />
    <View style={r.top}><Text style={r.title}>Reels</Text><Ionicons name="camera-outline" size={24} color="#fff" /></View>
    <View style={r.rail}>
      <RailItem icon="heart-outline" label="24.1K" /><RailItem icon="chatbubble-outline" label="312" /><RailItem icon="paper-plane-outline" label="1,840" /><RailItem icon="ellipsis-horizontal" />
      <Image source={photo} style={r.audioThumb} accessible={false} />
    </View>
    <View style={r.bottom}>
      <View style={r.who}><View style={r.avatar} /><Text style={r.handle}>noodle.diaries</Text><View style={r.follow}><Text style={r.followText}>Follow</Text></View></View>
      <Text style={r.caption} numberOfLines={2}>Ten-minute ramen, one pot. Saving this one for tonight.</Text>
      <View style={r.audio}><Ionicons name="musical-notes" size={12} color="#fff" /><Text style={r.audioText}>noodle.diaries · Original audio</Text></View>
    </View>
  </View>;
}
function RailItem({ icon, label }: { icon: string; label?: string }) {
  return <View style={r.railItem}><Ionicons name={icon as 'heart-outline'} size={28} color="#fff" />{label ? <Text style={r.railLabel}>{label}</Text> : null}</View>;
}

// ——— The iOS 26 share sheet ———

export type AppKind = 'messages' | 'mail' | 'notes' | 'reminders' | 'foundkeep' | 'more';
const APPS: Record<AppKind, { label: string; color: string; icon?: string; ink?: string }> = {
  messages: { label: 'Messages', color: '#34c759', icon: 'chatbubble' }, mail: { label: 'Mail', color: '#1e88ff', icon: 'mail' },
  notes: { label: 'Notes', color: '#ffd60a', icon: 'document-text', ink: '#5b4a00' }, reminders: { label: 'Reminders', color: '#ff9f0a', icon: 'list' },
  foundkeep: { label: 'FoundKeep', color: '#181a18' }, more: { label: 'More', color: 'rgba(120,120,128,0.16)', icon: 'ellipsis-horizontal', ink: '#3a3a3c' },
};
export function AppIcon({ kind, size = 60 }: { kind: AppKind; size?: number }) {
  const app = APPS[kind];
  return <View style={[s.icon, { width: size, height: size, borderRadius: size * 0.225, backgroundColor: app.color }]}>
    {kind === 'foundkeep' ? <Image source={ICON} style={{ width: size, height: size }} accessible={false} /> : <Ionicons name={app.icon as 'mail'} size={size * 0.48} color={app.ink ?? '#fff'} />}
  </View>;
}
export const SHEET = { inset: 8, height: 318, head: 72, cell: 78, rowTop: 72 + 14 };
/** The centre of the app at `index` in the row (before it slides), in the sheet's units from its top-left. */
export const sheetAppAt = (index: number) => ({ x: 14 + SHEET.cell * (index + 0.5), y: SHEET.rowTop + 30 });
export function ShareSheetHead({ photo, title, source }: { photo: ImageSourcePropType; title: string; source: string }) {
  return <View style={s.head}>
    <Image source={photo} style={s.thumb} accessible={false} />
    <View style={s.headWords}><Text style={s.headTitle} numberOfLines={1}>{title}</Text><Text style={s.headSource} numberOfLines={1}>{source}</Text></View>
    <View style={s.close}><Ionicons name="close" size={17} color="#3a3a3c" /></View>
  </View>;
}
/** lift: raises FoundKeep's icon, as a finger comes down on it. */
export function AppRow({ apps, lift }: { apps: AppKind[]; lift?: Animated.AnimatedInterpolation<number> }) {
  return <View style={s.row}>{apps.map((kind, i) => <Animated.View key={i} style={[s.cell, kind === 'foundkeep' && lift ? { transform: [{ scale: lift }] } : null]}><AppIcon kind={kind} /><Text style={s.appName} numberOfLines={1}>{APPS[kind].label}</Text></Animated.View>)}</View>;
}
export function FavouriteActions() {
  return <View style={s.actions}>
    {[['copy-outline', 'Copy'], ['glasses-outline', 'Reading List'], ['book-outline', 'Bookmark'], ['search-outline', 'Find']].map(([icon, label]) => <View key={label} style={s.actionCell}>
      <View style={s.actionIcon}><Ionicons name={icon as 'copy-outline'} size={20} color="#1d1d1f" /></View><Text style={s.actionLabel}>{label}</Text>
    </View>)}
  </View>;
}
/** The sheet's frame: Liquid Glass, inset from the screen's edges. */
export function GlassSheet({ height, children, opaque = false }: { height: number; children: React.ReactNode; opaque?: boolean }) {
  return <View style={[s.sheet, { height }, opaque ? s.opaque : glass]}>{children}</View>;
}

/** More: the Apps list (the sheet grows and turns opaque), where tapping an app shares to it. */
export const APPS_LIST = { height: 392, rowTop: 64, row: 54 };
export function AppsList({ apps }: { apps: AppKind[] }) {
  return <>
    <View style={s.listBar}><Text style={s.listEdit}>Edit</Text><Text style={s.listTitle}>Apps</Text><Text style={s.listDone}>Done</Text></View>
    <View style={s.list}>{apps.map(kind => <View key={kind} style={s.listRow}><AppIcon kind={kind} size={34} /><Text style={s.listName}>{APPS[kind].label}</Text></View>)}</View>
  </>;
}

// ——— FoundKeep's save sheet ———

/** "Save to FoundKeep", as the share extension shows it, in the current card design:
 * the item, a note, folder and tag pills, Save. */
export const SAVE = { height: 330, thumb: { x: 18 + 30, y: 64 + 30 }, save: { x: 359 - 18 - 48, y: 330 - 18 - 22 } };
export function SaveSheet({ photo, title, source, folder, tag }: { photo: ImageSourcePropType; title: string; source: string; folder: string; tag: string }) {
  return <View style={f.sheet}>
    <View style={f.top}><Image source={ICON} style={f.mark} accessible={false} /><Text style={f.title}>Save to FoundKeep</Text><View style={f.close}><Ionicons name="close" size={16} color="#6e6e73" /></View></View>
    <View style={f.item}><Image source={photo} style={f.thumb} accessible={false} /><View style={f.itemWords}><Text style={f.itemTitle} numberOfLines={2}>{title}</Text><Text style={f.itemSource}>{source}</Text></View></View>
    <Text style={f.note}>Add a note…</Text>
    <View style={f.pills}>
      <View style={f.pill}><Ionicons name="folder-outline" size={14} color="#1d1d1f" /><Text style={f.pillText}>{folder}</Text><Ionicons name="chevron-down" size={12} color="#6e6e73" /></View>
      <View style={[f.pill, f.tag]}><Text style={[f.pillText, f.tagText]}>{tag}</Text><Ionicons name="close" size={12} color="#0d7a50" /></View>
      <View style={[f.pill, f.dashed]}><Ionicons name="add" size={14} color="#6e6e73" /><Text style={[f.pillText, { color: '#6e6e73' }]}>Tag</Text></View>
    </View>
    <View style={f.foot}><Text style={f.cancel}>Cancel</Text><View style={f.save}><Text style={f.saveText}>Save</Text></View></View>
  </View>;
}

/** A save, as one of the floating cards from sign-in: a white card with its photo. */
export function SavedCard({ photo, size = 92 }: { photo: ImageSourcePropType; size?: number }) {
  return <View style={[c.card, { width: size, padding: size * 0.07, borderRadius: size * 0.17 }]}>
    <Image source={photo} style={{ width: size * 0.86, height: size * 0.66, borderRadius: size * 0.11 }} accessible={false} />
    <View style={[c.line, { width: size * 0.62, marginTop: size * 0.07 }]} /><View style={[c.line, { width: size * 0.4, opacity: 0.6 }]} />
  </View>;
}

const x = StyleSheet.create({
  screen: { width: SCREEN.width, height: SCREEN.height, backgroundColor: '#ffffff' },
  bar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eff3f4' },
  barTitle: { fontFamily: SF, fontSize: 17, fontWeight: '700', color: '#0f1419' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2f6f5e', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: SF, fontSize: 15, fontWeight: '700', color: '#ffffff' },
  names: { flex: 1 },
  name: { fontFamily: SF, fontSize: 15.5, fontWeight: '700', color: '#0f1419' },
  handle: { fontFamily: SF, fontSize: 15, color: '#536471' },
  follow: { height: 32, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#0f1419', justifyContent: 'center' },
  followText: { fontFamily: SF, fontSize: 14.5, fontWeight: '700', color: '#ffffff' },
  text: { fontFamily: SF, fontSize: 17, lineHeight: 23, color: '#0f1419', paddingHorizontal: 16, paddingTop: 12 },
  photo: { width: X_AT.photo.width, height: X_AT.photo.height, borderRadius: 16, marginLeft: 16, marginTop: 12 },
  meta: { fontFamily: SF, fontSize: 14.5, color: '#536471', paddingHorizontal: 16, paddingTop: 12 },
  metaStrong: { fontWeight: '700', color: '#0f1419' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#eff3f4', marginHorizontal: 16, marginTop: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 46 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontFamily: SF, fontSize: 13, color: '#536471' },
});
const r = StyleSheet.create({
  screen: { width: SCREEN.width, height: SCREEN.height, backgroundColor: '#000', overflow: 'hidden' },
  photo: { width: SCREEN.width, height: SCREEN.height, resizeMode: 'cover' },
  top: { position: 'absolute', left: 16, right: 16, top: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: SF, fontSize: 22, fontWeight: '700', color: '#ffffff' },
  rail: { position: 'absolute', right: 12, top: 236, alignItems: 'center', gap: 18 },
  railItem: { alignItems: 'center', gap: 3 },
  railLabel: { fontFamily: SF, fontSize: 12.5, fontWeight: '600', color: '#ffffff' },
  audioThumb: { width: 30, height: 30, borderRadius: 7, borderWidth: 2, borderColor: '#ffffff' },
  bottom: { position: 'absolute', left: 14, right: 70, bottom: 18, gap: 8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f2a65a', borderWidth: 1.5, borderColor: '#ffffff' },
  handle: { fontFamily: SF, fontSize: 14, fontWeight: '700', color: '#ffffff' },
  follow: { height: 26, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', justifyContent: 'center' },
  followText: { fontFamily: SF, fontSize: 13, fontWeight: '600', color: '#ffffff' },
  caption: { fontFamily: SF, fontSize: 14, lineHeight: 19, color: '#ffffff' },
  audio: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audioText: { fontFamily: SF, fontSize: 12.5, color: '#ffffff' },
});
const s = StyleSheet.create({
  sheet: { position: 'absolute', left: SHEET.inset, right: SHEET.inset, bottom: SHEET.inset, borderRadius: 38, overflow: 'hidden', backgroundColor: 'rgba(246,246,248,0.95)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } },
  opaque: { backgroundColor: '#f2f2f7' },
  head: { height: SHEET.head, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8 },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  headWords: { flex: 1 },
  headTitle: { fontFamily: SF, fontSize: 15, fontWeight: '600', color: '#1d1d1f' },
  headSource: { fontFamily: SF, fontSize: 13, color: '#6e6e73', marginTop: 1 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(120,120,128,0.16)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 14 },
  cell: { width: SHEET.cell, alignItems: 'center', gap: 6 },
  icon: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  appName: { fontFamily: SF, fontSize: 11.5, color: '#1d1d1f', maxWidth: 74 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10, paddingTop: 22 },
  actionCell: { alignItems: 'center', gap: 6, width: 78 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: SF, fontSize: 11.5, color: '#1d1d1f' },
  listBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 },
  listEdit: { fontFamily: SF, fontSize: 16, color: '#007aff' },
  listTitle: { fontFamily: SF, fontSize: 17, fontWeight: '600', color: '#1d1d1f' },
  listDone: { fontFamily: SF, fontSize: 16, fontWeight: '600', color: '#007aff' },
  list: { marginHorizontal: 14, marginTop: 8, borderRadius: 14, backgroundColor: '#ffffff', overflow: 'hidden' },
  listRow: { height: APPS_LIST.row, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.18)' },
  listName: { fontFamily: SF, fontSize: 16, color: '#1d1d1f' },
});
const f = StyleSheet.create({
  sheet: { position: 'absolute', left: 8, right: 8, bottom: 8, height: SAVE.height, borderRadius: 34, backgroundColor: '#ffffff', paddingHorizontal: 18, paddingTop: 14,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } },
  top: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 28, height: 28, borderRadius: 7 },
  title: { flex: 1, fontFamily: SF, fontSize: 18, fontWeight: '700', color: '#1d1d1f', letterSpacing: -0.3 },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f2f2f4', alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 10 },
  thumb: { width: 60, height: 60, borderRadius: 13 },
  itemWords: { flex: 1, gap: 3 },
  itemTitle: { fontFamily: SF, fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#1d1d1f' },
  itemSource: { fontFamily: SF, fontSize: 13, color: '#6e6e73' },
  note: { fontFamily: SF, fontSize: 15, color: '#a1a1a6', marginTop: 16 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  pill: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: '#e3e5e8', backgroundColor: '#ffffff' },
  pillText: { fontFamily: SF, fontSize: 13.5, fontWeight: '500', color: '#1d1d1f' },
  tag: { backgroundColor: '#e7f4ee', borderColor: '#e7f4ee' },
  tagText: { color: '#0d7a50' },
  dashed: { borderStyle: 'dashed' },
  foot: { position: 'absolute', left: 18, right: 18, bottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { fontFamily: SF, fontSize: 16, color: '#6e6e73' },
  save: { height: 44, paddingHorizontal: 30, borderRadius: 22, backgroundColor: '#0d7a50', justifyContent: 'center' },
  saveText: { fontFamily: SF, fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
const c = StyleSheet.create({
  card: { backgroundColor: '#ffffff', alignItems: 'center', shadowColor: '#06203a', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  line: { height: 5, borderRadius: 3, backgroundColor: '#d9dde3', marginTop: 4, alignSelf: 'flex-start', marginLeft: '7%' },
});

// Sharing into FoundKeep from another app (proposals, 2026-10-03). Pritam: "when we open the share
// from other apps like Instagram, that design is very complicated — we don't need it. It shouldn't
// be that complicated. Make it cleaner." Today's sheet (the iPhone share extension,
// share-extension/ShareViewController.swift, drawn here as `today`) stacks Cancel/Save, a large
// "Save to FoundKeep", a status sentence, rows of what's shared marked ↗ “ ▧ (a reel or a video
// from YouTube reads "↗ Bookmark"), a note box, two large Folder and Tags buttons and a sentence
// explaining them. Three cleaner shapes, none with tags (they live quietly on the save):
//   card    — what you're saving, as it will look (its picture and title, read from the link),
//             your note, a folder chip, and one Save by the thumb.
//   instant — saved the moment you share: a small card at the bottom says so; a note and a folder
//             are optional, and Done closes it.
//   note    — the iPhone's own pattern: Cancel and Save on top, a small preview, the note as the
//             main thing, the folder one row under it.
// The picture and title of a link come from the iPhone's link previews (LinkPresentation) in the
// extension; the server names the save again once it's kept. Over a reel in a Reels-style app.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, TextInput, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { FILM_PHOTOS, Reel, SCREEN } from '../../first-run/apps.tsx';
import { usePalette } from '../../kit/pieces.tsx';

export type ShareLook = 'today' | 'card' | 'instant' | 'note';
export type ShareState = 'ready' | 'saving' | 'saved' | 'offline' | 'connect';
export type ShareKind = 'reel' | 'youtube' | 'post' | 'page' | 'photos' | 'text';

const PHOTO = {
  ramen: FILM_PHOTOS.ramen, kyoto: FILM_PHOTOS.kyoto,
  tacos: require('../../../assets/images/film/tacos.jpg'), desk: require('../../../assets/images/film/desk.jpg'),
  lake: require('../../../assets/images/film/lake.jpg'), plant: require('../../../assets/images/film/plant.jpg'), coffee: require('../../../assets/images/film/coffee.jpg'),
};
const ICON = require('../../../assets/images/icon.png');

/** What was shared: a link (its picture and title from the link preview), photos, or words. */
type Shared = { type: 'link' | 'photo' | 'text'; site?: string; mark?: string; color?: string; by?: string; title?: string; photo?: ImageSourcePropType; aspect?: number; text?: string; file?: string };
const SHARED: Record<ShareKind, Shared[]> = {
  reel: [{ type: 'link', site: 'Instagram', mark: 'logo-instagram', color: '#E1306C', by: 'noodle.diaries', title: 'Ten-minute ramen, one pot', photo: PHOTO.ramen, aspect: 0.8 }],
  youtube: [{ type: 'link', site: 'YouTube', mark: 'logo-youtube', color: '#FF0033', by: 'Kitchen Lab', title: 'High-protein breakfast in 5 minutes', photo: PHOTO.tacos, aspect: 16 / 9 }],
  post: [{ type: 'link', site: 'X', mark: 'logo-x', by: 'Slow Travels', title: 'Two days in Kyoto. The best part was getting lost in Gion after dark.', photo: PHOTO.kyoto, aspect: 4 / 3 }],
  page: [{ type: 'link', site: 'The Margin', mark: 'globe-outline', title: 'The half-life of a good idea', photo: PHOTO.desk, aspect: 1.9 }],
  photos: [{ type: 'photo', photo: PHOTO.lake, file: 'IMG_2481.jpg' }, { type: 'photo', photo: PHOTO.plant, file: 'IMG_2482.jpg' }, { type: 'photo', photo: PHOTO.coffee, file: 'IMG_2483.jpg' }],
  text: [{ type: 'text', site: 'The Margin', mark: 'globe-outline', text: 'Memory is built to discard; keeping everything would be its own kind of noise. The question is how to choose.' }],
};
const FOLDERS = ['Kitchen', 'Reading list', 'Design references', 'Travel'];
const label = (items: Shared[]) => items.length > 1 ? `${items.length} photos` : items[0]!.type === 'photo' ? 'A photo' : items[0]!.type === 'text' ? 'A highlight' : items[0]!.title ?? 'A link';

export function ShareSheetProposal({ look, kind = 'reel', state = 'ready' }: { look: ShareLook; kind?: ShareKind; state?: ShareState }) {
  const [now, setNow] = useState<ShareState>(state);
  useEffect(() => { setNow(state); }, [state, kind, look]);
  // Saving, then saved — as the real sheet would, before it closes itself.
  const save = () => { if (now !== 'ready') return; setNow('saving'); setTimeout(() => setNow('saved'), 900); };
  const items = SHARED[kind];
  return <View style={styles.fill}>
    <Host />
    {look === 'today' ? <Today items={items} state={now} onSave={save} />
      : look === 'instant' ? <Instant items={items} state={now === 'ready' ? 'saved' : now} />
      : look === 'note' ? <NoteFirst items={items} state={now} onSave={save} />
      : <Card items={items} state={now} onSave={save} />}
  </View>;
}

/** The app being shared from: a reel, pushed back and dimmed as the sheet comes up. */
function Host() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // The reel at the phone's width, under the status bar, the app's black bar below it.
  const scale = width / SCREEN.width;
  return <View style={[StyleSheet.absoluteFill, styles.host]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={{ width: SCREEN.width, height: SCREEN.height, transform: [{ scale }], transformOrigin: 'top left', position: 'absolute', left: 0, top: insets.top }}><Reel photo={FILM_PHOTOS.ramen} /></View>
    <View style={[StyleSheet.absoluteFill, styles.dim]} />
  </View>;
}

/** A sheet from the bottom, rising as it opens: nearly full height, or just what it holds. */
function Sheet({ children, full = true }: { children: React.ReactNode; full?: boolean }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const { height } = useWindowDimensions();
  const t = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => { Animated.spring(t, { toValue: 1, useNativeDriver: false, damping: 30, stiffness: 260, overshootClamping: true }).start(); }, [t]);
  return <Animated.View accessibilityViewIsModal style={[full ? [styles.sheet, { top: insets.top + 10 }] : [styles.card, { bottom: Math.max(insets.bottom, 10) }], { backgroundColor: P.paper, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>{children}</Animated.View>;
}

// ——— Today ———

function Today({ items, state, onSave }: { items: Shared[]; state: ShareState; onSave: () => void }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const status = state === 'connect' ? 'Open FoundKeep once to connect this iPhone, then share again.'
    : state === 'saving' ? 'Saving safely…' : state === 'saved' ? 'Saved to your collection.' : state === 'offline' ? 'Saved safely. 1 will upload when FoundKeep is online.'
    : items.length === 1 ? 'One item ready. Its source will stay attached.' : `${items.length} items ready. They will stay together in your collection.`;
  const row = (item: Shared) => item.type === 'photo' ? `▧  ${item.file}` : item.type === 'text' ? `“  ${item.text!.slice(0, 70)}` : item.site === 'The Margin' ? `↗  ${item.title}` : '↗  Bookmark';
  return <Sheet>
    <View style={[styles.todayNav]}>
      <Text style={[styles.todayNavText, { color: P.accent }]}>Cancel</Text>
      <Text style={[styles.todayNavText, styles.bold, { color: state === 'ready' ? P.accent : P.muted }]} onPress={onSave} accessibilityRole="button">Save</Text>
    </View>
    <View style={[styles.todayBody, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.todayBrand}><Image source={ICON} style={styles.todayMark} accessible={false} /><Text style={[styles.todayTitle, { color: P.ink }]}>Save to FoundKeep</Text></View>
      <Text style={[styles.todayStatus, { color: P.muted }]}>{status}</Text>
      <View style={styles.todayItems}>{items.map((item, index) => <Text key={index} numberOfLines={2} style={[styles.todayItem, { color: P.ink, backgroundColor: P.surface }]}>{row(item)}</Text>)}</View>
      <View style={[styles.todayNote, { backgroundColor: P.surface }]}><Text style={[styles.todayPlaceholder, { color: P.muted }]}>Add a note…</Text></View>
      <TodayButton icon="folder-outline" title="Folder" value="No folder" />
      <TodayButton icon="pricetag-outline" title="Tags" value="Add tags" />
      <Text style={[styles.todayStatus, { color: P.muted }]}>{state === 'connect' ? '' : 'Folder and tags apply to every item in this save.'}</Text>
      {state === 'connect' ? <Text style={[styles.todayNavText, { color: P.accent }]}>Open FoundKeep to connect</Text> : null}
    </View>
  </Sheet>;
}
function TodayButton({ icon, title, value }: { icon: string; title: string; value: string }) {
  const P = usePalette();
  return <View style={[styles.todayButton, { backgroundColor: P.line }]}><Ionicons name={icon as 'folder-outline'} size={20} color={P.ink} />
    <View><Text style={[styles.todayButtonTitle, { color: P.ink }]}>{title}</Text><Text style={[styles.todayButtonValue, { color: P.ink }]}>{value}</Text></View></View>;
}

// ——— Pieces of the cleaner shapes ———

/** Where it's from: the platform's mark, and who. */
function From({ item, size = 14 }: { item: Shared; size?: number }) {
  const P = usePalette();
  if (item.type === 'photo') return <View style={styles.from}><Ionicons name="images-outline" size={size + 1} color={P.muted} /><Text style={[styles.fromText, { color: P.muted, fontSize: size }]}>From Photos</Text></View>;
  return <View style={styles.from}>
    <Ionicons name={item.mark as 'logo-x'} size={size + 2} color={item.color ?? (item.mark === 'globe-outline' ? P.muted : P.ink)} />
    <Text style={[styles.fromText, { color: P.ink, fontSize: size }]} numberOfLines={1}><Text style={styles.bold}>{item.by ?? item.site}</Text>{item.by ? <Text style={{ color: P.muted }}>{`  ·  ${item.site}`}</Text> : null}</Text>
  </View>;
}
/** The picture(s) — one large, or several side by side; words as a quote. */
function Pictures({ items, height }: { items: Shared[]; height: number }) {
  const P = usePalette();
  const first = items[0]!;
  if (first.type === 'text') return <View style={[styles.quote, { borderLeftColor: P.accent }]}><Text style={[styles.quoteText, { color: P.ink }]}>{first.text}</Text></View>;
  if (items.length > 1) return <View style={[styles.photos, { height }]}>{items.slice(0, 3).map((item, index) => <Image key={index} source={item.photo!} style={[styles.photoTile, { borderRadius: 18 }]} accessible={false} />)}</View>;
  return <View style={[styles.picture, { height, backgroundColor: P.note }]}>
    <Image source={first.photo!} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
    {first.site === 'YouTube' || first.site === 'Instagram' ? <View style={styles.play}><Ionicons name="play" size={20} color="#fff" /></View> : null}
  </View>;
}
function NoteField({ big = false, placeholder = 'Add a note' }: { big?: boolean; placeholder?: string }) {
  const P = usePalette();
  const [text, setText] = useState('');
  return <View style={[styles.field, big && styles.fieldBig, { backgroundColor: P.surface, borderColor: P.line }]}>
    {!big ? <Ionicons name="create-outline" size={18} color={P.muted} style={styles.fieldIcon} /> : null}
    <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={P.muted} multiline accessibilityLabel="Note"
      style={[styles.input, big && styles.inputBig, { color: P.ink }, styles.webInput]} />
  </View>;
}
/** The folder, as one small chip; tapping lists the folders. */
function FolderChip({ quiet = false }: { quiet?: boolean }) {
  const P = usePalette();
  const [folder, setFolder] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return <View style={styles.folderWrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Folder: ${folder ?? 'none'}`} onPress={() => setOpen(value => !value)}
      style={({ pressed }) => [styles.chip, { backgroundColor: quiet ? 'transparent' : P.surface, borderColor: P.line }, pressed && styles.pressed]}>
      <Ionicons name="folder-outline" size={16} color={P.muted} /><Text style={[styles.chipText, { color: folder ? P.ink : P.muted }]}>{folder ?? 'Folder'}</Text><Ionicons name="chevron-down" size={14} color={P.muted} />
    </Pressable>
    {open ? <View style={[styles.menu, { backgroundColor: P.surface, borderColor: P.line }]}>
      {[null, ...FOLDERS].map(name => <Pressable key={name ?? 'none'} accessibilityRole="menuitem" onPress={() => { setFolder(name); setOpen(false); }} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: P.accentSoft }]}>
        <Ionicons name={name ? 'folder-outline' : 'remove-circle-outline'} size={17} color={P.muted} /><Text style={[styles.menuText, { color: P.ink }]}>{name ?? 'No folder'}</Text>
        {folder === name ? <Ionicons name="checkmark" size={17} color={P.accentPressed} /> : null}
      </Pressable>)}
      <Pressable accessibilityRole="menuitem" style={styles.menuItem}><Ionicons name="add" size={17} color={P.accentPressed} /><Text style={[styles.menuText, { color: P.accentPressed }]}>New folder</Text></Pressable>
    </View> : null}
  </View>;
}
/** The one button: Save → Saving… → Saved; or, signed out, Open FoundKeep. */
function SaveButton({ state, onSave, done = false }: { state: ShareState; onSave: () => void; done?: boolean }) {
  const P = usePalette();
  const words = state === 'connect' ? 'Open FoundKeep to sign in' : state === 'saving' ? 'Saving…' : state === 'saved' || state === 'offline' ? (done ? 'Done' : 'Saved') : 'Save';
  const filled = state === 'ready' || state === 'connect' || done;
  return <Pressable accessibilityRole="button" accessibilityLabel={words} onPress={onSave} disabled={state === 'saving'}
    style={({ pressed }) => [styles.save, { backgroundColor: filled ? P.ink : P.accentSoft }, pressed && styles.pressed]}>
    {state === 'saving' ? <ActivityIndicator color={P.ink} /> : (state === 'saved' || state === 'offline') && !done ? <Ionicons name="checkmark" size={20} color={P.accentPressed} /> : null}
    <Text style={[styles.saveText, { color: filled ? P.paper : P.accentPressed }]}>{words}</Text>
  </Pressable>;
}
function Line({ state }: { state: ShareState }) {
  const P = usePalette();
  if (state === 'offline') return <Text style={[styles.line, { color: P.muted }]}>Saved on this iPhone — it’ll upload when you’re online.</Text>;
  if (state === 'connect') return <Text style={[styles.line, { color: P.muted }]}>Sign in to FoundKeep on this iPhone once, then share again.</Text>;
  return null;
}
function Close({ label: words = 'Cancel' }: { label?: string }) {
  const P = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={words} hitSlop={8} style={({ pressed }) => [styles.close, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}><Ionicons name="close" size={20} color={P.ink} /></Pressable>;
}

// ——— card: one card, one button ———

function Card({ items, state, onSave }: { items: Shared[]; state: ShareState; onSave: () => void }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const first = items[0]!;
  const room = width - 40;
  const height = first.type === 'text' ? 0 : items.length > 1 ? room / 3 : Math.min(room / (first.aspect ?? 1.5), 300);
  return <Sheet>
    <View style={styles.cardHead}><Close /></View>
    <View style={[styles.cardBody, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={styles.cardTop}>
        <Pictures items={items} height={height} />
        <View style={styles.cardWords}>
          {items.length === 1 ? <From item={first} /> : <From item={first} />}
          {first.type !== 'text' ? <Text style={[styles.cardTitle, { color: P.ink }]} numberOfLines={3}>{label(items)}</Text> : null}
        </View>
        <NoteField />
        <FolderChip />
      </View>
      <View style={styles.cardBottom}><Line state={state} /><SaveButton state={state} onSave={onSave} /></View>
    </View>
  </Sheet>;
}

// ——— instant: saved the moment you share ———

function Instant({ items, state }: { items: Shared[]; state: ShareState }) {
  const P = usePalette();
  const first = items[0]!;
  const [done, setDone] = useState(false);
  const title = state === 'connect' ? 'Not saved yet' : state === 'saving' ? 'Saving…' : 'Saved to FoundKeep';
  return <Sheet full={false}>
    <View style={styles.instant}>
      <View style={styles.instantHead}>
        {first.type === 'text' ? <View style={[styles.thumb, styles.thumbWords, { backgroundColor: P.accentSoft }]}><Ionicons name="text-outline" size={22} color={P.accentPressed} /></View>
          : <Image source={first.photo!} style={styles.thumb} accessible={false} />}
        <View style={styles.instantWords}>
          <View style={styles.instantTitleRow}>
            {state === 'saved' || state === 'offline' ? <Ionicons name="checkmark-circle" size={19} color={P.accentPressed} /> : state === 'saving' ? <ActivityIndicator size="small" color={P.muted} /> : null}
            <Text style={[styles.instantTitle, { color: P.ink }]}>{title}</Text>
          </View>
          <Text style={[styles.instantSub, { color: P.muted }]} numberOfLines={1}>{first.type === 'text' ? first.text : label(items)}</Text>
        </View>
        <Close label="Close" />
      </View>
      <Line state={state} />
      {state === 'connect' ? <SaveButton state="connect" onSave={() => {}} /> : <>
        <NoteField placeholder="Add a note (optional)" />
        <View style={styles.instantFoot}><FolderChip /><View style={styles.flex} /><Pressable accessibilityRole="button" onPress={() => setDone(true)} style={({ pressed }) => [styles.done, { backgroundColor: P.ink }, pressed && styles.pressed]}><Text style={[styles.saveText, { color: P.paper }]}>{done ? 'Closing…' : 'Done'}</Text></Pressable></View>
      </>}
    </View>
  </Sheet>;
}

// ——— note: the iPhone's own pattern ———

function NoteFirst({ items, state, onSave }: { items: Shared[]; state: ShareState; onSave: () => void }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const first = items[0]!;
  const action = state === 'saving' ? 'Saving…' : state === 'saved' || state === 'offline' ? 'Saved' : state === 'connect' ? '' : 'Save';
  return <Sheet>
    <View style={[styles.nav, { borderBottomColor: P.line }]}>
      <Text style={[styles.navText, { color: P.ink }]} accessibilityRole="button">Cancel</Text>
      <View style={styles.navTitle}><Image source={ICON} style={styles.navMark} accessible={false} /><Text style={[styles.navTitleText, { color: P.ink }]}>FoundKeep</Text></View>
      <Text style={[styles.navText, styles.bold, { color: state === 'ready' ? P.accentPressed : P.muted, minWidth: 54, textAlign: 'right' }]} accessibilityRole="button" onPress={onSave}>{action}</Text>
    </View>
    <View style={[styles.noteBody, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.preview, { backgroundColor: P.surface, borderColor: P.line }]}>
        {first.type === 'text' ? <View style={[styles.thumb, styles.thumbWords, { backgroundColor: P.accentSoft }]}><Ionicons name="text-outline" size={22} color={P.accentPressed} /></View> : <Image source={first.photo!} style={styles.thumb} accessible={false} />}
        <View style={styles.previewWords}><Text style={[styles.previewTitle, { color: P.ink }]} numberOfLines={2}>{first.type === 'text' ? first.text : label(items)}</Text><From item={first} size={13} /></View>
      </View>
      <Line state={state} />
      {state === 'connect' ? <SaveButton state="connect" onSave={() => {}} /> : <>
        <NoteField big placeholder="Add a note…" />
        <View style={[styles.folderRow, { borderColor: P.line }]}><Text style={[styles.folderLabel, { color: P.muted }]}>Folder</Text><View style={styles.flex} /><FolderChip quiet /></View>
      </>}
    </View>
  </Sheet>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
  host: { overflow: 'hidden' },
  dim: { backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: 'hidden' },
  card: { position: 'absolute', left: 10, right: 10, borderRadius: 34, overflow: 'visible', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } },
  // today
  todayNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  todayNavText: { fontSize: 17 },
  todayBody: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  todayBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  todayMark: { width: 40, height: 40, borderRadius: 9 },
  todayTitle: { fontSize: 22, fontWeight: '400' },
  todayStatus: { fontSize: 15, lineHeight: 20 },
  todayItems: { gap: 8 },
  todayItem: { fontSize: 15, padding: 10, borderRadius: 8, overflow: 'hidden' },
  todayNote: { height: 108, borderRadius: 10, padding: 12 },
  todayPlaceholder: { fontSize: 17 },
  todayButton: { minHeight: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  todayButtonTitle: { fontSize: 15 },
  todayButtonValue: { fontSize: 17 },
  // shared pieces
  from: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  fromText: { flexShrink: 1 },
  picture: { borderRadius: 24, overflow: 'hidden', width: '100%' },
  play: { position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(10,20,30,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  photos: { flexDirection: 'row', gap: 6 },
  photoTile: { flex: 1, height: '100%' },
  quote: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4 },
  quoteText: { fontSize: 19, lineHeight: 28 },
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, minHeight: 50 },
  fieldBig: { minHeight: 170, borderRadius: 18, paddingTop: 8 },
  fieldIcon: { marginTop: 13 },
  input: { flex: 1, minWidth: 0, fontSize: 16.5, minHeight: 40, paddingVertical: 11 },
  inputBig: { fontSize: 18, lineHeight: 26, minHeight: 150, textAlignVertical: 'top' },
  webInput: { outlineStyle: 'none' } as object,
  folderWrap: { alignSelf: 'flex-start', zIndex: 4 },
  chip: { height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  menu: { position: 'absolute', bottom: 42, left: 0, minWidth: 220, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  menuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  menuText: { flex: 1, fontSize: 15.5 },
  save: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { fontSize: 17, fontWeight: '700' },
  line: { fontSize: 14.5, lineHeight: 20, textAlign: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  // card
  cardHead: { paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row' },
  cardBody: { flex: 1, paddingHorizontal: 20, paddingTop: 10, justifyContent: 'space-between' },
  cardTop: { gap: 14 },
  cardWords: { gap: 6 },
  cardTitle: { fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 },
  cardBottom: { gap: 10 },
  // instant
  instant: { padding: 16, gap: 14 },
  instantHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  thumbWords: { alignItems: 'center', justifyContent: 'center' },
  instantWords: { flex: 1, gap: 2 },
  instantTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  instantTitle: { fontSize: 17, fontWeight: '700' },
  instantSub: { fontSize: 14.5 },
  instantFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  done: { height: 44, borderRadius: 22, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  // note
  nav: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  navText: { fontSize: 17 },
  navTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  navMark: { width: 22, height: 22, borderRadius: 5 },
  navTitleText: { fontSize: 17, fontWeight: '700' },
  noteBody: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  previewWords: { flex: 1, gap: 4 },
  previewTitle: { fontSize: 15.5, fontWeight: '600', lineHeight: 21 },
  folderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  folderLabel: { fontSize: 15 },
});

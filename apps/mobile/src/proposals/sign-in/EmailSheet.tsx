// Proposal (sign-in, 2026-09-30): "Continue with email" opens this sheet over
// the first screen. Real sign-in (useSession().login), on the shared tokens.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveTextInput as TextInput } from '../../components/AdaptiveTextInput.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { useAppearance } from '../../appearance/AppearanceProvider.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { tokens } from '../../ui/tokens.ts';

export function EmailSheet({ onClose }: { onClose: () => void }) {
  const { scheme } = useAppearance();
  const c = tokens.color[scheme];
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const { login } = useSession();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const open = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => { Animated.timing(open, { toValue: 1, duration: motion ? 320 : 0, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(); }, [motion, open]);
  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true); setError('');
    try { await login({ email: email.trim(), password }); } catch (value) { setError((value as Error).message); } finally { setBusy(false); }
  };
  const field = [styles.field, { backgroundColor: c.bg, borderColor: c.line }];
  return <View style={StyleSheet.absoluteFill}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.35)', opacity: open }]}><Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} /></Animated.View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dock} pointerEvents="box-none">
      <Animated.View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20, transform: [{ translateY: open.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }]}>
        <View style={[styles.grabber, { backgroundColor: c.line }]} />
        <Text accessibilityRole="header" style={[styles.title, { color: c.ink }]}>Continue with email</Text>
        <TextInput accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" style={field} />
        <TextInput accessibilityLabel="Password" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} style={field} />
        {error ? <Text style={[styles.error, { color: c.bad }]}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Sign in" disabled={busy} onPress={submit} style={({ pressed }) => [styles.primary, { backgroundColor: c.button }, (pressed || busy) && { opacity: 0.85 }]}>
          {busy ? <ActivityIndicator color={c.onButton} /> : <Text style={[styles.primaryLabel, { color: c.onButton }]}>Sign in</Text>}
        </Pressable>
        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/recover')} hitSlop={8}><Text style={[styles.link, { color: c.muted }]}>Forgot your password?</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/register')} hitSlop={8}><Text style={[styles.link, { color: c.accent }]}>Create an account</Text></Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  dock: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, gap: 12 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 6 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3, marginBottom: 4 },
  field: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  error: { fontSize: 13 },
  primary: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryLabel: { fontSize: 16, fontWeight: '600' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 16, paddingTop: 6 },
  link: { fontSize: 14, fontWeight: '500', paddingVertical: 6 },
});

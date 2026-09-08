import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, typography } from '../theme.ts';

export function Screen({ children, keyboard = false }: { children: ReactNode; keyboard?: boolean }) {
  const content = <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
  return keyboard ? <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView> : content;
}

export function Mark({ size = 38 }: { size?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.mark, { width: size, height: size, borderRadius: size * .22 }]}><View style={[styles.fold, { width: size * .42, height: size * .54 }]} /><View style={[styles.point, { width: size * .16, height: size * .16, borderRadius: size }]} /></View>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brand}><Mark size={compact ? 32 : 40} /><Text style={[styles.brandName, compact && { fontSize: 23 }]}>Foundkeep</Text></View>;
}

export function Button({ label, onPress, loading = false, disabled = false, secondary = false }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && styles.buttonPressed, (disabled || loading) && styles.buttonDisabled]}>{loading ? <ActivityIndicator color={secondary ? colors.ink : colors.white} /> : <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>}</Pressable>;
}

export function Field({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  return <View style={styles.field}><Text style={typography.label}>{label}</Text><TextInput {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} placeholderTextColor="#92978F" selectionColor={colors.accent} accessibilityLabel={label} /><Text style={typography.small}>{help || ' '}</Text></View>;
}

export function Message({ children, error = false }: { children?: ReactNode; error?: boolean }) {
  if (!children) return null;
  return <View accessibilityRole={error ? 'alert' : undefined} style={[styles.message, error && styles.messageError]}><Text style={[typography.small, error && { color: colors.error }]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: colors.ink, fontSize: 28, fontWeight: '700', letterSpacing: -1 },
  mark: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  fold: { borderWidth: 2, borderColor: colors.paper, borderBottomWidth: 0, transform: [{ rotate: '2deg' }] },
  point: { position: 'absolute', backgroundColor: colors.accent, bottom: '18%', right: '22%' },
  button: { minHeight: 52, borderRadius: 8, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  buttonPressed: { opacity: .78 },
  buttonDisabled: { opacity: .46 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  buttonTextSecondary: { color: colors.ink },
  field: { gap: 7 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#C9CEC3', borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 130, paddingTop: 14, textAlignVertical: 'top' },
  message: { padding: 12, borderRadius: 8, backgroundColor: colors.paleMoss },
  messageError: { backgroundColor: '#F5E0DD' },
});

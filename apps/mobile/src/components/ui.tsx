import type { ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../theme.ts';

export function Screen({ children, keyboard = false, top = true }: { children: ReactNode; keyboard?: boolean; top?: boolean }) {
  const content = <SafeAreaView edges={top ? ['top', 'left', 'right'] : ['left', 'right']} style={styles.screen}>{children}</SafeAreaView>;
  return keyboard ? <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView> : content;
}

export function Mark({ size = 38 }: { size?: number }) {
  return <Image source={require('../../assets/images/mark.png')} accessible={false} style={{ width: size, height: size }} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brand}><Mark size={compact ? 28 : 40} /><Text maxFontSizeMultiplier={1.5} style={[styles.brandName, compact && { fontSize: 19 }]}>Foundkeep</Text></View>;
}

export function LegalFooter() {
  return <Text style={styles.legal}>By continuing, you agree to our <Text accessibilityRole="link" style={styles.legalLink} onPress={() => void Linking.openURL('https://foundkeep.app/terms.html')}>Terms</Text> and <Text accessibilityRole="link" style={styles.legalLink} onPress={() => void Linking.openURL('https://foundkeep.app/privacy.html')}>Privacy Policy</Text>.</Text>;
}

export function Button({ label, onPress, loading = false, disabled = false, secondary = false, danger = false }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger, pressed && styles.buttonPressed, (disabled || loading) && styles.buttonDisabled]}>{loading ? <ActivityIndicator color={secondary && !danger ? colors.ink : danger ? colors.onError : colors.onAccent} /> : <Text style={[styles.buttonText, secondary && !danger && styles.buttonTextSecondary, danger && { color: colors.onError }]}>{label}</Text>}</Pressable>;
}

export function Field({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} placeholderTextColor={colors.muted} selectionColor={colors.accent} accessibilityLabel={label} />{help ? <Text style={typography.small}>{help}</Text> : null}</View>;
}

export function Message({ children, error = false }: { children?: ReactNode; error?: boolean }) {
  if (!children) return null;
  return <View accessibilityRole={error ? 'alert' : undefined} style={[styles.message, error && styles.messageError]}><Text style={[typography.small, error && { color: colors.error }]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: colors.ink, fontSize: 28, fontWeight: '700', letterSpacing: -1 },
  legal: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10, paddingVertical: 12 },
  legalLink: { color: colors.ink, textDecorationLine: 'underline' },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  button: { minHeight: 52, borderRadius: 8, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  buttonDanger: { backgroundColor: colors.error },
  buttonPressed: { opacity: .78 },
  buttonDisabled: { opacity: .46 },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  buttonTextSecondary: { color: colors.ink },
  field: { gap: 7 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 17 },
  multiline: { minHeight: 130, paddingTop: 14, textAlignVertical: 'top' },
  message: { padding: 12, borderRadius: 8, backgroundColor: colors.paleMoss },
  messageError: { backgroundColor: colors.errorSurface },
});

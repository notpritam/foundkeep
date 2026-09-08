import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors, typography } from '../../theme.ts';

export default function RecoveryCode() {
  const { recoveryCode, acknowledgeRecovery } = useSession(); const [copied, setCopied] = useState(false); const [saved, setSaved] = useState(false);
  if (!recoveryCode) return <Redirect href="/(app)/collection" />;
  const copy = async () => { await Clipboard.setStringAsync(recoveryCode); setCopied(true); };
  return <Screen><View style={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.label}>One-time recovery code</Text><Text style={typography.title}>Keep this somewhere safe.</Text><Text style={typography.body}>Foundkeep cannot show this code again. You need it if you forget your password.</Text></View><View accessible accessibilityLabel={`Recovery code ${recoveryCode}`} style={styles.code}><Text selectable style={styles.codeText}>{recoveryCode}</Text></View><Message>{copied ? 'Copied to the clipboard.' : 'A password manager is a good place for it.'}</Message><View style={styles.actions}><Button label="Copy recovery code" secondary onPress={copy} /><Button label={saved ? 'Open my collection' : 'I saved the code'} onPress={() => { if (!saved) { setSaved(true); return; } acknowledgeRecovery(); router.replace('/(app)/collection'); }} /></View></View></Screen>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 24, gap: 28 }, heading: { marginTop: 24, gap: 12 }, code: { padding: 18, borderWidth: 1, borderColor: colors.moss, borderRadius: 8, backgroundColor: colors.surface }, codeText: { color: colors.ink, fontSize: 17, lineHeight: 26, fontFamily: 'monospace' }, actions: { marginTop: 'auto', gap: 12 } });

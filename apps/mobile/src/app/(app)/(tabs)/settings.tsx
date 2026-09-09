import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import FoundkeepShared from '../../../../modules/foundkeep-shared/src';
import { OAuthButtons } from '../../../components/OAuthButtons.tsx';
import { Brand, Button, Field, Message, Screen } from '../../../components/ui.tsx';
import { useSession } from '../../../session/SessionProvider.tsx';
import { colors, typography } from '../../../theme.ts';
import { disableNotifications, enableNotifications, notificationState, type NotificationState } from '../../../notifications/notifications.ts';

const usage = (value = 0) => `${(value / 1048576).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
export default function Settings() {
  const { account, usage: storage, policy, updateRequired, logout, deleteAccount, client } = useSession(); const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [resolving, setResolving] = useState(false);
  const refreshQueue = useCallback(async () => {
    const [pending, blocked] = await Promise.all([FoundkeepShared.pendingCount(), FoundkeepShared.blockedPendingCount()]);
    setPending(pending); setBlocked(blocked);
  }, []);
  useFocusEffect(useCallback(() => { void refreshQueue().catch(() => {}); }, [refreshQueue]));
  const recoverBlocked = () => Alert.alert('Save these items to Unfiled?', 'Their folder was deleted. Your tags, notes, files, and original sources will stay attached.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save to Unfiled', onPress: async () => {
    setResolving(true); setError('');
    try { await FoundkeepShared.resolveBlockedPendingToUnfiled(); await FoundkeepShared.retryPending(); client.invalidate(); await refreshQueue(); }
    catch (value) { setError((value as Error).message); }
    finally { setResolving(false); }
  } }]);
  const [showDelete, setShowDelete] = useState(false); const [password, setPassword] = useState(''); const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<NotificationState>('off'); const [changingNotification, setChangingNotification] = useState(false);
  useEffect(() => { let live = true; void notificationState(client).then(value => { if (live) setNotification(value); }).catch(() => {}); return () => { live = false; }; }, [client]);
  const changeNotifications = async () => {
    if (notification === 'blocked') { await Linking.openSettings(); return; }
    if (notification === 'unavailable') return;
    setChangingNotification(true); setError('');
    try {
      if (notification === 'on') await disableNotifications(client);
      else await enableNotifications(client);
      setNotification(await notificationState(client));
    } catch (value) {
      setError((value as Error).message);
      try { setNotification(await notificationState(client)); } catch {}
    } finally { setChangingNotification(false); }
  };
  const signOut = () => Alert.alert('Sign out of this iPhone?', 'Foundkeep will stop saving from the Share sheet until you sign in again.', [{ text: 'Stay signed in', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { try { await logout(); router.replace('/(auth)/welcome'); } catch (value) { setError((value as Error).message); } } }]);
  const confirmDeletion = () => {
    if (!password) { setError('Enter your password to delete this account.'); return; }
    Alert.alert('Permanently delete this account?', 'Every cloud capture and uploaded file will be deleted. This cannot be undone.', [
      { text: 'Keep account', style: 'cancel' },
      { text: 'Delete permanently', style: 'destructive', onPress: () => void (async () => {
        setDeleting(true); setError('');
        try { await deleteAccount(password); router.replace('/(auth)/welcome'); }
        catch (value) { setError((value as Error).message); setDeleting(false); }
      })() },
    ]);
  };
  const notificationCopy = !policy.features.notifications ? 'Capture alerts are temporarily unavailable.' : notification === 'on' ? 'On. A private alert opens the saved item when processing finishes.' : notification === 'blocked' ? 'Off in iPhone Settings. Allow Foundkeep alerts there to turn them back on.' : notification === 'unavailable' ? 'Push alerts are available on a physical iPhone.' : 'Off. Turn this on to hear when a shared item is ready.';
  const notificationAction = notification === 'on' ? 'Turn off capture alerts' : notification === 'blocked' ? 'Open iPhone Settings' : 'Turn on capture alerts';
  return <Screen><ScrollView contentContainerStyle={styles.page}><Brand compact /><Button label="How to save from other apps" secondary onPress={() => router.push('/(app)/onboarding')} /><View style={styles.heading}><Text style={typography.title}>Settings.</Text><Text style={typography.body}>Your account, storage and share connection.</Text></View>{updateRequired ? <Message error>A newer Foundkeep version is required. Update it from the App Store to resume saving.</Message> : <Message>{policy.notice}</Message>}<View style={styles.panel}><Text style={typography.label}>Signed in as</Text><Text style={styles.account}>{account?.name}</Text><Text style={typography.small}>{account?.email}</Text></View><View style={styles.panel}><Text style={typography.label}>Collection storage</Text><Text style={styles.storage}>{storage?.captures.toLocaleString() || 0} items</Text><Text style={typography.small}>{usage(storage?.bytes)} of {usage(storage?.maxBytes)} used</Text></View>{pending > 0 ? <View style={styles.panel}><Text style={typography.label}>Waiting to upload</Text><Text style={typography.body}>{pending} {pending === 1 ? 'save is' : 'saves are'} kept safely on this iPhone.</Text>{blocked > 0 ? <><Text style={typography.small}>{blocked} need a new home because their folder was deleted.</Text><Button secondary label="Save blocked items to Unfiled" loading={resolving} onPress={recoverBlocked} /></> : <Text style={typography.small}>They’ll upload when Foundkeep reconnects.</Text>}</View> : null}<View style={styles.panel}><Text style={typography.label}>Capture-ready alerts</Text><Text style={typography.body}>{notificationCopy}</Text><Text style={typography.small}>Alerts never include your saved title, text, source, or account details.</Text><Button label={notificationAction} secondary={notification !== 'off'} loading={changingNotification} disabled={!policy.features.notifications || notification === 'unavailable'} onPress={() => void changeNotifications()} /></View><View style={styles.panel}><Text style={typography.label}>Share from any app</Text><Text style={typography.body}>In an iPhone Share menu, choose Foundkeep. If it is hidden, tap More and add it to Favorites.</Text><Text style={typography.small}>Links, text, images, videos, audio, PDFs and other files are supported.</Text></View><View style={styles.panel}><Text style={typography.label}>Live configuration</Text><Text style={typography.body}>Policy revision {policy.revision}</Text><Text style={typography.small}>Availability and safe limits sync automatically. App UI and copy can update over the air.</Text></View><Message error>{error}</Message><View style={styles.links}><Button label="Support" secondary onPress={() => void Linking.openURL('https://foundkeep.app/support.html')} /><Button label="Privacy policy" secondary onPress={() => void Linking.openURL('https://foundkeep.app/privacy.html')} /><Button label="Terms" secondary onPress={() => void Linking.openURL('https://foundkeep.app/terms.html')} /><Button label="Open web dashboard" secondary onPress={() => void Linking.openURL('https://foundkeep.app/dashboard.html')} /></View><Button label="Sign out" secondary onPress={signOut} />{showDelete ? <View style={styles.deletePanel}><Text style={typography.heading}>Delete your account?</Text><Text style={typography.small}>This permanently removes every cloud capture, uploaded file, connection, and account credential. Export anything you need first.</Text>{account?.hasPassword === false ? <OAuthButtons intent="delete" /> : <><Field label="Password" value={password} onChangeText={setPassword} textContentType="password" secureTextEntry autoCapitalize="none" /><Button label="Delete account permanently" danger loading={deleting} onPress={confirmDeletion} /></>}<Button label="Cancel" secondary disabled={deleting} onPress={() => { setShowDelete(false); setPassword(''); setError(''); }} /></View> : <Button label="Delete account" secondary onPress={() => setShowDelete(true)} />}<Text style={styles.version}>Foundkeep 1.0.0 · Updates delivered securely through the App Store and EAS Update.</Text></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { padding: 22, paddingBottom: 48, gap: 16 }, heading: { gap: 9, marginVertical: 14 }, panel: { gap: 7, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.surface }, account: { color: colors.ink, fontSize: 21, fontWeight: '700' }, storage: { color: colors.ink, fontSize: 23, fontWeight: '700' }, links: { gap: 10 }, deletePanel: { gap: 12, padding: 18, borderWidth: 1, borderColor: '#D9AAA4', borderRadius: 11, backgroundColor: colors.errorSurface }, version: { ...typography.small, textAlign: 'center', marginTop: 8 } });

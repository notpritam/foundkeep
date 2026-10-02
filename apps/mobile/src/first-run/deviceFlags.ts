import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getEnvironment } from '../environment.ts';
import { createFirstRun, type FlagStore } from './firstRun.ts';

/** Small per-device flags: the keychain on the phone, localStorage on the web (as the appearance setting does). */
const deviceFlags: FlagStore = {
  get: async key => (Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: async (key, value) => { if (Platform.OS === 'web') localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value); },
};
export const firstRun = createFirstRun(deviceFlags, getEnvironment().environment);

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { MobileAccount } from './auth-client';

const SESSION_KEY = 'new-dawn.mobile-session.v1';

export type StoredMobileSession = {
  refreshToken: string;
  account: MobileAccount;
};

let webSession: string | null = null;

export async function readStoredSession(): Promise<StoredMobileSession | null> {
  const value = Platform.OS === 'web'
    ? webSession
    : await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredMobileSession>;
    if (
      typeof parsed.refreshToken !== 'string'
      || !parsed.account
      || typeof parsed.account.id !== 'string'
      || typeof parsed.account.email !== 'string'
      || !Array.isArray(parsed.account.roles)
    ) {
      return null;
    }
    return parsed as StoredMobileSession;
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: StoredMobileSession): Promise<void> {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') {
    webSession = value;
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredSession(): Promise<void> {
  if (Platform.OS === 'web') {
    webSession = null;
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

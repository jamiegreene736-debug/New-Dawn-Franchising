import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { NotificationPreferences, ReminderKind } from './auth-client';

const NOTIFICATION_STATE_KEY = 'new-dawn.notification-state.v1';

export type StoredLocalReminder = {
  id: string;
  serverId: string | null;
  kind: ReminderKind;
  eventAt: string;
  scheduledNotificationIds: string[];
};

export type StoredNotificationState = {
  preferences: Omit<NotificationPreferences, 'updatedAt'>;
  reminders: StoredLocalReminder[];
};

let webState: string | null = null;

export async function readStoredNotificationState(): Promise<StoredNotificationState | null> {
  const value = Platform.OS === 'web' ? webState : await SecureStore.getItemAsync(NOTIFICATION_STATE_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredNotificationState>;
    if (!parsed.preferences || !Array.isArray(parsed.reminders)) return null;
    return parsed as StoredNotificationState;
  } catch {
    return null;
  }
}
export async function writeStoredNotificationState(state: StoredNotificationState): Promise<void> {
  const value = JSON.stringify(state);
  if (Platform.OS === 'web') {
    webState = value;
    return;
  }
  await SecureStore.setItemAsync(NOTIFICATION_STATE_KEY, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

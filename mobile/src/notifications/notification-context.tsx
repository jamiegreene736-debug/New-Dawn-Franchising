import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { runtimeConfig } from '@/config/runtime';
import { usePrototype } from '@/prototype/prototype-context';
import {
  mobileAuthClient,
  type NotificationPreferences,
  type PathNotification,
  type ReminderKind,
} from '@/services/auth-client';
import {
  readStoredNotificationState,
  writeStoredNotificationState,
  type StoredLocalReminder,
} from '@/services/notification-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const GENERIC_CONTENT: Notifications.NotificationContentInput = {
  title: 'New Dawn Pathways',
  body: 'You have an update in your pathway.',
  sound: 'default',
  data: { deepLink: '/notifications' },
};

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'updatedAt'> = {
  nextAction: true,
  appointments: true,
  fdd: true,
  embassy: true,
  expiration: true,
  secureStatus: true,
  opportunities: false,
  weeklyDigest: true,
  referrals: true,
  ownerOperations: true,
  followedEmbassyPost: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
};

type NotificationPermissionState = 'unknown' | 'not_determined' | 'granted' | 'denied' | 'unavailable';

type NotificationState = {
  ready: boolean;
  permission: NotificationPermissionState;
  preferences: Omit<NotificationPreferences, 'updatedAt'>;
  notifications: PathNotification[];
  reminders: StoredLocalReminder[];
  unreadCount: number;
  error: string;
  enableNotifications: () => Promise<boolean>;
  updatePreferences: (preferences: Omit<NotificationPreferences, 'updatedAt'>) => Promise<void>;
  addReminder: (kind: ReminderKind, eventAt: Date) => Promise<void>;
  cancelReminder: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationState | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { accessToken, account } = useAuth();
  const { role, language } = usePrototype();
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>('unknown');
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [notifications, setNotifications] = useState<PathNotification[]>([]);
  const [reminders, setReminders] = useState<StoredLocalReminder[]>([]);
  const [error, setError] = useState('');

  const persist = useCallback(async (
    nextPreferences: Omit<NotificationPreferences, 'updatedAt'>,
    nextReminders: StoredLocalReminder[],
  ) => {
    await writeStoredNotificationState({ preferences: nextPreferences, reminders: nextReminders });
  }, []);

  const refresh = useCallback(async () => {
    if (runtimeConfig.mode !== 'connected' || !mobileAuthClient || !accessToken) {
      setNotifications(buildPrototypeNotifications(role, language));
      return;
    }
    try {
      const [serverPreferences, serverNotifications] = await Promise.all([
        mobileAuthClient.getNotificationPreferences(accessToken),
        mobileAuthClient.getNotifications(accessToken),
      ]);
      const { updatedAt: _updatedAt, ...nextPreferences } = serverPreferences;
      setPreferences(nextPreferences);
      setNotifications(serverNotifications);
      await persist(nextPreferences, reminders);
      setError('');
    } catch {
      setError('Updates could not be refreshed. Saved reminders still work on this iPhone.');
    }
  }, [accessToken, language, persist, reminders, role]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [stored, currentPermission] = await Promise.all([
        readStoredNotificationState(),
        readPermissionState(),
      ]);
      if (!active) return;
      if (stored) {
        setPreferences(stored.preferences);
        setReminders(stored.reminders);
      }
      setPermission(currentPermission);
      setReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [account?.id, language, ready, refresh, role]);

  useEffect(() => {
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      const deepLink = response?.notification.request.content.data?.deepLink;
      if (typeof deepLink === 'string' && deepLink.startsWith('/')) router.push(deepLink as never);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    return () => subscription.remove();
  }, [router]);

  const enableNotifications = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermission('unavailable');
      return false;
    }
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    const granted = permissionIsGranted(result);
    setPermission(granted ? 'granted' : 'denied');
    if (!granted) return false;

    if (runtimeConfig.mode === 'connected' && mobileAuthClient && accessToken && Device.isDevice) {
      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (typeof projectId === 'string' && (Platform.OS === 'ios' || Platform.OS === 'android')) {
        try {
          const token = await Notifications.getExpoPushTokenAsync({ projectId });
          await mobileAuthClient.registerNotificationDevice(accessToken, {
            expoPushToken: token.data,
            platform: Platform.OS,
            deviceLabel: Device.deviceName ?? 'Mobile device',
            locale: language,
          });
        } catch {
          setError('Reminders are enabled on this iPhone. Remote updates will connect when push setup is available.');
        }
      }
    }
    return true;
  }, [accessToken, language]);

  const updatePreferences = useCallback(async (nextPreferences: Omit<NotificationPreferences, 'updatedAt'>) => {
    setPreferences(nextPreferences);
    await persist(nextPreferences, reminders);
    if (runtimeConfig.mode === 'connected' && mobileAuthClient && accessToken) {
      try {
        await mobileAuthClient.updateNotificationPreferences(accessToken, nextPreferences);
        setError('');
      } catch {
        setError('Preferences are saved on this iPhone and will sync when the service is available.');
      }
    }
  }, [accessToken, persist, reminders]);

  const addReminder = useCallback(async (kind: ReminderKind, eventAt: Date) => {
    if (eventAt.getTime() <= Date.now()) throw new Error('Choose a future date and time.');
    const allowed = permission === 'granted' || await enableNotifications();
    if (!allowed) throw new Error('Allow notifications in iPhone Settings to create reminders.');

    let serverId: string | null = null;
    if (runtimeConfig.mode === 'connected' && mobileAuthClient && accessToken) {
      const serverReminder = await mobileAuthClient.createReminder(accessToken, kind, eventAt.toISOString());
      serverId = serverReminder.id;
    }
    const scheduledNotificationIds: string[] = [];
    for (const date of reminderTriggerDates(kind, eventAt)) {
      scheduledNotificationIds.push(await Notifications.scheduleNotificationAsync({
        content: GENERIC_CONTENT,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      }));
    }
    const localReminder: StoredLocalReminder = {
      id: serverId ?? createLocalId(),
      serverId,
      kind,
      eventAt: eventAt.toISOString(),
      scheduledNotificationIds,
    };
    const nextReminders = [...reminders, localReminder].sort((a, b) => a.eventAt.localeCompare(b.eventAt));
    setReminders(nextReminders);
    await persist(preferences, nextReminders);
  }, [accessToken, enableNotifications, permission, persist, preferences, reminders]);

  const cancelReminder = useCallback(async (id: string) => {
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return;
    await Promise.all(reminder.scheduledNotificationIds.map((notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId)));
    if (reminder.serverId && runtimeConfig.mode === 'connected' && mobileAuthClient && accessToken) {
      await mobileAuthClient.cancelReminder(accessToken, reminder.serverId);
    }
    const nextReminders = reminders.filter((item) => item.id !== id);
    setReminders(nextReminders);
    await persist(preferences, nextReminders);
  }, [accessToken, persist, preferences, reminders]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((current) => current.map((item) => item.id === id
      ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
      : item));
    if (runtimeConfig.mode === 'connected' && mobileAuthClient && accessToken) {
      await mobileAuthClient.markNotificationRead(accessToken, id);
    }
  }, [accessToken]);

  const value = useMemo<NotificationState>(() => ({
    ready,
    permission,
    preferences,
    notifications,
    reminders,
    unreadCount: notifications.filter((item) => !item.readAt).length,
    error,
    enableNotifications,
    updatePreferences,
    addReminder,
    cancelReminder,
    markRead,
    refresh,
  }), [addReminder, cancelReminder, enableNotifications, error, markRead, notifications, permission,
    preferences, ready, refresh, reminders, updatePreferences]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function usePathNotifications(): NotificationState {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('usePathNotifications must be used within NotificationProvider');
  return value;
}

function permissionIsGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  if (status.granted) return true;
  return status.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
    || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    || status.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

async function readPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  const status = await Notifications.getPermissionsAsync();
  if (permissionIsGranted(status)) return 'granted';
  if (status.status === 'denied') return 'denied';
  return 'not_determined';
}

function reminderTriggerDates(kind: ReminderKind, eventAt: Date): Date[] {
  const day = 24 * 60 * 60 * 1000;
  const offsets: Record<ReminderKind, number[]> = {
    appointment: [-7 * day, -day, -2 * 60 * 60 * 1000],
    fdd_review: [0],
    passport_check: [-30 * day, -7 * day, -day],
    visa_check: [-30 * day, -7 * day, -day],
    i94_check: [-30 * day, -7 * day, -day],
    business_deadline: [-7 * day, -day],
  };
  const future = offsets[kind]
    .map((offset) => new Date(eventAt.getTime() + offset))
    .filter((date) => date.getTime() > Date.now());
  return future.length > 0 ? future : [eventAt];
}

function createLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildPrototypeNotifications(
  role: 'investor' | 'partner' | 'attorney',
  locale: 'en' | 'es',
): PathNotification[] {
  const now = new Date();
  const common: PathNotification[] = locale === 'es' ? [
    prototypeNotification('00000000-0000-4000-8000-000000000001', 'next_action', 'Su próximo paso está listo', 'Revise la oportunidad comercial y guarde sus preguntas para New Dawn.', now),
    prototypeNotification('00000000-0000-4000-8000-000000000002', 'embassy', 'Seleccione el consulado que desea seguir', 'Reciba cambios revisados en los procedimientos oficiales que correspondan a su puesto seleccionado.', now, stateDepartmentSource('Departamento de Estado de EE. UU.')),
    prototypeNotification('00000000-0000-4000-8000-000000000003', 'weekly_digest', 'Resumen semanal de Mi Camino', 'Una acción, un cambio importante y una fecha próxima, reunidos en un solo lugar.', now),
  ] : [
    prototypeNotification('00000000-0000-4000-8000-000000000001', 'next_action', 'Your next step is ready', 'Review the business opportunity and save your questions for New Dawn.', now),
    prototypeNotification('00000000-0000-4000-8000-000000000002', 'embassy', 'Choose the embassy you want to follow', 'Receive reviewed changes to official procedures for your selected post.', now, stateDepartmentSource('U.S. Department of State')),
    prototypeNotification('00000000-0000-4000-8000-000000000003', 'weekly_digest', 'Your weekly My Path digest', 'One action, one important change, and one upcoming date—together in one place.', now),
  ];
  if (role === 'partner') {
    common[0] = prototypeNotification('00000000-0000-4000-8000-000000000004', 'referral', locale === 'es' ? 'Su espacio de referencias está listo' : 'Your referral workspace is ready', locale === 'es' ? 'Complete la capacitación antes de enviar una referencia con permiso.' : 'Complete training before submitting a permission-based referral.', now);
  }
  if (role === 'attorney') {
    common[0] = prototypeNotification('00000000-0000-4000-8000-000000000005', 'secure_status', locale === 'es' ? 'Recursos empresariales disponibles' : 'Business resources are available', locale === 'es' ? 'Revise materiales comerciales sin conclusiones migratorias.' : 'Review business materials without immigration conclusions.', now);
  }
  return common;
}

function stateDepartmentSource(label: string): PathNotification['source'] {
  return {
    label,
    url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html',
    publishedAt: null,
  };
}

function prototypeNotification(
  id: string,
  category: PathNotification['category'],
  title: string,
  body: string,
  date: Date,
  source: PathNotification['source'] = null,
): PathNotification {
  return {
    id,
    category,
    title,
    body,
    source,
    urgency: 'active',
    deepLink: '/notifications',
    availableAt: date.toISOString(),
    readAt: null,
    createdAt: date.toISOString(),
  };
}

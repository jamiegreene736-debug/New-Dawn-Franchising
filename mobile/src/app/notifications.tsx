import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePathNotifications } from '@/notifications/notification-context';
import { usePrototype } from '@/prototype/prototype-context';
import type { NotificationCategory, ReminderKind } from '@/services/auth-client';
import { Button, Callout, Card, PageHeader, Screen, SectionHeader, StatusPill } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { language } = usePrototype();
  const copy = COPY[language];
  const {
    permission,
    notifications,
    reminders,
    unreadCount,
    error,
    enableNotifications,
    markRead,
    cancelReminder,
    refresh,
  } = usePathNotifications();

  return (
    <Screen refreshControl={undefined}>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryNumber}>{unreadCount}</Text>
            <Text style={styles.summaryLabel}>{copy.newUpdates}</Text>
          </View>
          <StatusPill
            label={permission === 'granted' ? copy.enabled : copy.setupNeeded}
            tone={permission === 'granted' ? 'success' : 'warning'}
          />
        </View>
        <Text style={styles.summaryBody}>{copy.summaryBody}</Text>
      </Card>

      {permission !== 'granted' && permission !== 'unavailable' ? (
        <Callout title={copy.turnOnTitle} body={copy.turnOnBody} tone="info" />
      ) : null}
      {permission !== 'granted' && permission !== 'unavailable' ? (
        <Button label={copy.turnOnAction} onPress={() => void enableNotifications()} />
      ) : null}
      {error ? <Callout title={copy.connectionTitle} body={error} tone="warning" /> : null}

      <View style={styles.actions}>
        <Button label={copy.addReminder} onPress={() => router.push('/add-reminder')} />
        <Button label={copy.settings} variant="secondary" onPress={() => router.push('/notification-settings')} />
      </View>

      <SectionHeader title={copy.updates} action={<Pressable onPress={() => void refresh()}><Text style={styles.textAction}>{copy.refresh}</Text></Pressable>} />
      {notifications.length === 0 ? <Callout title={copy.allCaughtUp} body={copy.noUpdates} tone="success" /> : null}
      {notifications.map((notification) => (
        <Pressable
          accessibilityRole="button"
          key={notification.id}
          onPress={() => void markRead(notification.id)}
          style={({ pressed }) => pressed && styles.pressed}>
          <Card style={!notification.readAt ? styles.unreadCard : undefined}>
            <View style={styles.itemTop}>
              <StatusPill label={categoryLabel(notification.category, language)} tone={!notification.readAt ? 'warning' : 'neutral'} />
              <Text style={styles.time}>{new Date(notification.availableAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.itemTitle}>{notification.title}</Text>
            <Text style={styles.itemBody}>{notification.body}</Text>
            {notification.source ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(notification.source!.url)}
                style={styles.sourceLink}>
                <Text style={styles.sourceText}>{copy.reviewedSource}: {notification.source.label} ↗</Text>
              </Pressable>
            ) : null}
            {!notification.readAt ? <Text style={styles.tapHint}>{copy.tapRead}</Text> : null}
          </Card>
        </Pressable>
      ))}

      <SectionHeader title={copy.savedReminders} />
      {reminders.length === 0 ? <Text style={styles.emptyText}>{copy.noReminders}</Text> : null}
      {reminders.map((reminder) => (
        <Card key={reminder.id} style={styles.reminderCard}>
          <View style={styles.reminderCopy}>
            <Text style={styles.itemTitle}>{reminderLabel(reminder.kind, language)}</Text>
            <Text style={styles.itemBody}>{new Date(reminder.eventAt).toLocaleString()}</Text>
          </View>
          <Button label={copy.remove} variant="quiet" onPress={() => void cancelReminder(reminder.id)} />
        </Card>
      ))}

      <Callout title={copy.privacyTitle} body={copy.privacyBody} tone="info" />
    </Screen>
  );
}

const COPY = {
  en: {
    eyebrow: 'YOUR PATH WATCHLIST', title: 'Alerts that lead to action',
    body: 'See what changed, why it matters, the source, and your safest next step.',
    newUpdates: 'unread updates', enabled: 'Notifications on', setupNeeded: 'Setup needed',
    summaryBody: 'New Dawn watches your selected sources and pathway. Government changes are reviewed before they appear here.',
    turnOnTitle: 'Get reminders at the right moment', turnOnBody: 'Enable notifications after choosing what you want New Dawn to watch.', turnOnAction: 'Enable notifications',
    connectionTitle: 'Using saved information', addReminder: 'Add an important date', settings: 'Choose what I follow',
    updates: 'Latest updates', refresh: 'Refresh', allCaughtUp: 'You’re caught up', noUpdates: 'There are no new updates right now.',
    reviewedSource: 'Reviewed source', tapRead: 'Tap to mark as read', savedReminders: 'Saved reminders',
    noReminders: 'No dates saved yet.', remove: 'Remove', privacyTitle: 'Private by design',
    privacyBody: 'Lock-screen alerts never show visa details, investment amounts, referral identities, or document names. Open the app to see authenticated details.',
  },
  es: {
    eyebrow: 'VIGILANCIA DE SU CAMINO', title: 'Alertas que llevan a una acción',
    body: 'Vea qué cambió, por qué importa, la fuente y el próximo paso más seguro.',
    newUpdates: 'actualizaciones sin leer', enabled: 'Notificaciones activas', setupNeeded: 'Configuración pendiente',
    summaryBody: 'New Dawn vigila las fuentes y el camino que usted seleccione. Los cambios gubernamentales se revisan antes de aparecer aquí.',
    turnOnTitle: 'Reciba recordatorios en el momento indicado', turnOnBody: 'Active las notificaciones después de elegir lo que desea que New Dawn vigile.', turnOnAction: 'Activar notificaciones',
    connectionTitle: 'Usando información guardada', addReminder: 'Agregar una fecha importante', settings: 'Elegir qué seguir',
    updates: 'Actualizaciones recientes', refresh: 'Actualizar', allCaughtUp: 'Todo está al día', noUpdates: 'No hay actualizaciones nuevas.',
    reviewedSource: 'Fuente revisada', tapRead: 'Toque para marcar como leída', savedReminders: 'Recordatorios guardados',
    noReminders: 'Aún no hay fechas guardadas.', remove: 'Eliminar', privacyTitle: 'Privacidad por diseño',
    privacyBody: 'Las alertas en la pantalla bloqueada nunca muestran detalles de visa, montos de inversión, identidades de referidos ni nombres de documentos. Abra la aplicación para ver los detalles autenticados.',
  },
} as const;

const CATEGORY_LABELS: Record<NotificationCategory, { en: string; es: string }> = {
  next_action: { en: 'Next action', es: 'Próxima acción' },
  appointment: { en: 'Appointment', es: 'Cita' },
  fdd: { en: 'FDD', es: 'FDD' },
  embassy: { en: 'Embassy', es: 'Consulado' },
  expiration: { en: 'Important date', es: 'Fecha importante' },
  secure_status: { en: 'Status', es: 'Estado' },
  opportunity: { en: 'Opportunity', es: 'Oportunidad' },
  weekly_digest: { en: 'Weekly digest', es: 'Resumen semanal' },
  referral: { en: 'Referral', es: 'Referido' },
  owner_operations: { en: 'Business operations', es: 'Operaciones' },
};

const REMINDER_LABELS: Record<ReminderKind, { en: string; es: string }> = {
  appointment: { en: 'Confirmed appointment', es: 'Cita confirmada' },
  fdd_review: { en: 'Recorded FDD review date', es: 'Fecha registrada de revisión del FDD' },
  passport_check: { en: 'Passport date check', es: 'Revisión de fecha del pasaporte' },
  visa_check: { en: 'Visa date check', es: 'Revisión de fecha de visa' },
  i94_check: { en: 'Official I-94 record check', es: 'Revisión del registro oficial I-94' },
  business_deadline: { en: 'Business deadline', es: 'Fecha límite comercial' },
};

function categoryLabel(category: NotificationCategory, language: 'en' | 'es'): string {
  return CATEGORY_LABELS[category][language];
}

function reminderLabel(kind: ReminderKind, language: 'en' | 'es'): string {
  return REMINDER_LABELS[kind][language];
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: brand.navy, borderColor: brand.navy, gap: spacing.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  summaryCopy: { flex: 1 },
  summaryNumber: { ...type.display, color: brand.gold },
  summaryLabel: { ...type.caption, color: brand.white },
  summaryBody: { ...type.body, color: '#DDE8F0' },
  actions: { gap: spacing.sm },
  textAction: { ...type.label, color: brand.blue },
  pressed: { opacity: 0.75 },
  unreadCard: { borderColor: brand.gold, backgroundColor: brand.goldWash },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  time: { ...type.caption, color: brand.slate },
  itemTitle: { ...type.subheading, color: brand.ink, marginTop: spacing.sm },
  itemBody: { ...type.body, color: brand.slate, marginTop: spacing.xs },
  sourceLink: { marginTop: spacing.md, paddingVertical: spacing.xs },
  sourceText: { ...type.caption, color: brand.blue },
  tapHint: { ...type.caption, color: brand.warning, marginTop: spacing.sm },
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reminderCopy: { flex: 1 },
  emptyText: { ...type.body, color: brand.slate },
});

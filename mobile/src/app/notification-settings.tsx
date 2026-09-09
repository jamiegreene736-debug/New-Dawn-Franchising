import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { usePathNotifications } from '@/notifications/notification-context';
import { usePrototype } from '@/prototype/prototype-context';
import type { NotificationPreferences } from '@/services/auth-client';
import { Button, Callout, Card, FormField, PageHeader, Screen, SectionHeader } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

type Preferences = Omit<NotificationPreferences, 'updatedAt'>;
type BooleanPreference = {
  [Key in keyof Preferences]: Preferences[Key] extends boolean ? Key : never
}[keyof Preferences];

export default function NotificationSettingsScreen() {
  const { language } = usePrototype();
  const notificationState = usePathNotifications();
  return (
    <NotificationSettingsForm
      key={JSON.stringify(notificationState.preferences)}
      language={language}
      notificationState={notificationState}
    />
  );
}

function NotificationSettingsForm({ language, notificationState }: {
  language: 'en' | 'es';
  notificationState: ReturnType<typeof usePathNotifications>;
}) {
  const copy = COPY[language];
  const { preferences, permission, enableNotifications, updatePreferences } = notificationState;
  const [draft, setDraft] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: BooleanPreference) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: !current[key] }));
  };
  const save = async () => {
    setSaving(true);
    await updatePreferences({
      ...draft,
      followedEmbassyPost: draft.followedEmbassyPost?.trim() || null,
    });
    setSaved(true);
    setSaving(false);
  };

  return (
    <Screen>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
      {permission !== 'granted' && permission !== 'unavailable' ? (
        <Card style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>{copy.permissionTitle}</Text>
          <Text style={styles.permissionBody}>{copy.permissionBody}</Text>
          <Button label={copy.permissionAction} onPress={() => void enableNotifications()} />
        </Card>
      ) : null}

      <SectionHeader title={copy.personal} />
      <Card>
        <PreferenceRow label={copy.nextAction} detail={copy.nextActionDetail} value={draft.nextAction} onChange={() => toggle('nextAction')} />
        <PreferenceRow label={copy.appointments} detail={copy.appointmentsDetail} value={draft.appointments} onChange={() => toggle('appointments')} />
        <PreferenceRow label={copy.fdd} detail={copy.fddDetail} value={draft.fdd} onChange={() => toggle('fdd')} />
        <PreferenceRow label={copy.expiration} detail={copy.expirationDetail} value={draft.expiration} onChange={() => toggle('expiration')} />
        <PreferenceRow label={copy.secureStatus} detail={copy.secureStatusDetail} value={draft.secureStatus} onChange={() => toggle('secureStatus')} />
      </Card>

      <SectionHeader title={copy.watchlist} />
      <Card style={styles.formCard}>
        <PreferenceRow label={copy.embassy} detail={copy.embassyDetail} value={draft.embassy} onChange={() => toggle('embassy')} />
        {draft.embassy ? (
          <FormField
            label={copy.embassyPost}
            placeholder={copy.embassyPlaceholder}
            value={draft.followedEmbassyPost ?? ''}
            onChangeText={(followedEmbassyPost) => {
              setSaved(false);
              setDraft((current) => ({ ...current, followedEmbassyPost }));
            }}
            autoCapitalize="words"
          />
        ) : null}
        <PreferenceRow label={copy.weeklyDigest} detail={copy.weeklyDigestDetail} value={draft.weeklyDigest} onChange={() => toggle('weeklyDigest')} />
        <PreferenceRow label={copy.opportunities} detail={copy.opportunitiesDetail} value={draft.opportunities} onChange={() => toggle('opportunities')} />
      </Card>

      <SectionHeader title={copy.roleAlerts} />
      <Card>
        <PreferenceRow label={copy.referrals} detail={copy.referralsDetail} value={draft.referrals} onChange={() => toggle('referrals')} />
        <PreferenceRow label={copy.ownerOperations} detail={copy.ownerOperationsDetail} value={draft.ownerOperations} onChange={() => toggle('ownerOperations')} />
      </Card>

      <Callout title={copy.quietTitle} body={copy.quietBody} tone="info" />
      <Callout title={copy.sourceTitle} body={copy.sourceBody} tone="success" />
      {saved ? <Callout title={copy.savedTitle} body={copy.savedBody} tone="success" /> : null}
      <Button label={copy.save} loading={saving} onPress={() => void save()} />
    </Screen>
  );
}

function PreferenceRow({ label, detail, value, onChange }: {
  label: string;
  detail: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: brand.mist, true: '#9BB8CB' }}
        thumbColor={value ? brand.navy : brand.white}
      />
    </View>
  );
}

const COPY = {
  en: {
    eyebrow: 'NOTIFICATION CONTROLS', title: 'Choose what New Dawn watches',
    body: 'Keep high-value alerts on and turn off anything that is not useful to you.',
    permissionTitle: 'Notifications are not enabled yet', permissionBody: 'Your choices can be saved now. iPhone permission is requested only when you decide the alerts are useful.', permissionAction: 'Enable on this iPhone',
    personal: 'My pathway', nextAction: 'My next action', nextActionDetail: 'The most useful action for your current stage.',
    appointments: 'Appointments', appointmentsDetail: 'Seven days, 24 hours, and two hours before confirmed meetings.',
    fdd: 'FDD milestones', fddDetail: 'Recorded delivery, review-date, and updated-document alerts.',
    expiration: 'Passport, visa, and I-94 checks', expirationDetail: 'Private reminders to check current official records.',
    secureStatus: 'Secure status and documents', secureStatusDetail: 'Business-side review, receipt, and document-ready events.',
    watchlist: 'Official watchlist and digest', embassy: 'Embassy and consulate changes', embassyDetail: 'Human-reviewed procedure changes for your selected post.',
    embassyPost: 'Embassy or consulate to follow', embassyPlaceholder: 'Example: U.S. Embassy London',
    weeklyDigest: 'Weekly My Path digest', weeklyDigestDetail: 'One next action, one change, and one approaching date.',
    opportunities: 'Opportunity and territory matches', opportunitiesDetail: 'Optional marketing alerts based on saved business preferences.',
    roleAlerts: 'Role-specific updates', referrals: 'Referral updates', referralsDetail: 'Permissioned, business-side updates for referral professionals.',
    ownerOperations: 'Owner operations', ownerOperationsDetail: 'Licensing, insurance, training, and operating deadlines after launch.',
    quietTitle: 'Quiet hours', quietBody: 'Routine alerts are held from 9:00 PM to 8:00 AM in your current time zone. Only genuinely time-sensitive events may arrive immediately.',
    sourceTitle: 'Reviewed before delivery', sourceBody: 'Government changes require an approved official source and recorded human review. Public wait-time estimates are never presented as guaranteed appointment availability.',
    savedTitle: 'Preferences saved', savedBody: 'Your watchlist has been updated.', save: 'Save notification choices',
  },
  es: {
    eyebrow: 'CONTROLES DE NOTIFICACIÓN', title: 'Elija lo que New Dawn debe vigilar',
    body: 'Mantenga activas las alertas de alto valor y desactive las que no le resulten útiles.',
    permissionTitle: 'Las notificaciones aún no están activas', permissionBody: 'Puede guardar sus opciones ahora. El permiso del iPhone se solicita solo cuando usted decide que las alertas son útiles.', permissionAction: 'Activar en este iPhone',
    personal: 'Mi camino', nextAction: 'Mi próxima acción', nextActionDetail: 'La acción más útil para su etapa actual.',
    appointments: 'Citas', appointmentsDetail: 'Siete días, 24 horas y dos horas antes de las reuniones confirmadas.',
    fdd: 'Hitos del FDD', fddDetail: 'Alertas de entrega registrada, fecha de revisión y documentos actualizados.',
    expiration: 'Revisiones de pasaporte, visa e I-94', expirationDetail: 'Recordatorios privados para revisar los registros oficiales actuales.',
    secureStatus: 'Estado y documentos seguros', secureStatusDetail: 'Revisiones comerciales, recibos y documentos disponibles.',
    watchlist: 'Vigilancia oficial y resumen', embassy: 'Cambios en embajadas y consulados', embassyDetail: 'Cambios de procedimiento revisados por personas para el puesto seleccionado.',
    embassyPost: 'Embajada o consulado que desea seguir', embassyPlaceholder: 'Ejemplo: Embajada de EE. UU. en Londres',
    weeklyDigest: 'Resumen semanal de Mi Camino', weeklyDigestDetail: 'Una próxima acción, un cambio y una fecha cercana.',
    opportunities: 'Coincidencias de oportunidades y territorios', opportunitiesDetail: 'Alertas comerciales opcionales según sus preferencias guardadas.',
    roleAlerts: 'Actualizaciones según su función', referrals: 'Actualizaciones de referidos', referralsDetail: 'Actualizaciones comerciales autorizadas para profesionales de referidos.',
    ownerOperations: 'Operaciones del propietario', ownerOperationsDetail: 'Licencias, seguros, capacitación y fechas operativas después del lanzamiento.',
    quietTitle: 'Horario de silencio', quietBody: 'Las alertas rutinarias se retienen de 9:00 p. m. a 8:00 a. m. en su zona horaria. Solo los eventos realmente urgentes pueden llegar de inmediato.',
    sourceTitle: 'Revisado antes de enviarse', sourceBody: 'Los cambios gubernamentales requieren una fuente oficial aprobada y una revisión humana registrada. Las estimaciones públicas nunca se presentan como disponibilidad garantizada.',
    savedTitle: 'Preferencias guardadas', savedBody: 'Su lista de vigilancia se actualizó.', save: 'Guardar opciones de notificación',
  },
} as const;

const styles = StyleSheet.create({
  permissionCard: { backgroundColor: brand.goldWash, borderColor: '#E7D49E', gap: spacing.md },
  permissionTitle: { ...type.subheading, color: brand.ink },
  permissionBody: { ...type.body, color: brand.slate },
  formCard: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.line },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.label, color: brand.ink },
  rowDetail: { ...type.caption, color: brand.slate, marginTop: spacing.xs },
});

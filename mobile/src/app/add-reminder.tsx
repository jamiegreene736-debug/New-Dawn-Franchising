import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { usePathNotifications } from '@/notifications/notification-context';
import { usePrototype } from '@/prototype/prototype-context';
import type { ReminderKind } from '@/services/auth-client';
import { Button, Callout, ChoiceCard, FormField, PageHeader, Screen, SectionHeader } from '@/ui/components';

export default function AddReminderScreen() {
  const router = useRouter();
  const { language } = usePrototype();
  const copy = COPY[language];
  const { addReminder } = usePathNotifications();
  const initial = useMemo(() => initialDateParts(), []);
  const [kind, setKind] = useState<ReminderKind>('appointment');
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError('');
    const enteredDate = parseLocalDate(date, time);
    if (!enteredDate) {
      setError(copy.invalidDate);
      return;
    }
    const eventAt = kind === 'fdd_review'
      ? new Date(enteredDate.getTime() + 14 * 24 * 60 * 60 * 1000)
      : enteredDate;
    setBusy(true);
    try {
      await addReminder(kind, eventAt);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
      <SectionHeader title={copy.chooseType} />
      {REMINDERS.map((reminder) => (
        <ChoiceCard
          key={reminder.kind}
          title={reminder[language].title}
          body={reminder[language].body}
          selected={kind === reminder.kind}
          onPress={() => setKind(reminder.kind)}
        />
      ))}
      <SectionHeader title={kind === 'fdd_review' ? copy.fddDelivery : copy.dateTime} />
      <FormField
        label={copy.date}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        keyboardType="numbers-and-punctuation"
      />
      <FormField
        label={copy.time}
        placeholder="HH:MM"
        value={time}
        onChangeText={setTime}
        keyboardType="numbers-and-punctuation"
      />
      {kind === 'fdd_review' ? <Callout title={copy.fddTitle} body={copy.fddBody} tone="warning" /> : null}
      {kind === 'i94_check' ? <Callout title={copy.i94Title} body={copy.i94Body} tone="warning" /> : null}
      {error ? <Callout title={copy.problem} body={error} tone="warning" /> : null}
      <Button label={copy.save} loading={busy} onPress={() => void save()} />
      <Callout title={copy.privacyTitle} body={copy.privacyBody} tone="info" />
    </Screen>
  );
}

const REMINDERS: {
  kind: ReminderKind;
  en: { title: string; body: string };
  es: { title: string; body: string };
}[] = [
  { kind: 'appointment', en: { title: 'Confirmed appointment', body: 'Remind me seven days, 24 hours, and two hours before.' }, es: { title: 'Cita confirmada', body: 'Recordarme siete días, 24 horas y dos horas antes.' } },
  { kind: 'fdd_review', en: { title: 'FDD delivery date', body: 'Record when the FDD was delivered and remind me 14 calendar days later.' }, es: { title: 'Fecha de entrega del FDD', body: 'Registrar cuándo se entregó el FDD y recordarme 14 días naturales después.' } },
  { kind: 'passport_check', en: { title: 'Passport date', body: 'Remind me 30 days, seven days, and one day before.' }, es: { title: 'Fecha del pasaporte', body: 'Recordarme 30 días, siete días y un día antes.' } },
  { kind: 'visa_check', en: { title: 'Visa date', body: 'Save a private date-check reminder without making a legal conclusion.' }, es: { title: 'Fecha de visa', body: 'Guardar un recordatorio privado sin emitir una conclusión legal.' } },
  { kind: 'i94_check', en: { title: 'I-94 official-record check', body: 'Remind me to check the current official CBP record.' }, es: { title: 'Revisión del registro oficial I-94', body: 'Recordarme revisar el registro oficial actual de CBP.' } },
  { kind: 'business_deadline', en: { title: 'Business deadline', body: 'Use for licensing, insurance, training, or another operating date.' }, es: { title: 'Fecha límite comercial', body: 'Para licencias, seguros, capacitación u otra fecha operativa.' } },
];

const COPY = {
  en: {
    eyebrow: 'PRIVATE DATE REMINDER', title: 'Protect an important date',
    body: 'Choose a category and date. The lock screen will show only a generic New Dawn update.',
    chooseType: 'What should we remember?', dateTime: 'Date and time', fddDelivery: 'Recorded delivery date and time',
    date: 'Date', time: 'Time', fddTitle: 'A review-date reminder, not legal clearance',
    fddBody: 'New Dawn will calculate 14 calendar days from the date you record. Confirm the actual delivery record and all signing or payment decisions with franchise counsel.',
    i94Title: 'Check the official record', i94Body: 'This reminder does not calculate or determine immigration status. Always check CBP’s current official I-94 record and consult independent counsel when needed.',
    invalidDate: 'Enter a valid date as YYYY-MM-DD and time as HH:MM.', failed: 'The reminder could not be created.',
    problem: 'Reminder not saved', save: 'Save private reminder', privacyTitle: 'No sensitive lock-screen text',
    privacyBody: 'The alert says only that your New Dawn pathway has an update. Details appear after you open the app.',
  },
  es: {
    eyebrow: 'RECORDATORIO PRIVADO', title: 'Proteja una fecha importante',
    body: 'Elija una categoría y fecha. La pantalla bloqueada mostrará solo una actualización genérica de New Dawn.',
    chooseType: '¿Qué debemos recordar?', dateTime: 'Fecha y hora', fddDelivery: 'Fecha y hora de entrega registrada',
    date: 'Fecha', time: 'Hora', fddTitle: 'Un recordatorio de revisión, no una autorización legal',
    fddBody: 'New Dawn calculará 14 días naturales desde la fecha registrada. Confirme el registro real y cualquier decisión de firma o pago con un abogado de franquicias.',
    i94Title: 'Revise el registro oficial', i94Body: 'Este recordatorio no calcula ni determina su estatus migratorio. Revise siempre el registro I-94 oficial de CBP y consulte a un abogado independiente cuando sea necesario.',
    invalidDate: 'Ingrese una fecha válida como AAAA-MM-DD y una hora como HH:MM.', failed: 'No se pudo crear el recordatorio.',
    problem: 'Recordatorio no guardado', save: 'Guardar recordatorio privado', privacyTitle: 'Sin texto sensible en la pantalla bloqueada',
    privacyBody: 'La alerta solo indica que hay una actualización en su camino de New Dawn. Los detalles aparecen al abrir la aplicación.',
  },
} as const;

function initialDateParts(): { date: string; time: string } {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: '09:00' };
}

function parseLocalDate(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;
  return parsed;
}

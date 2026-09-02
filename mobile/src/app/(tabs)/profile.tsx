import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { runtimeConfig } from '@/config/runtime';
import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, Card, PageHeader, Screen, SectionHeader, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { role, language, resetPrototype } = usePrototype();
  const { account, signOut, requestDeletion } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const restart = () => { resetPrototype(); router.replace('/'); };

  if (runtimeConfig.mode === 'connected') {
    const leave = async () => {
      setBusy(true);
      setError('');
      await signOut();
      setBusy(false);
      router.replace('/');
    };
    const confirmDeletion = () => Alert.alert(
      'Request account deletion?',
      'This signs you out and places the pilot account into the deletion review queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: () => void (async () => {
            setBusy(true);
            setError('');
            try {
              await requestDeletion();
              router.replace('/');
            } catch {
              setError('The deletion request could not be submitted. Please try again.');
            } finally {
              setBusy(false);
            }
          })(),
        },
      ],
    );

    return (
      <Screen>
        <PageHeader eyebrow="PILOT ACCOUNT" title={account?.roles.includes('partner') ? 'Referral partner' : 'Investor'} body="Your authentication is connected to the isolated New Dawn staging environment." />
        <Card>
          <StatusRow title="Email" detail={account?.email ?? 'Session unavailable'} state="Verified" tone="success" />
          <StatusRow title="Current session" detail="Securely stored on this device" state="Active" tone="success" />
          <StatusRow title="Environment" detail="No production customer data or provider actions" state="Staging" tone="warning" />
        </Card>
        {error ? <Callout title="Account problem" body={error} tone="warning" /> : null}
        <SectionHeader title="Privacy and control" />
        <Callout title="Pilot data rule" body="Do not upload passports, bank details, tax records, or confidential immigration documents during testing." tone="info" />
        <Button label="Sign out" variant="secondary" onPress={() => void leave()} loading={busy} />
        <Button label="Request account deletion" variant="danger" onPress={confirmDeletion} disabled={busy} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader eyebrow="PROTOTYPE PROFILE" title={role === 'investor' ? 'Investor preview' : role === 'partner' ? 'Partner preview' : 'Attorney preview'} body="Production accounts will provide verified identity, device sessions, notification controls, privacy records, and account deletion." />
      <Card>
        <StatusRow title="Language" detail="Controlling content must be complete in the selected locale" state={language === 'es' ? 'Español' : 'English'} />
        <StatusRow title="Email" detail="prototype@example.test" state="Verified" tone="success" />
        <StatusRow title="Current session" detail="This prototype device" state="Active" tone="success" />
        <StatusRow title="Notifications" detail="No push service connected in prototype" state="Mock only" />
      </Card>
      <SectionHeader title="Privacy and control" />
      <Card>
        <Text style={styles.link}>Privacy summary and data use</Text>
        <Text style={styles.link}>Professional and legal boundaries</Text>
        <Text style={styles.link}>Device and session management</Text>
        <Text style={styles.link}>Request account deletion</Text>
      </Card>
      <Callout title="Mock data only" body="This prototype does not create an account, write to the New Dawn database, send messages, or schedule appointments." tone="info" />
      <Button label="Restart and choose another role" variant="secondary" onPress={restart} />
      <Button label="Preview account deletion" variant="danger" onPress={() => undefined} />
    </Screen>
  );
}

const styles = StyleSheet.create({ link: { ...type.body, color: brand.blue, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.line } });

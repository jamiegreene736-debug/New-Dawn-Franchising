import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, Card, PageHeader, Screen, SectionHeader, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { role, language, resetPrototype } = usePrototype();
  const restart = () => { resetPrototype(); router.replace('/'); };
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

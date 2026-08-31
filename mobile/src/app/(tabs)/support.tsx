import { StyleSheet, Text } from 'react-native';

import { Button, Callout, Card, PageHeader, Screen, SectionHeader, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function SupportScreen() {
  return (
    <Screen>
      <PageHeader eyebrow="HUMAN SUPPORT" title="Reach the right person" body="Ask a business question, schedule New Dawn, or find the correct professional boundary." />
      <Card style={styles.contactCard}>
        <Text style={styles.contactEyebrow}>YOUR NEW DAWN CONTACT</Text>
        <Text style={styles.contactName}>New Dawn Pathways Team</Text>
        <Text style={styles.contactBody}>Business opportunity, partner, appointment, and app support</Text>
        <Button label="Book a consultation" onPress={() => undefined} />
        <Button label="Start a support request" variant="secondary" onPress={() => undefined} />
      </Card>
      <Callout title="Please do not send sensitive documents" body="The MVP support experience is text-only. Do not send passports, financial records, tax information, immigration filings, source-of-funds evidence, or legal documents." tone="warning" />
      <SectionHeader title="Common next steps" />
      <Card>
        <StatusRow title="Business model question" detail="New Dawn business-support team" state="New Dawn" />
        <StatusRow title="Visa eligibility or filing question" detail="Your independent immigration counsel" state="Counsel" />
        <StatusRow title="Privacy or account deletion" detail="New Dawn privacy workflow" state="Privacy" />
        <StatusRow title="Urgent safety or emergency" detail="Use local emergency services; this app is not monitored for emergencies" state="External" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contactCard: { gap: spacing.sm },
  contactEyebrow: { ...type.caption, color: brand.blue, letterSpacing: 1.2 },
  contactName: { ...type.heading, color: brand.ink },
  contactBody: { ...type.body, color: brand.slate, marginBottom: spacing.sm },
});

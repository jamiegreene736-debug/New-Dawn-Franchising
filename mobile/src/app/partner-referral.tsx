import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, Card, ChoiceCard, PageHeader, ProgressBar, Screen, StatusPill } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function PartnerReferralScreen() {
  const router = useRouter();
  const { referralSubmitted, submitReferral } = usePrototype();
  const [step, setStep] = useState(0);
  const [permission, setPermission] = useState(false);
  const [timing, setTiming] = useState(0);
  const submit = () => { submitReferral(); setStep(2); };

  if (referralSubmitted || step === 2) {
    return (
      <Screen>
        <PageHeader eyebrow="REFERRAL RECEIPT" title="Duplicate review required" body="The introduction was safely received. New Dawn will review a possible prior contact without revealing another partner's identity." />
        <Card style={styles.receipt}>
          <StatusPill label="Under review" tone="warning" />
          <Text style={styles.receiptId}>Receipt NDP-DEMO-1042</Text>
          <Text style={styles.receiptBody}>Recorded August 30, 2026 · 2:42 PM ET</Text>
          <Text style={styles.receiptBody}>Expected New Dawn action: within one business day</Text>
        </Card>
        <Callout title="What happens next" body="New Dawn will resolve attribution and contact safety internally. You will receive only the approved outcome and next action." tone="info" />
        <Button label="View referral" onPress={() => router.replace('/(tabs)/explore')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ProgressBar value={step === 0 ? 50 : 100} label={`Step ${step + 1} of 2`} />
      {step === 0 ? (
        <>
          <PageHeader eyebrow="CLIENT PERMISSION" title="Confirm permission first" body="Before sharing contact details, confirm that the person asked you to connect them with New Dawn or clearly agreed to the introduction." />
          <Callout title="Do not include sensitive information" body="Do not send passports, financial records, tax information, immigration filings, source-of-funds evidence, or legal advice." tone="warning" />
          <ChoiceCard title="I have permission to make this introduction" body="The person agreed that I may share their name, contact information, preferred language, and general business timing with New Dawn." selected={permission} onPress={() => setPermission((value) => !value)} />
          <Button label="Continue" onPress={() => setStep(1)} disabled={!permission} />
        </>
      ) : (
        <>
          <PageHeader eyebrow="SAMPLE REFERRAL" title="Review the minimum details" body="The prototype uses fictional contact information. Production submission will require validated, purpose-limited fields." />
          <Card>
            <Text style={styles.fieldLabel}>Name</Text><Text style={styles.fieldValue}>Sofia Martinez</Text>
            <Text style={styles.fieldLabel}>Contact</Text><Text style={styles.fieldValue}>sofia@example.test · +1 (555) 010-2030</Text>
            <Text style={styles.fieldLabel}>Preferred language</Text><Text style={styles.fieldValue}>Spanish</Text>
          </Card>
          <Text style={styles.sectionTitle}>General timing</Text>
          <View style={styles.list} accessibilityRole="radiogroup">{['Exploring now', 'Planning within 6–12 months', 'Timing not yet known'].map((label, index) => <ChoiceCard key={label} title={label} body="Business timing only; no legal-status information collected." selected={timing === index} onPress={() => setTiming(index)} />)}</View>
          <Callout title="Duplicate-safe response" body="Submission may return Accepted, Duplicate review, or Prior contact. Another partner's identity is never disclosed." tone="info" />
          <Button label="Submit once and receive a receipt" onPress={submit} testID="submit-referral" />
          <Button label="Back" variant="quiet" onPress={() => setStep(0)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  fieldLabel: { ...type.caption, color: brand.slate, marginTop: spacing.sm },
  fieldValue: { ...type.body, color: brand.ink },
  sectionTitle: { ...type.heading, color: brand.ink, marginTop: spacing.sm },
  receipt: { gap: spacing.sm, backgroundColor: brand.goldWash },
  receiptId: { ...type.heading, color: brand.ink, marginTop: spacing.sm },
  receiptBody: { ...type.body, color: brand.slate },
});

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, Card, PageHeader, ProgressBar, Screen, SectionHeader, StatusPill, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function HomeScreen() {
  const { role } = usePrototype();
  if (role === 'partner') return <PartnerHome />;
  if (role === 'attorney') return <AttorneyHome />;
  return <InvestorHome />;
}

function InvestorHome() {
  const router = useRouter();
  return (
    <Screen>
      <PageHeader eyebrow="GOOD AFTERNOON" title="Your path is ready" body="Keep business tasks, professional handoffs, and confirmed receipts in one place." />
      <Card style={styles.heroCard}>
        <View style={styles.cardTop}><StatusPill label="Next action" tone="warning" /><Text style={styles.stepCount}>Step 1 of 8</Text></View>
        <Text style={styles.heroTitle}>Review the business model with New Dawn</Text>
        <Text style={styles.heroBody}>Learn the operating responsibilities, current opportunity information, and diligence process before making any decision.</Text>
        <Button label="Review opportunity" onPress={() => router.push('/(tabs)/explore')} />
      </Card>
      <ProgressBar value={18} label="My Path progress · 1 milestone complete" />
      <SectionHeader title="Your current status" />
      <Card>
        <StatusRow title="Readiness assessment" detail="Result viewed and saved" state="Completed" tone="success" />
        <StatusRow title="Independent counsel" detail="You control this professional relationship" state="Your action" tone="warning" />
        <StatusRow title="Business consultation" detail="No appointment has been confirmed" state="Not booked" />
      </Card>
      <Callout title="Honest status by design" body="Requested, sent, scheduled, pending, and completed are kept separate. Every completed milestone requires an authoritative receipt." tone="info" />
      <Button label="Book a New Dawn consultation" onPress={() => router.push('/(tabs)/support')} variant="secondary" />
    </Screen>
  );
}

function PartnerHome() {
  const router = useRouter();
  const { partnerStatus, partnerTrainingComplete, approvePartnerPreview, completePartnerTraining } = usePrototype();
  const approved = partnerStatus === 'approved';
  return (
    <Screen>
      <PageHeader eyebrow="PARTNER WORKSPACE" title={approved ? 'You are approved to continue' : 'Application received'} body={approved ? 'Complete current requirements before registering a referral.' : 'New Dawn is reviewing professional fit, jurisdiction, and compliance information.'} />
      <Card style={approved ? styles.successCard : styles.heroCard}>
        <View style={styles.cardTop}><StatusPill label={approved ? 'Approved' : 'Under review'} tone={approved ? 'success' : 'warning'} /><Text style={styles.stepCount}>Prototype state</Text></View>
        <Text style={styles.heroTitle}>{approved ? 'Finish partner training' : 'No client information is needed yet'}</Text>
        <Text style={styles.heroBody}>{approved ? 'Review approved claims, permission, FDD boundaries, and duplicate-safe referral handling.' : 'You cannot register clients until approval, a current agreement, and training are complete.'}</Text>
        {!approved ? <Button label="Preview approved workspace" onPress={approvePartnerPreview} /> : !partnerTrainingComplete ? <Button label="Complete training preview" onPress={completePartnerTraining} /> : <Button label="Register a permitted referral" onPress={() => router.push('/partner-referral')} />}
      </Card>
      <SectionHeader title="Requirements" />
      <Card>
        <StatusRow title="Application" detail="Professional and jurisdiction review" state={approved ? 'Approved' : 'Under review'} tone={approved ? 'success' : 'warning'} />
        <StatusRow title="Partner agreement" detail="Sample current version" state={approved ? 'Current' : 'Locked'} tone={approved ? 'success' : 'neutral'} />
        <StatusRow title="Claims and consent training" detail="Version 1.0 prototype" state={partnerTrainingComplete ? 'Completed' : approved ? 'Required' : 'Locked'} tone={partnerTrainingComplete ? 'success' : approved ? 'warning' : 'neutral'} />
      </Card>
      <Callout title="Attorney boundary" body="Independent immigration attorneys use a separate resource track. Compensation remains disabled by default." tone="warning" />
    </Screen>
  );
}

function AttorneyHome() {
  return (
    <Screen>
      <PageHeader eyebrow="INDEPENDENT COUNSEL" title="Business diligence, clearly separated" body="Access current New Dawn materials without being asked to endorse an opportunity or surrender independent judgment." />
      <Card style={styles.heroCard}>
        <StatusPill label="Resource access preview" tone="success" />
        <Text style={styles.heroTitle}>Counsel diligence pack</Text>
        <Text style={styles.heroBody}>Review the operating model, responsibility matrix, FDD request process, business-plan inputs, and approved claim boundaries.</Text>
        <Button label="Open resource library" onPress={() => undefined} />
      </Card>
      <Callout title="Uncompensated by default" body="New Dawn does not condition access, coordination, or professional judgment on attorney compensation or endorsement." tone="warning" />
      <SectionHeader title="Coordination" />
      <Card><Text style={styles.emptyTitle}>No client coordination invitations</Text><Text style={styles.emptyBody}>A client appears only after explicit permission. The MVP does not share immigration filings, financial records, or legal advice.</Text></Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { backgroundColor: brand.goldWash, borderColor: '#E7D49E', gap: spacing.md },
  successCard: { backgroundColor: brand.successWash, borderColor: '#B8DDCA', gap: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  stepCount: { ...type.caption, color: brand.slate },
  heroTitle: { ...type.heading, color: brand.ink },
  heroBody: { ...type.body, color: brand.slate },
  emptyTitle: { ...type.label, color: brand.ink },
  emptyBody: { ...type.body, color: brand.slate, marginTop: spacing.sm },
});

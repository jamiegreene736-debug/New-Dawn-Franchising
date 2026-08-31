import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, Card, PageHeader, Screen, SectionHeader, StatusPill, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function ExploreScreen() {
  const { role } = usePrototype();
  if (role === 'partner') return <ReferralList />;
  if (role === 'attorney') return <CounselResources />;
  return <InvestorExplore />;
}

function InvestorExplore() {
  const router = useRouter();
  return (
    <Screen>
      <PageHeader eyebrow="CURRENT APPROVED INFORMATION" title="Explore the business first" body="Compare practical responsibilities and questions for professional review. Availability and terms are always subject to current disclosures and signed agreements." />
      <Card style={styles.opportunityCard}>
        <View style={styles.row}><StatusPill label="Review with New Dawn" tone="warning" /><Text style={styles.updated}>Prototype copy</Text></View>
        <Text style={styles.title}>Property-management business opportunity</Text>
        <Text style={styles.body}>A service-business model with defined owner leadership, New Dawn support, and a structured diligence process.</Text>
        <View style={styles.facts}>
          <Fact label="Owner role" value="Leadership and oversight" />
          <Fact label="Location" value="Subject to current availability" />
          <Fact label="Legal review" value="Independent counsel" />
        </View>
        <Button label="Request current information" onPress={() => router.push('/(tabs)/support')} />
      </Card>
      <Callout title="No eligibility or outcome promise" body="New Dawn can explain its business opportunity. Only independent counsel can advise whether it fits your immigration facts." tone="warning" />
      <SectionHeader title="Learn before deciding" />
      <Card>
        <StatusRow title="Understanding the E-2 pathway" detail="General education with official source links" state="8 min" />
        <StatusRow title="Who owns each step" detail="Investor, New Dawn, and independent counsel" state="5 min" />
        <StatusRow title="Questions for your consultation" detail="A practical, non-legal checklist" state="4 min" />
      </Card>
    </Screen>
  );
}

function ReferralList() {
  const router = useRouter();
  const { partnerStatus, partnerTrainingComplete, referralSubmitted } = usePrototype();
  const canRefer = partnerStatus === 'approved' && partnerTrainingComplete;
  return (
    <Screen>
      <PageHeader eyebrow="YOUR REFERRALS ONLY" title="Referral workspace" body="Register a permitted introduction and track only the simplified status New Dawn has approved for partner visibility." />
      {referralSubmitted ? <Card><StatusRow title="Sofia Martinez" detail="Receipt NDP-DEMO-1042 · Last updated today" state="Duplicate review" tone="warning" /></Card> : <Card><Text style={styles.emptyTitle}>No referrals yet</Text><Text style={styles.emptyBody}>Once approved and trained, record client permission before submitting minimum contact details.</Text></Card>}
      <Button label="Register a permitted referral" onPress={() => router.push('/partner-referral')} disabled={!canRefer} />
      {!canRefer ? <Callout title="Registration is locked" body="Approval, a current agreement, and required training must be complete before client information can be submitted." tone="warning" /> : null}
    </Screen>
  );
}

function CounselResources() {
  return (
    <Screen>
      <PageHeader eyebrow="COUNSEL RESOURCE TRACK" title="Current business materials" body="Versioned resources for independent review. These materials do not replace the FDD, signed agreements, or official government sources." />
      <Card>
        <StatusRow title="Counsel diligence overview" detail="Roles, operating model, and review sequence" state="Current" tone="success" />
        <StatusRow title="FDD request and receipt process" detail="Controlling document flow" state="Current" tone="success" />
        <StatusRow title="Approved and prohibited claims" detail="New Dawn communication boundaries" state="Current" tone="success" />
        <StatusRow title="Business-plan inputs" detail="Business facts only; no legal conclusions" state="Current" tone="success" />
      </Card>
      <Callout title="Prototype content" body="Production resources require named franchise and immigration review owners, version dates, sources, and expiration controls." tone="info" />
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  opportunityCard: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  updated: { ...type.caption, color: brand.slate },
  title: { ...type.heading, color: brand.ink },
  body: { ...type.body, color: brand.slate },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: brand.line, paddingTop: spacing.sm },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  factLabel: { ...type.caption, color: brand.slate },
  factValue: { ...type.label, color: brand.ink, flex: 1, textAlign: 'right' },
  emptyTitle: { ...type.heading, color: brand.ink },
  emptyBody: { ...type.body, color: brand.slate, marginTop: spacing.sm },
});

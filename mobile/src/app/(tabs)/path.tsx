import { StyleSheet, Text } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Callout, Card, PageHeader, ProgressBar, Screen, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function PathScreen() {
  const { role, partnerTrainingComplete } = usePrototype();
  if (role === 'partner') return (
    <Screen>
      <PageHeader eyebrow="APPROVED PARTNER MATERIALS" title="Resources and training" body="Use only current materials. Expired or superseded claims must not be shared." />
      <Card>
        <StatusRow title="Permission before referral" detail="Consent statement and safe submission" state={partnerTrainingComplete ? 'Completed' : 'Required'} tone={partnerTrainingComplete ? 'success' : 'warning'} />
        <StatusRow title="Approved and prohibited claims" detail="Visa, earnings, refund, and disclosure boundaries" state={partnerTrainingComplete ? 'Completed' : 'Required'} tone={partnerTrainingComplete ? 'success' : 'warning'} />
        <StatusRow title="FDD process" detail="Delivery, receipt, review timing, and seller identity" state="Current" tone="success" />
      </Card>
      <Callout title="Sharing control" body="Production materials will use versioned, expiring links rather than uncontrolled file copies." tone="info" />
    </Screen>
  );
  if (role === 'attorney') return (
    <Screen>
      <PageHeader eyebrow="PERMISSIONED COORDINATION" title="No invited clients yet" body="A coordination item appears only after the client has given permission. New Dawn does not provide legal files through the MVP." />
      <Callout title="Independent professional judgment" body="Status information describes business-side events only and never represents a legal conclusion." tone="warning" />
    </Screen>
  );
  return (
    <Screen>
      <PageHeader eyebrow="MY PATH" title="A clear owner for every step" body="Your checklist separates your actions, New Dawn actions, and independent professional work." />
      <ProgressBar value={18} label="1 of 8 milestones complete" />
      <Card>
        <StatusRow title="1. Initial readiness" detail="Owner: You · Result and limitations saved" state="Completed" tone="success" />
        <StatusRow title="2. Counsel consultation" detail="Owner: You and independent counsel" state="Your action" tone="warning" />
        <StatusRow title="3. Business model review" detail="Owner: You and New Dawn" state="Available" />
        <StatusRow title="4. FDD review" detail="Owner: New Dawn and you" state="Not started" />
        <StatusRow title="5. Territory and operating plan" detail="Owner: You and New Dawn" state="Not started" />
        <StatusRow title="6. Entity, investment, business plan" detail="Owner: You and professional advisers" state="Not started" />
        <StatusRow title="7. Visa preparation" detail="Owner: Independent counsel" state="Not started" />
        <StatusRow title="8. Launch and training" detail="Owner: New Dawn and franchisee" state="Not started" />
      </Card>
      <Text style={styles.note}>Prototype milestones use mock data. Production completion requires an authoritative backend event and durable receipt.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ note: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.sm } });

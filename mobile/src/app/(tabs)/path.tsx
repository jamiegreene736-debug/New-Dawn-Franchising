import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { runtimeConfig } from '@/config/runtime';
import { usePrototype } from '@/prototype/prototype-context';
import type { InvestorPathway, PathwayMilestoneKey, PathwayMilestoneState, PathwayOwner } from '@/services/auth-client';
import { Callout, Card, PageHeader, ProgressBar, Screen, StatusRow } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function PathScreen() {
  const { role, partnerTrainingComplete } = usePrototype();
  const { account, loadInvestorPath } = useAuth();
  const [pathway, setPathway] = useState<InvestorPathway | null>(null);
  const [pathwayError, setPathwayError] = useState('');

  useEffect(() => {
    if (runtimeConfig.mode !== 'connected' || role !== 'investor' || !account) return;
    let active = true;
    void loadInvestorPath()
      .then((result) => { if (active) setPathway(result); })
      .catch(() => { if (active) setPathwayError('Your pathway could not be loaded. Please try again.'); });
    return () => { active = false; };
  }, [account, loadInvestorPath, role]);
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
  if (runtimeConfig.mode === 'connected' && account) return (
    <Screen>
      <PageHeader eyebrow="MY PATH" title="A clear owner for every step" body="Your checklist separates your actions, New Dawn actions, and independent professional work." />
      {!pathway && !pathwayError ? (
        <Card><ActivityIndicator color={brand.navy} /><Text style={styles.loading}>Loading your secure pathway…</Text></Card>
      ) : null}
      {pathwayError ? <Callout title="Pathway unavailable" body={pathwayError} tone="warning" /> : null}
      {pathway ? (
        <>
          <ProgressBar
            value={(pathway.completedMilestones / pathway.totalMilestones) * 100}
            label={`${pathway.completedMilestones} of ${pathway.totalMilestones} milestones complete`}
          />
          <Card>
            {pathway.milestones.map((milestone) => (
              <StatusRow
                key={milestone.key}
                title={`${milestone.sequence}. ${MILESTONE_TITLES[milestone.key]}`}
                detail={`Owner: ${OWNER_LABELS[milestone.owner]}`}
                state={STATE_LABELS[milestone.state]}
                tone={milestone.state === 'completed' ? 'success' : milestone.state === 'your_action' || milestone.state === 'blocked' ? 'warning' : undefined}
              />
            ))}
          </Card>
          <Text style={styles.note}>Status comes from your secure New Dawn account. Completion is recorded only after an authoritative event.</Text>
        </>
      ) : null}
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

const MILESTONE_TITLES: Record<PathwayMilestoneKey, string> = {
  initial_readiness: 'Initial readiness',
  counsel_consultation: 'Counsel consultation',
  business_model_review: 'Business model review',
  fdd_review: 'FDD review',
  territory_operating_plan: 'Territory and operating plan',
  entity_investment_business_plan: 'Entity, investment, business plan',
  visa_preparation: 'Visa preparation',
  launch_training: 'Launch and training',
};
const OWNER_LABELS: Record<PathwayOwner, string> = {
  investor: 'You',
  new_dawn: 'New Dawn',
  independent_counsel: 'Independent counsel',
  shared: 'You and your support team',
};
const STATE_LABELS: Record<PathwayMilestoneState, string> = {
  not_started: 'Not started',
  available: 'Available',
  your_action: 'Your action',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Needs attention',
};

const styles = StyleSheet.create({
  loading: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.sm },
  note: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.sm },
});

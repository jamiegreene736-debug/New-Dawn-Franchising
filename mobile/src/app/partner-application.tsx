import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, ChoiceCard, PageHeader, ProgressBar, Screen } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

const partnerTypes = [
  ['Franchise broker or consultant', 'I help qualified buyers compare franchise opportunities.'],
  ['Business broker or adviser', 'I advise entrepreneurs buying or operating U.S. businesses.'],
  ['CPA, wealth, or relocation adviser', 'I support internationally mobile business owners.'],
  ['Immigration consultant or business-plan firm', 'I support investor cases without acting as U.S. immigration counsel.'],
] as const;

export default function PartnerApplicationScreen() {
  const router = useRouter();
  const { submitPartnerApplication } = usePrototype();
  const [selected, setSelected] = useState<number>();
  const [confirmed, setConfirmed] = useState(false);
  const submit = () => { submitPartnerApplication(); router.replace('/(tabs)/home'); };

  return (
    <Screen>
      <ProgressBar value={confirmed ? 100 : 50} label={confirmed ? 'Ready to submit' : 'Step 1 of 2'} />
      <PageHeader eyebrow="NEW DAWN PARTNER NETWORK" title={confirmed ? 'Review the partner standards' : 'How do you support clients?'} body={confirmed ? 'Approval is based on professional fit, jurisdiction, permission practices, claims training, and applicable compensation rules.' : 'Choose the closest description. Independent immigration attorneys use a separate, uncompensated-by-default resource track.'} />
      {!confirmed ? (
        <>
          <View style={styles.list} accessibilityRole="radiogroup">{partnerTypes.map(([title, body], index) => <ChoiceCard key={title} title={title} body={body} selected={selected === index} onPress={() => setSelected(index)} />)}</View>
          <Button label="Continue" onPress={() => setConfirmed(true)} disabled={selected === undefined} />
        </>
      ) : (
        <>
          <Callout title="Application, not automatic acceptance" body="New accounts remain under review. Client registration becomes available only after approval, a current agreement, and required training." tone="warning" />
          <ChoiceCard title="Permission before every referral" body="I will share a person's information only after receiving permission to provide the required details to New Dawn." selected onPress={() => undefined} />
          <ChoiceCard title="Use approved claims only" body="I will not promise visa approval, earnings, returns, residency, refunds, or franchise outcomes outside current approved materials." selected onPress={() => undefined} />
          <ChoiceCard title="Respect professional boundaries" body="I will direct legal eligibility and immigration questions to qualified independent counsel." selected onPress={() => undefined} />
          <Text style={styles.prototypeText}>For prototype testing, professional identity fields and electronic signature are represented by completed sample data.</Text>
          <Button label="Submit application" onPress={submit} testID="submit-partner-application" />
          <Button label="Back" variant="quiet" onPress={() => setConfirmed(false)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  prototypeText: { ...type.caption, color: brand.slate, textAlign: 'center' },
});

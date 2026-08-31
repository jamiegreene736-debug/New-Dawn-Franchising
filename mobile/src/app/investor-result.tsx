import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Callout, Card, PageHeader, Screen, StatusPill } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function InvestorResultScreen() {
  const router = useRouter();
  return (
    <Screen>
      <PageHeader eyebrow="YOUR BUSINESS READINESS RESULT" title="Professional review recommended" body="Your answers suggest that a structured business conversation is the right next step." />
      <Card style={styles.resultCard}>
        <StatusPill label="Business alignment result" tone="warning" />
        <Text style={styles.resultTitle}>You have enough direction to compare New Dawn with professional guidance.</Text>
        <Text style={styles.resultBody}>A New Dawn consultation can explain the business model, responsibilities, current opportunity information, and diligence process. Independent immigration counsel must evaluate whether any business fits your legal circumstances.</Text>
      </Card>
      <Text style={styles.sectionTitle}>Why this result</Text>
      <View style={styles.reasonList}>
        <Reason number="1" title="Your planning horizon is actionable" body="You can begin organizing business questions and professional reviews." />
        <Reason number="2" title="Your investment range merits a current opportunity review" body="New Dawn can explain approved offerings without making an immigration determination." />
        <Reason number="3" title="You understand the need for independent counsel" body="The legal process remains separate from New Dawn's business guidance." />
      </View>
      <Callout title="This is not legal advice" body="This result does not determine, guarantee, or predict visa eligibility or approval. Rely on independent counsel and current official government information." tone="warning" />
      <Button label="Save to My Path" onPress={() => router.replace('/(tabs)/home')} testID="save-result" />
      <Button label="Review an opportunity first" variant="secondary" onPress={() => router.replace('/(tabs)/explore')} />
    </Screen>
  );
}

function Reason({ number, title, body }: { number: string; title: string; body: string }) {
  return <View style={styles.reason}><View style={styles.reasonNumber}><Text style={styles.reasonNumberText}>{number}</Text></View><View style={styles.reasonCopy}><Text style={styles.reasonTitle}>{title}</Text><Text style={styles.reasonBody}>{body}</Text></View></View>;
}

const styles = StyleSheet.create({
  resultCard: { backgroundColor: brand.goldWash, borderColor: '#E7D49E', gap: spacing.sm },
  resultTitle: { ...type.heading, color: brand.ink, marginTop: spacing.sm },
  resultBody: { ...type.body, color: brand.slate },
  sectionTitle: { ...type.heading, color: brand.ink, marginTop: spacing.md },
  reasonList: { gap: spacing.md },
  reason: { flexDirection: 'row', gap: spacing.md },
  reasonNumber: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.navy },
  reasonNumberText: { color: brand.gold, fontWeight: '900' },
  reasonCopy: { flex: 1 },
  reasonTitle: { ...type.label, color: brand.ink },
  reasonBody: { ...type.body, color: brand.slate, marginTop: 2 },
});

import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { trackWelcomeFunnelEvent, welcomeFunnelEvents } from '@/analytics/welcome-funnel';
import { runtimeConfig } from '@/config/runtime';
import { getE2OverviewContent, officialE2Sources } from '@/content/e2-overview';
import { useTranslations } from '@/i18n/use-translations';
import { usePrototype } from '@/prototype/prototype-context';
import { Button, Callout, Card, PageHeader, Screen, SectionHeader } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function E2OverviewScreen() {
  const router = useRouter();
  const { language, setRole } = usePrototype();
  const { t } = useTranslations();
  const content = getE2OverviewContent(language);

  const startAssessment = () => {
    trackWelcomeFunnelEvent(welcomeFunnelEvents.investorSelected);
    setRole('investor');
    if (runtimeConfig.mode === 'connected') {
      router.push({ pathname: '/register', params: { role: 'investor' } });
      return;
    }
    router.push('/investor-assessment');
  };

  const openOfficialSource = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        language === 'es' ? 'No se pudo abrir la fuente' : 'Could not open the source',
        language === 'es' ? 'Inténtelo de nuevo cuando tenga conexión.' : 'Please try again when you have a connection.',
      );
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <PageHeader eyebrow={content.eyebrow} title={content.title} body={content.introduction} />
      <Callout title={content.boundaryTitle} body={content.boundaryBody} tone="warning" />

      <SectionHeader title={content.benefitsTitle} />
      <Card style={styles.listCard}>
        {content.benefits.map((item) => <OverviewRow key={item.title} title={item.title} detail={item.detail} />)}
      </Card>

      <SectionHeader title={content.processTitle} />
      <View style={styles.stepList}>
        {content.steps.map((step) => (
          <View key={step.title} style={styles.step}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.detail}>{step.detail}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title={content.comparisonTitle} />
      <Text style={styles.intro}>{content.comparisonIntro}</Text>
      <View style={styles.comparisonList}>
        {content.comparisons.map((comparison, index) => (
          <Card key={comparison.title} style={index === 0 ? styles.e2Comparison : undefined}>
            <Text style={styles.comparisonTitle}>{comparison.title}</Text>
            <Text style={styles.detail}>{comparison.detail}</Text>
          </Card>
        ))}
      </View>

      <SectionHeader title={content.sourcesTitle} />
      <Text style={styles.intro}>{content.sourcesBody}</Text>
      <View style={styles.sourceList}>
        {Object.values(officialE2Sources).map((source) => (
          <Pressable
            accessibilityRole="link"
            key={source.url}
            onPress={() => void openOfficialSource(source.url)}
            style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
            <Text style={styles.sourceText}>{language === 'es' ? source.labelEs : source.label}</Text>
            <SymbolView accessibilityElementsHidden name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }} tintColor={brand.blue} size={15} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.currentAsOf}>{content.currentAsOf}</Text>

      <Button testID="start-e2-assessment" label={content.startAction} onPress={startAssessment} />
      <Text style={styles.prototype}>{t('prototype.notice')}</Text>
    </Screen>
  );
}

function OverviewRow({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.overviewRow}>
      <View style={styles.check} accessibilityElementsHidden><Text style={styles.checkText}>✓</Text></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.md },
  listCard: { paddingVertical: spacing.xs },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.line },
  check: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: brand.successWash },
  checkText: { ...type.label, color: brand.success },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.label, color: brand.ink, marginBottom: 3 },
  detail: { ...type.body, color: brand.slate },
  stepList: { gap: spacing.sm },
  step: { borderLeftWidth: 3, borderLeftColor: brand.gold, paddingLeft: spacing.md, paddingVertical: spacing.xs },
  stepTitle: { ...type.subheading, color: brand.ink, marginBottom: spacing.xs },
  intro: { ...type.body, color: brand.slate },
  comparisonList: { gap: spacing.sm },
  e2Comparison: { borderColor: brand.gold, backgroundColor: brand.goldWash },
  comparisonTitle: { ...type.subheading, color: brand.ink, marginBottom: spacing.xs },
  sourceList: { gap: spacing.xs },
  sourceLink: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderRadius: 12, backgroundColor: brand.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sourceText: { ...type.label, flex: 1, color: brand.blue },
  currentAsOf: { ...type.caption, color: brand.slate },
  prototype: { ...type.caption, color: brand.slate, textAlign: 'center' },
  pressed: { opacity: 0.76 },
});

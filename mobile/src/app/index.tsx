import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePrototype } from '@/prototype/prototype-context';
import { useTranslations } from '@/i18n/use-translations';
import { BrandMark, ChoiceCard, Screen, Tag } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { language, setLanguage, setRole } = usePrototype();
  const { t } = useTranslations();

  const chooseRole = (role: 'investor' | 'partner' | 'attorney') => {
    setRole(role);
    if (role === 'investor') router.push('/investor-assessment');
    else if (role === 'partner') router.push('/partner-application');
    else router.push('/(tabs)/home');
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.languageRow} accessibilityRole="radiogroup">
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: language === 'en' }} onPress={() => setLanguage('en')} style={[styles.languageButton, language === 'en' && styles.languageButtonSelected]}>
          <Text style={[styles.languageText, language === 'en' && styles.languageTextSelected]}>{t('language.english')}</Text>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: language === 'es' }} onPress={() => setLanguage('es')} style={[styles.languageButton, language === 'es' && styles.languageButtonSelected]}>
          <Text style={[styles.languageText, language === 'es' && styles.languageTextSelected]}>{t('language.spanish')}</Text>
        </Pressable>
      </View>

      <BrandMark />
      <Tag>{t('welcome.tag')}</Tag>
      <Text style={styles.title}>{t('welcome.title')}</Text>
      <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>{t('welcome.boundaryTitle')}</Text>
        <Text style={styles.noticeText}>{t('welcome.boundaryBody')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('welcome.choose')}</Text>
      <ChoiceCard eyebrow={t('welcome.investorEyebrow')} title={t('welcome.investorTitle')} body={t('welcome.investorBody')} onPress={() => chooseRole('investor')} testID="choose-investor" />
      <ChoiceCard eyebrow={t('welcome.partnerEyebrow')} title={t('welcome.partnerTitle')} body={t('welcome.partnerBody')} onPress={() => chooseRole('partner')} testID="choose-partner" />
      <ChoiceCard eyebrow={t('welcome.attorneyEyebrow')} title={t('welcome.attorneyTitle')} body={t('welcome.attorneyBody')} onPress={() => chooseRole('attorney')} testID="choose-attorney" />

      <Text style={styles.prototypeNote}>{t('prototype.notice')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  languageRow: { flexDirection: 'row', alignSelf: 'flex-end', borderRadius: 999, backgroundColor: brand.mist, padding: 3, marginBottom: spacing.xl },
  languageButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999 },
  languageButtonSelected: { backgroundColor: brand.white },
  languageText: { ...type.caption, color: brand.slate },
  languageTextSelected: { color: brand.navy, fontWeight: '800' },
  title: { ...type.display, color: brand.ink, marginTop: spacing.sm },
  subtitle: { ...type.bodyLarge, color: brand.slate, marginTop: spacing.sm, marginBottom: spacing.lg },
  notice: { borderLeftWidth: 4, borderLeftColor: brand.gold, borderRadius: 14, backgroundColor: brand.goldWash, padding: spacing.md, marginBottom: spacing.xl },
  noticeTitle: { ...type.label, color: brand.ink, marginBottom: 4 },
  noticeText: { ...type.body, color: brand.slate },
  sectionTitle: { ...type.heading, color: brand.ink, marginBottom: spacing.md },
  prototypeNote: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.xl },
});

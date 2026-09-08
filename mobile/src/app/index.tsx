import { ComponentProps } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackWelcomeFunnelEvent, welcomeFunnelEvents } from '@/analytics/welcome-funnel';
import { useAuth } from '@/auth/auth-context';
import { runtimeConfig } from '@/config/runtime';
import { useTranslations } from '@/i18n/use-translations';
import { usePrototype } from '@/prototype/prototype-context';
import { BrandMark, Screen, Tag } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

type Role = 'investor' | 'partner' | 'attorney';
type SymbolName = ComponentProps<typeof SymbolView>['name'];

const roleEvent = {
  investor: welcomeFunnelEvents.investorSelected,
  partner: welcomeFunnelEvents.partnerSelected,
  attorney: welcomeFunnelEvents.attorneySelected,
} as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { language, setLanguage, setRole } = usePrototype();
  const { ready, account } = useAuth();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();

  const chooseRole = (role: Role) => {
    trackWelcomeFunnelEvent(roleEvent[role]);

    if (runtimeConfig.mode === 'connected') {
      if (role === 'attorney') {
        Alert.alert(t('welcome.attorneyUnavailableTitle'), t('welcome.attorneyUnavailableBody'));
        return;
      }
      setRole(role);
      router.push({ pathname: '/register', params: { role } });
      return;
    }

    setRole(role);
    if (role === 'investor') router.push('/investor-assessment');
    else if (role === 'partner') router.push('/partner-application');
    else router.push('/(tabs)/home');
  };

  const openSignIn = () => {
    trackWelcomeFunnelEvent(welcomeFunnelEvents.signInSelected);
    router.push('/sign-in');
  };

  const openE2Overview = () => {
    trackWelcomeFunnelEvent(welcomeFunnelEvents.e2OverviewSelected);
    router.push('/e2-overview');
  };

  if (!ready) {
    return <View style={styles.loading}><ActivityIndicator color={brand.navy} size="large" /></View>;
  }
  if (runtimeConfig.mode === 'connected' && account) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <Screen contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <BrandMark compact />
        <View style={styles.languageRow} accessibilityRole="radiogroup">
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: language === 'en' }} onPress={() => setLanguage('en')} style={[styles.languageButton, language === 'en' && styles.languageButtonSelected]}>
            <Text style={[styles.languageText, language === 'en' && styles.languageTextSelected]}>{t('language.english')}</Text>
          </Pressable>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: language === 'es' }} onPress={() => setLanguage('es')} style={[styles.languageButton, language === 'es' && styles.languageButtonSelected]}>
            <Text style={[styles.languageText, language === 'es' && styles.languageTextSelected]}>{t('language.spanish')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        <SunriseMark />
        <Tag>{t('welcome.tag')}</Tag>
        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      </View>

      <View style={styles.roleSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('welcome.choose')}</Text>
          <Text style={styles.sectionHint}>{t('welcome.chooseHint')}</Text>
        </View>
        <RoleCard
          eyebrow={t('welcome.investorEyebrow')}
          title={t('welcome.investorTitle')}
          body={t('welcome.investorBody')}
          iconName={{ ios: 'building.2.fill', android: 'business', web: 'business' }}
          emphasized
          onPress={() => chooseRole('investor')}
          testID="choose-investor"
        />
        <RoleCard
          eyebrow={t('welcome.partnerEyebrow')}
          title={t('welcome.partnerTitle')}
          body={t('welcome.partnerBody')}
          iconName={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
          onPress={() => chooseRole('partner')}
          testID="choose-partner"
        />
        <Pressable accessibilityRole="button" testID="choose-attorney" onPress={() => chooseRole('attorney')} style={({ pressed }) => [styles.attorneyLink, pressed && styles.pressed]}>
          <View style={styles.attorneyIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><SymbolView name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} tintColor={brand.blue} size={18} /></View>
          <View style={styles.attorneyCopy}>
            <Text style={styles.attorneyTitle}>{t('welcome.attorneyTitle')}</Text>
            <Text style={styles.attorneyBody}>{t('welcome.attorneyBody')}</Text>
          </View>
          <Text style={styles.attorneyArrow} accessibilityElementsHidden>›</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        testID="open-e2-overview"
        onPress={openE2Overview}
        style={({ pressed }) => [styles.e2Card, pressed && styles.pressed]}>
        <View style={styles.e2TopRow}>
          <View style={styles.e2Icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SymbolView name={{ ios: 'flag.fill', android: 'flag', web: 'flag' }} tintColor={brand.gold} size={19} />
          </View>
          <Text style={styles.e2Eyebrow}>{t('welcome.e2Eyebrow')}</Text>
        </View>
        <Text style={styles.e2Title}>{t('welcome.e2Title')}</Text>
        <Text style={styles.e2Body}>{t('welcome.e2Body')}</Text>
        <View style={styles.e2ActionRow}>
          <Text style={styles.e2Action}>{t('welcome.e2Action')}</Text>
          <Text style={styles.e2Arrow} accessibilityElementsHidden>›</Text>
        </View>
      </Pressable>

      <View style={styles.notice} accessibilityRole="summary">
        <Text style={styles.noticeMark} accessibilityElementsHidden>✓</Text>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>{t('welcome.boundaryTitle')}</Text>
          <Text style={styles.noticeText}>{t('welcome.boundaryBody')}</Text>
        </View>
      </View>

      {runtimeConfig.mode === 'connected' ? (
        <Pressable accessibilityRole="button" onPress={openSignIn} style={({ pressed }) => [styles.signInRow, pressed && styles.pressed]}>
          <Text style={styles.signInPrompt}>{t('welcome.existingAccount')}</Text>
          <Text style={styles.signInAction}>{t('welcome.signIn')}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.prototypeNote}>{runtimeConfig.mode === 'connected' ? 'Internal pilot · Staging data only · No production connection' : t('prototype.notice')}</Text>
    </Screen>
  );
}

function SunriseMark() {
  return (
    <View style={styles.sunrise} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.sun} />
      <View style={styles.horizon} />
    </View>
  );
}

function RoleCard({
  eyebrow,
  title,
  body,
  iconName,
  emphasized = false,
  onPress,
  testID,
}: {
  eyebrow: string;
  title: string;
  body: string;
  iconName: SymbolName;
  emphasized?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const foreground = emphasized ? brand.white : brand.ink;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, emphasized && styles.roleCardEmphasized, pressed && styles.pressed]}>
      <View style={[styles.roleIcon, emphasized && styles.roleIconEmphasized]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <SymbolView name={iconName} tintColor={emphasized ? brand.gold : brand.blue} size={21} />
      </View>
      <View style={styles.roleCopy}>
        <Text style={[styles.roleEyebrow, emphasized && styles.roleEyebrowEmphasized]}>{eyebrow}</Text>
        <Text style={[styles.roleTitle, { color: foreground }]}>{title}</Text>
        <Text style={[styles.roleBody, emphasized && styles.roleBodyEmphasized]}>{body}</Text>
      </View>
      <Text style={styles.roleArrow} accessibilityElementsHidden>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: spacing.xl, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.canvas },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  languageRow: { flexDirection: 'row', borderRadius: 999, backgroundColor: brand.mist, padding: 3 },
  languageButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999 },
  languageButtonSelected: { backgroundColor: brand.white },
  languageText: { ...type.caption, color: brand.slate },
  languageTextSelected: { color: brand.navy, fontWeight: '800' },
  hero: { gap: spacing.xs },
  sunrise: { height: 35, justifyContent: 'flex-end', overflow: 'hidden', marginTop: spacing.xs },
  sun: { width: 66, height: 33, borderTopLeftRadius: 66, borderTopRightRadius: 66, backgroundColor: brand.gold },
  horizon: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: brand.navySoft },
  title: { ...type.title, color: brand.ink },
  subtitle: { ...type.body, color: brand.slate },
  roleSection: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { ...type.heading, color: brand.ink },
  sectionHint: { ...type.caption, color: brand.slate },
  roleCard: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: brand.line, backgroundColor: brand.white, padding: 12 },
  roleCardEmphasized: { borderColor: brand.navy, backgroundColor: brand.navy, shadowColor: brand.navy, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 3 },
  roleIcon: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EAF2F8' },
  roleIconEmphasized: { backgroundColor: 'rgba(201, 150, 26, 0.16)' },
  roleCopy: { flex: 1 },
  roleEyebrow: { ...type.caption, color: brand.blue, fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
  roleEyebrowEmphasized: { color: '#F2CE72' },
  roleTitle: { ...type.subheading, marginTop: 2 },
  roleBody: { ...type.caption, color: brand.slate, marginTop: 3 },
  roleBodyEmphasized: { color: '#DCE6EE' },
  roleArrow: { color: brand.gold, fontSize: 30, lineHeight: 32, fontWeight: '300' },
  attorneyLink: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 14 },
  attorneyIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EAF2F8' },
  attorneyCopy: { flex: 1 },
  attorneyTitle: { ...type.label, color: brand.blue },
  attorneyBody: { ...type.caption, color: brand.slate, marginTop: 2 },
  attorneyArrow: { color: brand.gold, fontSize: 25, lineHeight: 28, fontWeight: '300' },
  e2Card: { gap: spacing.xs, borderRadius: 18, borderWidth: 1, borderColor: '#E7D39A', backgroundColor: brand.goldWash, padding: 14 },
  e2TopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  e2Icon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: brand.white },
  e2Eyebrow: { ...type.caption, flex: 1, color: brand.warning, fontSize: 11, lineHeight: 15, letterSpacing: 0.7 },
  e2Title: { ...type.subheading, color: brand.ink, marginTop: 2 },
  e2Body: { ...type.caption, color: brand.slate },
  e2ActionRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 2 },
  e2Action: { ...type.label, flex: 1, color: brand.blue },
  e2Arrow: { color: brand.gold, fontSize: 25, lineHeight: 28, fontWeight: '300' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: 14, backgroundColor: brand.goldWash, padding: 12 },
  noticeMark: { ...type.label, color: brand.gold },
  noticeCopy: { flex: 1 },
  noticeTitle: { ...type.label, color: brand.ink },
  noticeText: { ...type.caption, color: brand.slate, marginTop: 2 },
  signInRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: 14 },
  signInPrompt: { ...type.caption, color: brand.slate },
  signInAction: { ...type.label, color: brand.blue },
  prototypeNote: { ...type.caption, color: brand.slate, textAlign: 'center' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});

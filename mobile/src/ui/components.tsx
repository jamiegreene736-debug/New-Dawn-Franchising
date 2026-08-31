import { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { brand, spacing, type } from './theme';

type ScreenProps = ScrollViewProps & { contentContainerStyle?: StyleProp<ViewStyle> };

export function Screen({ children, contentContainerStyle, ...props }: PropsWithChildren<ScreenProps>) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.screenContent, contentContainerStyle]}
        {...props}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function BrandMark() {
  return (
    <View style={styles.brandRow} accessibilityLabel="New Dawn Pathways">
      <View style={styles.brandIcon}><Text style={styles.brandIconText}>ND</Text></View>
      <View>
        <Text style={styles.brandName}>NEW DAWN</Text>
        <Text style={styles.brandProduct}>PATHWAYS</Text>
      </View>
    </View>
  );
}

export function Tag({ children }: PropsWithChildren) {
  return <Text style={styles.tag}>{children}</Text>;
}

type ChoiceCardProps = {
  eyebrow?: string;
  title: string;
  body: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function ChoiceCard({ eyebrow, title, body, onPress, selected, disabled, testID }: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceCard, selected && styles.choiceCardSelected, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.choiceBody}>
        {eyebrow ? <Text style={styles.choiceEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceText}>{body}</Text>
      </View>
      <Text style={styles.chevron} accessibilityElementsHidden>›</Text>
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, testID }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && styles.pressed, (disabled || loading) && styles.disabled]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? brand.white : brand.navy} /> : <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`]]}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PageHeader({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <View style={styles.pageHeader}>
      {eyebrow ? <Text style={styles.pageEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.pageTitle}>{title}</Text>
      {body ? <Text style={styles.pageBody}>{body}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionHeaderTitle}>{title}</Text>{action}</View>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }}>
      {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width }]} /></View>
    </View>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return <View style={[styles.pill, styles[`pill_${tone}`]]}><Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text></View>;
}

export function StatusRow({ title, detail, state, tone = 'neutral' }: { title: string; detail: string; state: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusCopy}><Text style={styles.statusTitle}>{title}</Text><Text style={styles.statusDetail}>{detail}</Text></View>
      <StatusPill label={state} tone={tone} />
    </View>
  );
}

export function Callout({ title, body, tone = 'info' }: { title: string; body: string; tone?: 'info' | 'warning' | 'success' }) {
  return (
    <View style={[styles.callout, styles[`callout_${tone}`]]}>
      <Text style={styles.calloutTitle}>{title}</Text>
      <Text style={styles.calloutBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.canvas },
  screenContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.lg },
  brandIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.navy },
  brandIconText: { color: brand.gold, fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  brandName: { color: brand.navy, fontSize: 18, fontWeight: '900', letterSpacing: 1.8 },
  brandProduct: { color: brand.gold, fontSize: 12, fontWeight: '900', letterSpacing: 3.4, marginTop: 2 },
  tag: { ...type.caption, color: brand.blue, letterSpacing: 1.5, marginBottom: 2 },
  choiceCard: { flexDirection: 'row', alignItems: 'center', minHeight: 112, borderRadius: 20, borderWidth: 1, borderColor: brand.line, backgroundColor: brand.white, padding: spacing.md, gap: spacing.md },
  choiceCardSelected: { borderColor: brand.navy, borderWidth: 2, backgroundColor: '#F3F7FA' },
  choiceBody: { flex: 1 },
  choiceEyebrow: { ...type.caption, color: brand.blue, letterSpacing: 1, marginBottom: 4 },
  choiceTitle: { ...type.subheading, color: brand.ink, marginBottom: 4 },
  choiceText: { ...type.body, color: brand.slate },
  chevron: { color: brand.gold, fontSize: 34, lineHeight: 36, fontWeight: '300' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  button: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderWidth: 1 },
  button_primary: { backgroundColor: brand.navy, borderColor: brand.navy },
  button_secondary: { backgroundColor: brand.white, borderColor: brand.navy },
  button_quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  button_danger: { backgroundColor: brand.dangerWash, borderColor: '#E5B8BC' },
  buttonLabel: { ...type.label },
  buttonLabel_primary: { color: brand.white },
  buttonLabel_secondary: { color: brand.navy },
  buttonLabel_quiet: { color: brand.blue },
  buttonLabel_danger: { color: brand.danger },
  card: { borderRadius: 20, borderWidth: 1, borderColor: brand.line, backgroundColor: brand.white, padding: spacing.md },
  pageHeader: { marginBottom: spacing.sm },
  pageEyebrow: { ...type.caption, color: brand.blue, letterSpacing: 1.2, marginBottom: spacing.xs },
  pageTitle: { ...type.title, color: brand.ink },
  pageBody: { ...type.bodyLarge, color: brand.slate, marginTop: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  sectionHeaderTitle: { ...type.heading, color: brand.ink },
  progressLabel: { ...type.caption, color: brand.slate, marginBottom: spacing.sm },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: brand.mist, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: brand.gold },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  pill_neutral: { backgroundColor: brand.mist },
  pill_success: { backgroundColor: brand.successWash },
  pill_warning: { backgroundColor: brand.warningWash },
  pill_danger: { backgroundColor: brand.dangerWash },
  pillText: { ...type.caption },
  pillText_neutral: { color: brand.slate },
  pillText_success: { color: brand.success },
  pillText_warning: { color: brand.warning },
  pillText_danger: { color: brand.danger },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.line },
  statusCopy: { flex: 1 },
  statusTitle: { ...type.label, color: brand.ink },
  statusDetail: { ...type.caption, color: brand.slate, marginTop: 3 },
  callout: { borderRadius: 16, borderLeftWidth: 4, padding: spacing.md },
  callout_info: { backgroundColor: '#EAF2F8', borderLeftColor: brand.blue },
  callout_warning: { backgroundColor: brand.goldWash, borderLeftColor: brand.gold },
  callout_success: { backgroundColor: brand.successWash, borderLeftColor: brand.success },
  calloutTitle: { ...type.label, color: brand.ink, marginBottom: 4 },
  calloutBody: { ...type.body, color: brand.slate },
});

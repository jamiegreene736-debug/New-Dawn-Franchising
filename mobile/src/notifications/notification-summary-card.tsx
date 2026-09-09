import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, StatusPill } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

import { usePathNotifications } from './notification-context';

export function NotificationSummaryCard() {
  const router = useRouter();
  const { unreadCount, preferences, reminders, permission } = usePathNotifications();
  const nextReminder = reminders[0];
  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>PATH WATCHLIST</Text>
          <Text style={styles.title}>Important changes, watched for you</Text>
        </View>
        <StatusPill
          label={unreadCount > 0 ? `${unreadCount} new` : permission === 'granted' ? 'Watching' : 'Set up'}
          tone={unreadCount > 0 ? 'warning' : permission === 'granted' ? 'success' : 'neutral'}
        />
      </View>
      <Text style={styles.body}>
        {preferences.followedEmbassyPost
          ? `Following ${preferences.followedEmbassyPost} plus your business milestones and saved dates.`
          : 'Follow your embassy, business milestones, appointments, and important saved dates.'}
      </Text>
      {nextReminder ? (
        <Text style={styles.reminder}>Next saved reminder · {new Date(nextReminder.eventAt).toLocaleString()}</Text>
      ) : null}
      <Button label="Open alerts and reminders" onPress={() => router.push('/notifications')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#EEF5FA', borderColor: '#C7DAE8', gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  copy: { flex: 1 },
  eyebrow: { ...type.caption, color: brand.blue, letterSpacing: 1.1 },
  title: { ...type.subheading, color: brand.ink, marginTop: spacing.xs },
  body: { ...type.body, color: brand.slate },
  reminder: { ...type.caption, color: brand.navy },
});

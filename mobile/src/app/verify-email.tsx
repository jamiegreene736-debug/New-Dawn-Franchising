import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AuthClientError } from '@/services/auth-client';
import { Button, Callout, FormField, PageHeader, Screen } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { pendingVerificationToken, verifyEmail } = useAuth();
  const [token, setToken] = useState(pendingVerificationToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const status = await verifyEmail(token.trim());
      if (status === 'authenticated') router.replace('/(tabs)/home');
      else setPendingApproval(true);
    } catch (caught) {
      setError(caught instanceof AuthClientError ? caught.message : 'Unable to verify this account.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <PageHeader eyebrow="EMAIL VERIFIED" title="Application ready for review" body="Your referral partner account is secure. New Dawn must approve the partner role before sign-in is enabled." />
        <Callout title="What happens next" body="A pilot administrator will review the partner application and notify you outside this test app." tone="success" />
        <Button label="Return to start" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <PageHeader eyebrow="EMAIL VERIFICATION" title="Verify your account" body="For the internal pilot, the staging verification token is shown below. Production will deliver a private email link instead." />
      {pendingVerificationToken ? <Callout title="Staging-only token loaded" body="The token was returned only because this is the isolated internal test environment." tone="info" /> : null}
      {error ? <Callout title="Verification problem" body={error} tone="warning" /> : null}
      <FormField label="Verification token" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
      <Button label="Verify email" onPress={submit} loading={loading} disabled={!token.trim()} />
      <Button label="Back to sign in" variant="secondary" onPress={() => router.replace('/sign-in')} />
      <Text style={styles.note}>Do not share verification tokens. They expire and can be used only once.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl },
  note: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.md },
});

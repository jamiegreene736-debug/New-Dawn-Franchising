import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { usePrototype } from '@/prototype/prototype-context';
import { AuthClientError, type MobileRole } from '@/services/auth-client';
import { Button, Callout, FormField, PageHeader, Screen } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role: MobileRole = params.role === 'partner' ? 'partner' : 'investor';
  const router = useRouter();
  const { register } = useAuth();
  const { language } = usePrototype();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validationError = password && password.length < 12
    ? 'Use at least 12 characters.'
    : confirmation && password !== confirmation
      ? 'Passwords do not match.'
      : '';

  const submit = async () => {
    if (validationError) return;
    setLoading(true);
    setError('');
    try {
      await register({ email, password, role, locale: language });
      router.push('/verify-email');
    } catch (caught) {
      setError(caught instanceof AuthClientError ? caught.message : 'Unable to create the account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <PageHeader
        eyebrow="SECURE PILOT"
        title={role === 'partner' ? 'Create a referral partner account' : 'Create an investor account'}
        body={role === 'partner'
          ? 'Your email will be verified before New Dawn reviews your partner application.'
          : 'Your email will be verified before you enter the pilot experience.'}
      />
      <Callout title="Test environment" body="This pilot is isolated from production and must not contain passports, financial records, or confidential immigration documents." tone="info" />
      {error ? <Callout title="Account problem" body={error} tone="warning" /> : null}
      <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={password.length > 0 && password.length < 12 ? 'Use at least 12 characters.' : undefined} />
      <FormField label="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={confirmation && password !== confirmation ? 'Passwords do not match.' : undefined} />
      <Button label="Create account" onPress={submit} loading={loading} disabled={!email.trim() || password.length < 12 || password !== confirmation} />
      <Button label="I already have an account" variant="quiet" onPress={() => router.push('/sign-in')} />
      <Text style={styles.note}>By continuing, you acknowledge that this pilot provides business information and coordination—not legal advice or an immigration eligibility decision.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg },
  note: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.sm },
});

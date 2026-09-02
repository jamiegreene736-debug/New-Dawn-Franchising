import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { AuthClientError } from '@/services/auth-client';
import { Button, Callout, FormField, PageHeader, Screen } from '@/ui/components';
import { brand, spacing, type } from '@/ui/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      router.replace('/(tabs)/home');
    } catch (caught) {
      setError(caught instanceof AuthClientError ? caught.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <PageHeader eyebrow="SECURE PILOT" title="Welcome back" body="Sign in to your New Dawn Pathways test account." />
      {error ? <Callout title="Sign-in problem" body={error} tone="warning" /> : null}
      <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" />
      <Button label="Sign in" onPress={submit} loading={loading} disabled={!email.trim() || !password} />
      <Button label="Create a pilot account" variant="secondary" onPress={() => router.replace('/')} />
      <Text style={styles.note}>New Dawn provides business education and coordination. Immigration eligibility and legal strategy are determined by independent counsel.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl },
  note: { ...type.caption, color: brand.slate, textAlign: 'center', marginTop: spacing.md },
});

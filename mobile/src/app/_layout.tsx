import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PrototypeProvider } from '@/prototype/prototype-context';
import { AuthProvider } from '@/auth/auth-context';
import { useTranslations } from '@/i18n/use-translations';
import { NotificationProvider } from '@/notifications/notification-context';
import { brand } from '@/ui/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: brand.navy,
    background: brand.canvas,
    card: brand.white,
    text: brand.ink,
    border: brand.line,
    notification: brand.gold,
  },
};

export default function RootLayout() {
  return (
    <PrototypeProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppNavigation />
        </NotificationProvider>
      </AuthProvider>
    </PrototypeProvider>
  );
}

function AppNavigation() {
  const { t } = useTranslations();

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: brand.canvas },
          headerTintColor: brand.navy,
          headerTitleStyle: { color: brand.ink, fontWeight: '700' },
          contentStyle: { backgroundColor: brand.canvas },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="register" options={{ title: 'Create account' }} />
        <Stack.Screen name="verify-email" options={{ title: 'Verify email' }} />
        <Stack.Screen name="investor-assessment" options={{ title: t('screen.assessment') }} />
        <Stack.Screen name="investor-result" options={{ title: t('screen.result') }} />
        <Stack.Screen name="partner-application" options={{ title: t('screen.partnerApplication') }} />
        <Stack.Screen name="partner-referral" options={{ title: t('screen.partnerReferral') }} />
        <Stack.Screen name="e2-overview" options={{ title: t('screen.e2Overview') }} />
        <Stack.Screen name="notifications" options={{ title: t('screen.notifications') }} />
        <Stack.Screen name="notification-settings" options={{ title: t('screen.notificationSettings') }} />
        <Stack.Screen name="add-reminder" options={{ title: t('screen.addReminder') }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

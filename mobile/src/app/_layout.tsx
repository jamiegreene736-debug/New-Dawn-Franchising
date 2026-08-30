import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PrototypeProvider } from '@/prototype/prototype-context';
import { useTranslations } from '@/i18n/use-translations';
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
      <AppNavigation />
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
        <Stack.Screen name="investor-assessment" options={{ title: t('screen.assessment') }} />
        <Stack.Screen name="investor-result" options={{ title: t('screen.result') }} />
        <Stack.Screen name="partner-application" options={{ title: t('screen.partnerApplication') }} />
        <Stack.Screen name="partner-referral" options={{ title: t('screen.partnerReferral') }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

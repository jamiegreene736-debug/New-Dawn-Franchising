import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { usePrototype } from '@/prototype/prototype-context';
import { useTranslations } from '@/i18n/use-translations';
import { brand } from '@/ui/theme';

export default function TabsLayout() {
  const { role } = usePrototype();
  const { t } = useTranslations();
  const second = role === 'investor' ? t('nav.explore') : role === 'partner' ? t('nav.referrals') : t('nav.resources');
  const third = role === 'investor' ? t('nav.myPath') : role === 'partner' ? t('nav.resources') : t('nav.coordination');
  return (
    <Tabs screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: brand.canvas }, headerTitleStyle: { color: brand.ink, fontWeight: '800' }, tabBarActiveTintColor: brand.navy, tabBarInactiveTintColor: brand.slate, tabBarStyle: { borderTopColor: brand.line, backgroundColor: brand.white } }}>
      <Tabs.Screen name="home" options={{ title: t('nav.home'), tabBarLabel: t('nav.home'), tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={22} /> }} />
      <Tabs.Screen name="explore" options={{ title: second, tabBarLabel: second, tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'safari.fill', android: 'explore', web: 'explore' }} tintColor={color} size={22} /> }} />
      <Tabs.Screen name="path" options={{ title: third, tabBarLabel: third, tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' }} tintColor={color} size={22} /> }} />
      <Tabs.Screen name="support" options={{ title: t('nav.support'), tabBarLabel: t('nav.support'), tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'questionmark.circle.fill', android: 'support_agent', web: 'support_agent' }} tintColor={color} size={22} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarLabel: t('nav.profile'), tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }} tintColor={color} size={22} /> }} />
    </Tabs>
  );
}

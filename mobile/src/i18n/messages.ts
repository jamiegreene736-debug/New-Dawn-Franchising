const english = {
  'language.english': 'English',
  'language.spanish': 'Español',
  'welcome.tag': 'A CLEARER U.S. BUSINESS PATH',
  'welcome.title': 'Start with the path that fits you',
  'welcome.subtitle': 'Choose your goal and we’ll show you the right next steps.',
  'welcome.boundaryTitle': 'Clear professional roles',
  'welcome.boundaryBody': 'New Dawn explains the business. Independent counsel provides immigration advice.',
  'welcome.choose': 'I want to…',
  'welcome.chooseHint': 'Choose one',
  'welcome.investorEyebrow': 'FOR PROSPECTIVE OWNERS',
  'welcome.investorTitle': 'Explore business ownership',
  'welcome.investorBody': 'Take a short assessment and get a personal roadmap.',
  'welcome.partnerEyebrow': 'FOR REFERRAL PROFESSIONALS',
  'welcome.partnerTitle': 'Refer prospective investors',
  'welcome.partnerBody': 'Apply, train, and make permission-based introductions.',
  'welcome.attorneyEyebrow': 'FOR INDEPENDENT COUNSEL',
  'welcome.attorneyTitle': 'I’m independent immigration counsel',
  'welcome.attorneyBody': 'Learn about the separate counsel resource track.',
  'welcome.attorneyUnavailableTitle': 'Counsel access is separate',
  'welcome.attorneyUnavailableBody': 'Attorney accounts are not included in this pilot. Contact New Dawn to request resource access.',
  'welcome.existingAccount': 'Already have an account?',
  'welcome.signIn': 'Sign in',
  'prototype.notice': 'Interactive prototype · Mock data only · No production connection',
  'nav.home': 'Home',
  'nav.explore': 'Explore',
  'nav.referrals': 'Referrals',
  'nav.resources': 'Resources',
  'nav.myPath': 'My Path',
  'nav.coordination': 'Coordination',
  'nav.support': 'Support',
  'nav.profile': 'Profile',
  'screen.assessment': 'Readiness assessment',
  'screen.result': 'Your result',
  'screen.partnerApplication': 'Partner application',
  'screen.partnerReferral': 'Register a referral',
} as const;

export type MessageKey = keyof typeof english;
export type Locale = 'en' | 'es';

const spanish: Record<MessageKey, string> = {
  'language.english': 'English',
  'language.spanish': 'Español',
  'welcome.tag': 'UN CAMINO EMPRESARIAL MÁS CLARO EN EE. UU.',
  'welcome.title': 'Comience con el camino adecuado para usted',
  'welcome.subtitle': 'Elija su objetivo y le mostraremos los próximos pasos adecuados.',
  'welcome.boundaryTitle': 'Funciones profesionales claras',
  'welcome.boundaryBody': 'New Dawn explica el negocio. Un abogado independiente brinda asesoría migratoria.',
  'welcome.choose': 'Quiero…',
  'welcome.chooseHint': 'Elija una opción',
  'welcome.investorEyebrow': 'PARA FUTUROS PROPIETARIOS',
  'welcome.investorTitle': 'Explorar la propiedad de un negocio',
  'welcome.investorBody': 'Complete una breve evaluación y reciba una guía personalizada.',
  'welcome.partnerEyebrow': 'PARA PROFESIONALES DE REFERIDOS',
  'welcome.partnerTitle': 'Referir a posibles inversionistas',
  'welcome.partnerBody': 'Solicite participar, capacítese y presente contactos con su autorización.',
  'welcome.attorneyEyebrow': 'PARA ABOGADOS INDEPENDIENTES',
  'welcome.attorneyTitle': 'Soy abogado de inmigración independiente',
  'welcome.attorneyBody': 'Conozca el programa separado de recursos para abogados.',
  'welcome.attorneyUnavailableTitle': 'El acceso para abogados es independiente',
  'welcome.attorneyUnavailableBody': 'Las cuentas para abogados no están incluidas en este programa piloto. Comuníquese con New Dawn para solicitar acceso a los recursos.',
  'welcome.existingAccount': '¿Ya tiene una cuenta?',
  'welcome.signIn': 'Iniciar sesión',
  'prototype.notice': 'Prototipo interactivo · Solo datos de prueba · Sin conexión a producción',
  'nav.home': 'Inicio',
  'nav.explore': 'Explorar',
  'nav.referrals': 'Referencias',
  'nav.resources': 'Recursos',
  'nav.myPath': 'Mi camino',
  'nav.coordination': 'Coordinación',
  'nav.support': 'Ayuda',
  'nav.profile': 'Perfil',
  'screen.assessment': 'Evaluación de preparación',
  'screen.result': 'Su resultado',
  'screen.partnerApplication': 'Solicitud de socio',
  'screen.partnerReferral': 'Registrar una referencia',
};

const messages: Record<Locale, Readonly<Record<MessageKey, string>>> = {
  en: english,
  es: spanish,
};

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}

export function hasTranslationParity(): boolean {
  const englishKeys = Object.keys(messages.en).sort();
  const spanishKeys = Object.keys(messages.es).sort();
  return englishKeys.length === spanishKeys.length && englishKeys.every((key, index) => key === spanishKeys[index]);
}

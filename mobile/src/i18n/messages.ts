const english = {
  'language.english': 'English',
  'language.spanish': 'Español',
  'welcome.tag': 'E-2 BUSINESS OWNERSHIP PATH',
  'welcome.title': 'Explore a U.S. business path you can direct',
  'welcome.subtitle': 'Choose your goal, understand where E-2 may fit, and get the right next steps.',
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
  'welcome.e2Eyebrow': 'WHY ENTREPRENEURS EXPLORE E-2',
  'welcome.e2Title': 'Own and direct a qualifying U.S. business',
  'welcome.e2Body': 'For eligible treaty-country nationals: a business-led process without the cap-subject H-1B registration selection or EB-5’s fixed statutory investment thresholds.',
  'welcome.e2Action': 'See the E-2 process and compare pathways',
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
  'screen.e2Overview': 'E-2 overview',
  'screen.notifications': 'Alerts & reminders',
  'screen.notificationSettings': 'Notification settings',
  'screen.addReminder': 'Add reminder',
} as const;

export type MessageKey = keyof typeof english;
export type Locale = 'en' | 'es';

const spanish: Record<MessageKey, string> = {
  'language.english': 'English',
  'language.spanish': 'Español',
  'welcome.tag': 'CAMINO E-2 PARA PROPIETARIOS DE NEGOCIOS',
  'welcome.title': 'Explore un camino empresarial en EE. UU. que usted pueda dirigir',
  'welcome.subtitle': 'Elija su objetivo, entienda cuándo la E-2 podría ser adecuada y conozca los próximos pasos.',
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
  'welcome.e2Eyebrow': 'POR QUÉ LOS EMPRENDEDORES EXPLORAN LA E-2',
  'welcome.e2Title': 'Sea propietario y dirija un negocio estadounidense que cumpla los requisitos',
  'welcome.e2Body': 'Para nacionales elegibles de países con tratado: un proceso empresarial sin la selección del registro H-1B sujeta al límite anual ni los umbrales legales fijos de inversión de la EB-5.',
  'welcome.e2Action': 'Vea el proceso E-2 y compare caminos',
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
  'screen.e2Overview': 'Descripción general de la E-2',
  'screen.notifications': 'Alertas y recordatorios',
  'screen.notificationSettings': 'Configuración de notificaciones',
  'screen.addReminder': 'Agregar recordatorio',
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

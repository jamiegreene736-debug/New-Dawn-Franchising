const english = {
  'language.english': 'English',
  'language.spanish': 'Español',
  'welcome.tag': 'YOUR U.S. BUSINESS PATH',
  'welcome.title': 'A clearer next step.',
  'welcome.subtitle': 'Explore a New Dawn business opportunity, organize your path, and reach the right people.',
  'welcome.boundaryTitle': 'Important boundary',
  'welcome.boundaryBody': 'New Dawn provides business education and coordination. Independent immigration counsel determines eligibility and leads the legal process.',
  'welcome.choose': 'How would you like to begin?',
  'welcome.investorEyebrow': 'FOR ENTREPRENEURS',
  'welcome.investorTitle': 'Explore as an investor',
  'welcome.investorBody': 'Assess business alignment and see your next steps.',
  'welcome.partnerEyebrow': 'FOR INTRODUCERS',
  'welcome.partnerTitle': 'Join as a referral partner',
  'welcome.partnerBody': 'Apply, complete training, and register permitted referrals.',
  'welcome.attorneyEyebrow': 'FOR INDEPENDENT COUNSEL',
  'welcome.attorneyTitle': 'Access counsel resources',
  'welcome.attorneyBody': 'Review business materials and coordinate with New Dawn.',
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
  'welcome.tag': 'SU CAMINO EMPRESARIAL EN EE. UU.',
  'welcome.title': 'Un próximo paso claro.',
  'welcome.subtitle': 'Explore una oportunidad de negocio de New Dawn, organice su camino y conéctese con las personas adecuadas.',
  'welcome.boundaryTitle': 'Información importante',
  'welcome.boundaryBody': 'New Dawn brinda educación empresarial y coordinación. Un abogado de inmigración independiente determina la elegibilidad y dirige el proceso legal.',
  'welcome.choose': '¿Cómo desea comenzar?',
  'welcome.investorEyebrow': 'PARA EMPRENDEDORES',
  'welcome.investorTitle': 'Explorar como inversionista',
  'welcome.investorBody': 'Evalúe la alineación empresarial y vea sus próximos pasos.',
  'welcome.partnerEyebrow': 'PARA INTRODUCTORES',
  'welcome.partnerTitle': 'Unirse como socio de referencia',
  'welcome.partnerBody': 'Solicite aprobación, complete la capacitación y registre referencias permitidas.',
  'welcome.attorneyEyebrow': 'PARA ABOGADOS INDEPENDIENTES',
  'welcome.attorneyTitle': 'Acceder a recursos para abogados',
  'welcome.attorneyBody': 'Revise materiales empresariales y coordine con New Dawn.',
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

import type { Locale } from '@/i18n/messages';

export const H1B_PAYMENT_PROCLAMATION_END = '2026-09-21T04:01:00.000Z';

export const officialE2Sources = {
  e2Requirements: {
    label: 'Department of State — E-2 requirements',
    labelEs: 'Departamento de Estado — requisitos E-2',
    url: 'https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html',
  },
  treatyCountries: {
    label: 'Department of State — treaty countries',
    labelEs: 'Departamento de Estado — países con tratado',
    url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/treaty.html',
  },
  h1bProclamation: {
    label: 'White House — temporary H-1B proclamation',
    labelEs: 'Casa Blanca — proclamación temporal H-1B',
    url: 'https://www.whitehouse.gov/presidential-actions/2025/09/restriction-on-entry-of-certain-nonimmigrant-workers/',
  },
  eb5Requirements: {
    label: 'USCIS — business and investment visas',
    labelEs: 'USCIS — visas empresariales y de inversión',
    url: 'https://www.uscis.gov/sites/default/files/document/outreach-engagements/UnderstandingBusinessandInvestmentVisas.pdf',
  },
  visaBulletin: {
    label: 'Department of State — current Visa Bulletin',
    labelEs: 'Departamento de Estado — Boletín de Visas vigente',
    url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html',
  },
} as const;

type OverviewItem = Readonly<{ title: string; detail: string }>;

export type E2OverviewContent = Readonly<{
  eyebrow: string;
  title: string;
  introduction: string;
  boundaryTitle: string;
  boundaryBody: string;
  benefitsTitle: string;
  benefits: readonly OverviewItem[];
  processTitle: string;
  steps: readonly OverviewItem[];
  comparisonTitle: string;
  comparisonIntro: string;
  comparisons: readonly OverviewItem[];
  sourcesTitle: string;
  sourcesBody: string;
  currentAsOf: string;
  startAction: string;
}>;

const englishBase = {
  eyebrow: 'E-2 IN PLAIN LANGUAGE',
  title: 'A business-led option for qualifying treaty-country entrepreneurs',
  introduction: 'E-2 can let an eligible investor enter the United States to develop and direct a real operating business. It is a nonimmigrant path, not a direct route to permanent residence.',
  boundaryTitle: 'Education, not an eligibility decision',
  boundaryBody: 'A franchise purchase does not guarantee E-2 eligibility or visa approval. New Dawn explains the business opportunity; independent immigration counsel evaluates your facts and leads the legal process.',
  benefitsTitle: 'Why entrepreneurs explore E-2',
  benefits: [
    { title: 'Own and direct the business', detail: 'The principal investor develops and directs the qualifying U.S. enterprise instead of relying on a sponsoring employer.' },
    { title: 'A treaty-investor process', detail: 'E-2 does not use the registration-selection process required for many cap-subject H-1B cases.' },
    { title: 'Investment sized to the enterprise', detail: 'There is no fixed statutory dollar floor. Capital must still be substantial, committed and at risk, and the business must be real, operating, and more than marginal.' },
  ],
  processTitle: 'How the E-2 process generally works',
  steps: [
    { title: '1. Confirm treaty nationality', detail: 'The principal investor must hold nationality of an E-2 treaty country, subject to country-specific rules.' },
    { title: '2. Select and diligence the business', detail: 'Review the operating model, responsibilities, costs, disclosures, and whether the enterprise is viable for you.' },
    { title: '3. Commit qualifying capital', detail: 'The investment must be substantial and placed at commercial risk in a bona fide enterprise; idle or revocable funds generally do not qualify.' },
    { title: '4. Build the evidence with counsel', detail: 'Independent immigration counsel determines the legal strategy and evidence. New Dawn supplies accurate, approved business materials within its role.' },
    { title: '5. Apply and await the government decision', detail: 'A consular officer or USCIS decides the immigration request. If granted, the investor must continue operating within E-2 requirements.' },
  ],
  comparisonTitle: 'How common paths differ',
  comparisonIntro: 'The right option depends on nationality, goals, timing, capital, employer facts, and immigration history. These are structural differences—not a recommendation.',
  comparisons: [],
  sourcesTitle: 'Check the official rules',
  sourcesBody: 'Immigration rules, fees, visa availability, and country treatment change. Review current government information and use independent counsel before relying on any comparison.',
  currentAsOf: 'Official-source review: September 8, 2026',
  startAction: 'Explore my business readiness',
} satisfies Omit<E2OverviewContent, 'comparisons'> & { comparisons: readonly OverviewItem[] };

const spanishBase = {
  eyebrow: 'LA E-2 EN LENGUAJE CLARO',
  title: 'Una opción empresarial para emprendedores que reúnen los requisitos de un país con tratado',
  introduction: 'La E-2 puede permitir que un inversionista elegible ingrese a Estados Unidos para desarrollar y dirigir un negocio real y en funcionamiento. Es una categoría de no inmigrante, no un camino directo a la residencia permanente.',
  boundaryTitle: 'Información general, no una decisión de elegibilidad',
  boundaryBody: 'Comprar una franquicia no garantiza la elegibilidad E-2 ni la aprobación de una visa. New Dawn explica la oportunidad de negocio; un abogado de inmigración independiente evalúa sus circunstancias y dirige el proceso legal.',
  benefitsTitle: 'Por qué los emprendedores exploran la E-2',
  benefits: [
    { title: 'Sea propietario y dirija el negocio', detail: 'El inversionista principal desarrolla y dirige la empresa estadounidense que cumple los requisitos, en lugar de depender de un empleador patrocinador.' },
    { title: 'Un proceso para inversionistas de países con tratado', detail: 'La E-2 no utiliza el proceso de registro y selección exigido para muchos casos H-1B sujetos al límite anual.' },
    { title: 'Una inversión acorde con la empresa', detail: 'No existe un monto mínimo fijo establecido por ley. El capital debe ser sustancial, estar comprometido y en riesgo, y el negocio debe ser real, operativo y más que marginal.' },
  ],
  processTitle: 'Cómo funciona generalmente el proceso E-2',
  steps: [
    { title: '1. Confirme la nacionalidad de un país con tratado', detail: 'El inversionista principal debe tener la nacionalidad de un país con tratado E-2, sujeto a reglas específicas de cada país.' },
    { title: '2. Seleccione y evalúe el negocio', detail: 'Revise el modelo operativo, las responsabilidades, los costos, las divulgaciones y si la empresa es viable para usted.' },
    { title: '3. Comprometa capital que cumpla los requisitos', detail: 'La inversión debe ser sustancial y estar en riesgo comercial en una empresa legítima; los fondos inactivos o revocables generalmente no califican.' },
    { title: '4. Prepare la evidencia con un abogado', detail: 'Un abogado de inmigración independiente determina la estrategia legal y la evidencia. New Dawn proporciona materiales empresariales exactos y aprobados dentro de su función.' },
    { title: '5. Presente la solicitud y espere la decisión oficial', detail: 'Un funcionario consular o USCIS decide la solicitud migratoria. Si se concede, el inversionista debe seguir operando conforme a los requisitos E-2.' },
  ],
  comparisonTitle: 'Diferencias entre caminos comunes',
  comparisonIntro: 'La opción adecuada depende de la nacionalidad, los objetivos, el tiempo, el capital, el empleador y el historial migratorio. Estas son diferencias estructurales, no una recomendación.',
  comparisons: [],
  sourcesTitle: 'Consulte las reglas oficiales',
  sourcesBody: 'Las reglas migratorias, tarifas, disponibilidad de visas y tratamiento por país cambian. Revise la información oficial vigente y consulte a un abogado independiente antes de basarse en cualquier comparación.',
  currentAsOf: 'Fuentes oficiales revisadas: 8 de septiembre de 2026',
  startAction: 'Explorar mi preparación empresarial',
} satisfies Omit<E2OverviewContent, 'comparisons'> & { comparisons: readonly OverviewItem[] };

function h1bDetail(locale: Locale, now: Date): string {
  const temporaryPaymentIsCurrent = now.getTime() < Date.parse(H1B_PAYMENT_PROCLAMATION_END);
  if (locale === 'es') {
    return temporaryPaymentIsCurrent
      ? 'Empleo especializado patrocinado por un empleador. Muchos casos sujetos al límite anual requieren selección. Una proclamación temporal exige un pago de $100,000 para determinadas peticiones nuevas de trabajadores fuera de EE. UU. hasta las 12:01 a. m. ET del 21 de septiembre de 2026, salvo extensión o excepción.'
      : 'Empleo especializado patrocinado por un empleador. Muchos casos sujetos al límite anual requieren registro y selección. Las tarifas y restricciones cambian; consulte la guía oficial vigente.';
  }
  return temporaryPaymentIsCurrent
    ? 'Employer-sponsored specialty work. Many cap-subject cases require selection. A temporary proclamation requires a $100,000 payment for specified new petitions involving workers outside the U.S. until 12:01 a.m. ET on September 21, 2026, unless extended or excepted.'
    : 'Employer-sponsored specialty work. Many cap-subject cases require registration and selection. Fees and restrictions change; check current official guidance.';
}

export function getE2OverviewContent(locale: Locale, now = new Date()): E2OverviewContent {
  const comparisons: readonly OverviewItem[] = locale === 'es'
    ? [
        { title: 'E-2 · Inversionista de país con tratado', detail: 'Ruta de propietario y operador para nacionales elegibles. Requiere una inversión sustancial en una empresa real y no es una vía directa a la residencia permanente.' },
        { title: 'H-1B · Empleo especializado', detail: h1bDetail(locale, now) },
        { title: 'EB-5 · Inversionista inmigrante', detail: 'Camino hacia la residencia permanente con umbrales legales de $800,000 para inversiones que califican en zonas de empleo objetivo o infraestructura, o $1,050,000 en otros casos, además de requisitos de creación de empleos. La disponibilidad varía por categoría y país.' },
      ]
    : [
        { title: 'E-2 · Treaty investor', detail: 'Owner-operator route for eligible nationals. Requires substantial investment in a real enterprise and is not a direct permanent-residence path.' },
        { title: 'H-1B · Specialty occupation', detail: h1bDetail(locale, now) },
        { title: 'EB-5 · Immigrant investor', detail: 'Permanent-residence path with statutory thresholds of $800,000 for qualifying targeted-employment-area or infrastructure investments, or $1,050,000 otherwise, plus job-creation requirements. Visa availability varies by category and country.' },
      ];

  return { ...(locale === 'es' ? spanishBase : englishBase), comparisons };
}

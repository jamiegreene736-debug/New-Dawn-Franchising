/**
 * Language Detection & Localization for Outreach Drafting
 *
 * Detects a lead's language/dialect from country data and returns
 * structured instructions to inject into AI drafting prompts —
 * including banned "AI-translation-giveaway" phrases per language.
 */

export interface LanguageProfile {
  language: string;
  variant: string;
  formality: "usted" | "tú" | "vos" | "vous" | "Sie" | "standard";
  promptInstructions: string;
  bannedPhrases: string[];
}

// ─── Spanish Banned Phrases (all variants) ────────────────────────────────────
// These are the dead-giveaway signs of a machine-translated email from English.

const SPANISH_BANNED_COMMON = [
  "Espero que este correo le encuentre bien",
  "Espero que este mensaje le encuentre bien",
  "Espero que este correo te encuentre bien",
  "No dude en contactarme",
  "No dude en ponerse en contacto conmigo",
  "No dude en comunicarse",
  "Permítame presentarme",
  "Me complace informarle",
  "Me dirijo a usted",
  "Por medio de la presente",
  "A través de este medio",
  "En atención a lo anterior",
  "Adjunto encontrará",
  "Adjunto le envío",
  "A la espera de sus noticias",
  "Quedo a sus órdenes",
  "Quedo a su entera disposición",
  "Quedamos a su disposición",
  "Le hago llegar",
  "Para su conocimiento",
  "Tal y como le mencioné",
  "Con el fin de",
  "En el marco de",
  "En este sentido",
  "Cabe mencionar que",
];

const SPANISH_MEXICO_BANNED = [
  ...SPANISH_BANNED_COMMON,
  "Estimado/a" + " (use first name instead)",
  "Vosotros", "vuestra", "vuestro",
  "ordenador (use computadora)",
  "coche (use carro or auto)",
  "móvil (use celular)",
  "coger (never use in Mexico — use tomar, agarrar, or llevar)",
];

const SPANISH_ARGENTINA_BANNED = [
  ...SPANISH_BANNED_COMMON,
  "Tú (use vos)",
  "Estimado/a",
  "Vosotros",
];

const SPANISH_SPAIN_BANNED = [
  ...SPANISH_BANNED_COMMON,
  "Computadora (use ordenador)",
  "Celular (use móvil)",
  "Carro (use coche)",
];

const SPANISH_COLOMBIA_BANNED = [
  ...SPANISH_BANNED_COMMON,
  "Vosotros",
  "Tío/tía (use names)",
];

// ─── Portuguese Banned Phrases ────────────────────────────────────────────────
const PORTUGUESE_BRAZIL_BANNED = [
  "Espero que este e-mail o encontre bem",
  "Não hesite em me contactar",
  "Permita-me apresentar-me",
  "Conforme mencionado anteriormente",
  "Por meio deste",
  "Venho por meio deste",
  "Segue em anexo",
  "Atenciosamente (overused — find a warmer closing)",
  "Fico ao dispor",
  "Aguardo seu retorno",
];

// ─── French Banned Phrases ────────────────────────────────────────────────────
const FRENCH_BANNED = [
  "J'espère que cet e-mail vous trouve en bonne santé",
  "N'hésitez pas à me contacter",
  "Permettez-moi de me présenter",
  "Suite à notre échange",
  "Veuillez trouver ci-joint",
  "Dans l'attente de votre réponse",
  "Je reste à votre disposition",
  "Cordialement (too generic — use something specific)",
];

// ─── German Banned Phrases ────────────────────────────────────────────────────
const GERMAN_BANNED = [
  "Ich hoffe, diese E-Mail findet Sie wohlauf",
  "Zögern Sie nicht, mich zu kontaktieren",
  "Gestatten Sie mir, mich vorzustellen",
  "Wie bereits erwähnt",
  "Anbei finden Sie",
  "Mit freundlichen Grüßen (too generic — personalize closing)",
  "Ich verbleibe mit freundlichen Grüßen",
];

// ─── Country → Language Profile Map ──────────────────────────────────────────

const PROFILES: Record<string, LanguageProfile> = {
  // ── Mexico ──
  mexico: {
    language: "Spanish",
    variant: "Mexican Spanish",
    formality: "usted",
    bannedPhrases: SPANISH_MEXICO_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in Mexican Spanish. This is a business professional in Mexico.
- Use "usted" throughout (not "tú" — business communications in Mexico are formal)
- Write like a native Mexican business professional would actually talk — warm, collegial, but respectful
- Use Mexican vocabulary: "celular" not "móvil", "computadora" not "ordenador", "carro" or "auto" not "coche"
- Avoid Castilian Spanish expressions (vosotros, coger, tío)
- Natural openings in Mexico: "Buen día," / "Estimado [nombre]," / "Hola [nombre]," (informal depends on industry)
- Natural closings: "Un cordial saludo," / "Saludos," / "Quedo en contacto,"
- NEVER translate English idioms literally — rephrase them naturally in Mexican Spanish
- The goal: a Mexican businessperson should read this and think a local colleague wrote it`,
  },

  // ── Spain ──
  spain: {
    language: "Spanish",
    variant: "Castilian Spanish (Spain)",
    formality: "usted",
    bannedPhrases: SPANISH_SPAIN_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in Castilian Spanish (Spain).
- Use "usted" for formal business outreach; "tú" only if the tone is clearly informal
- Use Castilian vocabulary: "ordenador" not "computadora", "móvil" not "celular", "coche" not "carro"
- Vosotros is natural in Spain — use it if addressing a group
- Natural openings: "Estimado/a [nombre]," / "Buenas tardes," / "Hola [nombre],"
- Natural closings: "Un saludo," / "Saludos cordiales," / "Atentamente,"
- NEVER translate English idioms literally — rephrase them naturally in Castilian Spanish
- The goal: a Spanish businessperson should read this and think a local peer wrote it`,
  },

  // ── Argentina ──
  argentina: {
    language: "Spanish",
    variant: "Rioplatense Spanish (Argentina)",
    formality: "vos",
    bannedPhrases: SPANISH_ARGENTINA_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in Rioplatense Spanish as spoken in Argentina.
- Use "vos" instead of "tú" — this is essential in Argentina (e.g., "¿Qué hacés?", "¿Podés?")
- Use "usted" only in very formal legal/banking contexts; business peers use "vos"
- Conjugate correctly for voseo: amás, sabés, podés, hacés, tenés
- Tone in Argentina is more direct and informal than other Latin American countries
- Natural openings: "Hola [nombre]," / "Buenos días [nombre],"
- Natural closings: "Saludos," / "Un abrazo," (if warmer tone)
- NEVER use "tú" — it sounds foreign in Argentina
- NEVER translate English idioms literally`,
  },

  // ── Colombia ──
  colombia: {
    language: "Spanish",
    variant: "Colombian Spanish",
    formality: "usted",
    bannedPhrases: SPANISH_COLOMBIA_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in Colombian Spanish.
- Colombians use "usted" even in casual professional contexts — it's a sign of respect, not distance
- Use "usted" throughout
- Colombian business culture is warm but formal — courteous and professional
- Natural openings: "Estimado [nombre]," / "Buenos días," / "Con mucho gusto,"
- Natural closings: "Quedo atento," / "Cordialmente," / "Un saludo,"
- Avoid "vosotros" entirely
- NEVER translate English idioms literally`,
  },

  // ── Chile ──
  chile: {
    language: "Spanish",
    variant: "Chilean Spanish",
    formality: "usted",
    bannedPhrases: SPANISH_BANNED_COMMON,
    promptInstructions: `LANGUAGE: Write entirely in Chilean Spanish.
- Use "usted" for formal business; Chileans use "tú" in informal settings but business is formal
- Chilean Spanish is direct and can be quite informal — don't be stiff
- Natural openings: "Estimado [nombre]," / "Hola [nombre],"
- Natural closings: "Saludos," / "Un cordial saludo,"
- NEVER translate English idioms literally`,
  },

  // ── General Latin America (Peru, Ecuador, Venezuela, Bolivia, Paraguay, etc.) ──
  peru: {
    language: "Spanish",
    variant: "Peruvian Spanish (Latin American)",
    formality: "usted",
    bannedPhrases: SPANISH_BANNED_COMMON,
    promptInstructions: `LANGUAGE: Write entirely in Latin American Spanish appropriate for Peru.
- Use "usted" throughout for professional outreach
- Warm and respectful business tone
- Natural closings: "Cordialmente," / "Un saludo,"
- NEVER translate English idioms literally`,
  },

  // ── Brazil ──
  brazil: {
    language: "Portuguese",
    variant: "Brazilian Portuguese",
    formality: "standard",
    bannedPhrases: PORTUGUESE_BRAZIL_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in Brazilian Portuguese.
- This is Brazil — NOT European Portuguese. Use Brazilian spelling, vocabulary, and expressions.
- Use "você" (not "tu" except in Rio/Northeast casual) and "vocês" for plural
- Tone is warm, direct, and relatively informal even in business — less stiff than European Portuguese
- Never say "a minha empresa" — say "minha empresa" (Brazilian Portuguese drops the definite article)
- Natural openings: "Olá [nome]," / "Bom dia [nome],"
- Natural closings: "Abraços," / "Att.," / "Atenciosamente,"
- NEVER translate English idioms literally — rephrase them naturally in Brazilian Portuguese`,
  },

  // ── France ──
  france: {
    language: "French",
    variant: "French",
    formality: "vous",
    bannedPhrases: FRENCH_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in French.
- Use "vous" throughout — French business communication is formal
- French business writing is direct and doesn't waste words; avoid excessive pleasantries
- Natural openings: "Bonjour [prénom]," / "Madame, Monsieur,"
- Natural closings: "Cordialement," / "Bien à vous," (less formal)
- NEVER translate English idioms literally into French — they often sound absurd
- The tone should be confident and professional, not warm-and-fuzzy`,
  },

  // ── Germany / Austria ──
  germany: {
    language: "German",
    variant: "German",
    formality: "Sie",
    bannedPhrases: GERMAN_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in German.
- Use "Sie" (formal) throughout — never "du" in cold outreach
- German business writing values clarity, directness, and structure — no fluff
- Get to the point quickly; explain the value proposition in concrete terms
- Natural openings: "Sehr geehrte/r [Name]," / "Guten Tag [Name],"
- Natural closings: "Mit freundlichen Grüßen," (standard) or "Viele Grüße," (slightly warmer)
- NEVER translate English idioms literally — rephrase them in natural German business style`,
  },

  austria: {
    language: "German",
    variant: "Austrian German",
    formality: "Sie",
    bannedPhrases: GERMAN_BANNED,
    promptInstructions: `LANGUAGE: Write entirely in Austrian German.
- Use "Sie" throughout
- Austrian business tone is slightly more formal and courteous than German
- Use "Sehr geehrte/r [Titel] [Nachname]," for openings
- Closings: "Mit freundlichen Grüßen," / "Hochachtungsvoll,"
- NEVER translate English idioms literally`,
  },

  // ── Arabic-speaking countries ──
  uae: {
    language: "Arabic",
    variant: "Gulf Arabic (UAE)",
    formality: "standard",
    bannedPhrases: [],
    promptInstructions: `LANGUAGE: Write entirely in Modern Standard Arabic (فصحى) with Gulf business conventions.
- The UAE is multicultural; if you're unsure of the lead's native language, lean toward formal MSA
- Warm and respectful openings: "السلام عليكم" or "صباح الخير / مساء الخير"
- Use honorifics when appropriate: "الأستاذ" / "الدكتور"
- Business culture in the UAE values relationship-building over hard pitches
- Keep the ask light and relationship-focused
- NEVER directly translate English business idioms into Arabic — rephrase naturally`,
  },

  "saudi arabia": {
    language: "Arabic",
    variant: "Gulf Arabic (Saudi Arabia)",
    formality: "standard",
    bannedPhrases: [],
    promptInstructions: `LANGUAGE: Write entirely in Modern Standard Arabic appropriate for Saudi business professionals.
- Use formal MSA (فصحى) with respectful Saudi conventions
- Openings: "السلام عليكم ورحمة الله وبركاته" / "حفظكم الله"
- Use honorifics: "الأستاذ" / "الأخ الكريم" / "الدكتور"
- Saudi business culture is relationship-first — build rapport before pitching
- NEVER translate English idioms literally into Arabic`,
  },

  // ── Japan ──
  japan: {
    language: "Japanese",
    variant: "Business Japanese",
    formality: "standard",
    bannedPhrases: [
      "お元気でしょうか (too casual for cold outreach)",
      "ご連絡をお待ちしております (overused — rephrase)",
    ],
    promptInstructions: `LANGUAGE: Write entirely in Japanese (日本語) using keigo (business formal register).
- Use polite formal language (丁寧語 and 尊敬語) appropriate for cold business outreach
- Japanese business communication is indirect and relationship-focused — don't be abrupt
- Start with a brief self-introduction: 「突然のご連絡、失礼いたします」
- Get to the point but wrap the ask in appropriate courtesy
- Openings: "株式会社〇〇の〇〇様" or "〇〇様"
- Closings: "何卒よろしくお願いいたします" / "ご検討のほど、よろしくお願い申し上げます"
- NEVER translate English idioms literally into Japanese`,
  },

  // ── South Korea ──
  "south korea": {
    language: "Korean",
    variant: "Business Korean",
    formality: "standard",
    bannedPhrases: [],
    promptInstructions: `LANGUAGE: Write entirely in Korean (한국어) using formal polite speech (합쇼체).
- Korean business culture is hierarchical — use formal, respectful language
- Brief self-introduction is expected: "안녕하세요, 저는 New Dawn Franchising의 Dylan Delaney입니다"
- Get to value quickly but maintain respectful tone
- Closings: "감사합니다" / "잘 부탁드립니다"
- NEVER translate English idioms literally into Korean`,
  },

  // ── China ──
  china: {
    language: "Chinese",
    variant: "Simplified Chinese (Mandarin)",
    formality: "standard",
    bannedPhrases: [
      "希望这封邮件一切安好 (AI giveaway — remove)",
      "请随时与我联系 (too mechanical — rephrase)",
    ],
    promptInstructions: `LANGUAGE: Write entirely in Simplified Chinese (简体中文) suitable for mainland Chinese business professionals.
- Formal but not stiff — Chinese business writing is direct and value-focused
- Respect is shown through concrete value, not excessive formalities
- Use "您" not "你" in business correspondence
- Openings: "尊敬的[姓名]先生/女士" / "[姓名]您好"
- Closings: "期待您的回复" / "谢谢您的时间"
- NEVER translate English idioms literally into Chinese`,
  },

  // ── India — English is the business language ──
  india: {
    language: "English",
    variant: "Indian English (business)",
    formality: "standard",
    bannedPhrases: [
      "Revert back to me (say 'reply' instead)",
      "Do the needful (avoid)",
      "Kindly do the needful",
      "Please revert",
    ],
    promptInstructions: `LANGUAGE: Write in English — India's primary business language.
- Indian business English is formal and respectful
- Avoid overly casual American idioms that may not land
- Note the lead's background in personalization`,
  },

  // ── Israel ──
  israel: {
    language: "Hebrew",
    variant: "Israeli Hebrew",
    formality: "standard",
    bannedPhrases: [],
    promptInstructions: `LANGUAGE: Write in Hebrew (עברית) for business outreach in Israel.
- Israeli business culture is direct and informal — don't be stiff
- Get to the point quickly; Israelis value directness ("dugri")
- Use "אתה/את" (informal "you") rather than formal — Israeli business culture uses first names and informal address
- Short, punchy messaging works well
- NEVER translate English idioms literally into Hebrew`,
  },

  // ── Italy ──
  italy: {
    language: "Italian",
    variant: "Italian",
    formality: "standard",
    bannedPhrases: [
      "Spero che questa email la trovi bene",
      "Non esiti a contattarmi",
      "Cordiali saluti (overused)",
    ],
    promptInstructions: `LANGUAGE: Write entirely in Italian.
- Use "Lei" (formal) for cold business outreach
- Italian business writing is warm but professional — more relationship-focused than northern Europe
- Natural openings: "Gentile [Nome]," / "Buongiorno [Nome],"
- Natural closings: "Distinti saluti," / "Cordiali saluti," / "A presto,"
- NEVER translate English idioms literally into Italian`,
  },

  // ── Turkey ──
  turkey: {
    language: "Turkish",
    variant: "Turkish",
    formality: "standard",
    bannedPhrases: [],
    promptInstructions: `LANGUAGE: Write entirely in Turkish.
- Use formal address: "Sayın [İsim] Bey/Hanım"
- Turkish business writing is respectful and relationship-oriented
- Closings: "Saygılarımla," / "İyi çalışmalar,"
- NEVER translate English idioms literally into Turkish`,
  },
};

// Alias mappings for country name variants
const COUNTRY_ALIASES: Record<string, string> = {
  "united arab emirates": "uae",
  "uae": "uae",
  "saudi": "saudi arabia",
  "ksa": "saudi arabia",
  "south korea": "south korea",
  "korea": "south korea",
  "republic of korea": "south korea",
  "japan": "japan",
  "china": "china",
  "mainland china": "china",
  "prc": "china",
  "brazil": "brazil",
  "brasil": "brazil",
  "mexico": "mexico",
  "méxico": "mexico",
  "spain": "spain",
  "españa": "spain",
  "argentina": "argentina",
  "colombia": "colombia",
  "chile": "chile",
  "peru": "peru",
  "perú": "peru",
  "venezuela": "peru", // use same generic LATAM profile
  "ecuador": "peru",
  "bolivia": "peru",
  "paraguay": "peru",
  "uruguay": "argentina", // use Argentina/Rioplatense profile
  "france": "france",
  "germany": "germany",
  "deutschland": "germany",
  "austria": "austria",
  "india": "india",
  "israel": "israel",
  "italy": "italy",
  "italia": "italy",
  "turkey": "turkey",
  "türkiye": "turkey",
};

// English-speaking countries where no language injection is needed
const ENGLISH_COUNTRIES = new Set([
  "united states", "usa", "us", "united kingdom", "uk", "england", "scotland",
  "wales", "ireland", "australia", "new zealand", "canada", "singapore",
  "south africa", "nigeria", "kenya", "ghana", "philippines", "jamaica",
  "trinidad", "barbados", "bahamas",
]);

export function detectLanguageProfile(country: string | null | undefined): LanguageProfile | null {
  if (!country) return null;
  const normalized = country.toLowerCase().trim();
  if (ENGLISH_COUNTRIES.has(normalized)) return null;

  const key = COUNTRY_ALIASES[normalized] ?? normalized;
  return PROFILES[key] ?? null;
}

/**
 * Returns a string block to inject directly into AI system prompts.
 * Returns empty string for English-speaking countries or unknown countries.
 */
export function buildLanguageInstructions(country: string | null | undefined): string {
  const profile = detectLanguageProfile(country);
  if (!profile) return "";

  const bannedList = profile.bannedPhrases.length > 0
    ? `\nBANNED PHRASES IN ${profile.language.toUpperCase()} (dead-giveaway AI translations — never use):\n${profile.bannedPhrases.map(p => `- "${p}"`).join("\n")}`
    : "";

  return `
${profile.promptInstructions}
${bannedList}
`.trim();
}

/**
 * Returns the full profile for logging/debugging purposes.
 */
export function getLanguageLabel(country: string | null | undefined): string {
  const profile = detectLanguageProfile(country);
  if (!profile) return "English";
  return profile.variant || profile.language;
}

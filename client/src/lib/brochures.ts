// Brochure download helpers — shared by the gated <BrochureDownload> component and
// the /partners page.
//
// We ship six designed PDFs in client/public/brochures (served at /brochures/...):
//   investor-brochure-{en,es,zh-TW}.pdf   — 6-page E-2 investor brochure
//   partner-brochure-{en,es,zh-TW}.pdf    — 1-page broker / referral-partner brochure
//
// Brochures exist only in English, Spanish, and Traditional Chinese, while the site
// routes through more locales (en/es/fr/zh/ja/ko/tr). So we map the current route
// locale down to the nearest available brochure language: zh -> zh-TW, es -> es, and
// every locale without a translated brochure (en/fr/ja/ko/tr) -> en. The download UI
// also lets the visitor override this with an EN · ES · 中文 selector.

export type BrochureKind = "investor" | "partner";
export type BrochureLang = "en" | "es" | "zh-TW";

/** Options for the EN · ES · 中文 language selector shown next to each download. */
export const BROCHURE_LANGS: { value: BrochureLang; short: string; label: string }[] = [
  { value: "en", short: "EN", label: "English" },
  { value: "es", short: "ES", label: "Español" },
  { value: "zh-TW", short: "中文", label: "中文 (繁體)" },
];

/**
 * Derive the default brochure language from the current wouter route.
 * `/zh` -> "zh-TW", `/es` (and `/es/...`) -> "es", everything else -> "en".
 */
export function brochureLangFromPath(path: string): BrochureLang {
  if (path === "/zh" || path.startsWith("/zh/")) return "zh-TW";
  if (path === "/es" || path.startsWith("/es/")) return "es";
  return "en";
}

/** Public URL of a brochure PDF (served from client/public/brochures). */
export function brochureUrl(kind: BrochureKind, lang: BrochureLang): string {
  return `/brochures/${kind}-brochure-${lang}.pdf`;
}

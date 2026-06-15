import { Link, useLocation } from "wouter";

// Text-based locale switcher (e.g. EN / ES). Deliberately NOT flag icons —
// flags represent countries, not languages. Add new locales here as their
// landing pages ship (e.g. /fr, /zh); the UI scales automatically.
type Locale = { code: string; label: string; href: string };

const LOCALES: Locale[] = [
  { code: "en", label: "EN", href: "/" },
  { code: "es", label: "ES", href: "/es" },
  { code: "fr", label: "FR", href: "/fr" },
  { code: "zh", label: "中文", href: "/zh" },
];

function currentCode(location: string): string {
  const match = LOCALES.find(
    (l) => l.href !== "/" && (location === l.href || location.startsWith(l.href + "/")),
  );
  return match ? match.code : "en";
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [location] = useLocation();
  const active = currentCode(location);

  return (
    <div
      data-testid="language-switcher"
      className={"inline-flex items-center gap-1 text-xs " + className}
      aria-label="Language"
    >
      {LOCALES.map((locale, i) => {
        const isActive = locale.code === active;
        return (
          <span key={locale.code} className="inline-flex items-center">
            {i > 0 && <span className="px-1 text-foreground/25">/</span>}
            <Link
              href={locale.href}
              data-testid={`link-lang-${locale.code}`}
              aria-current={isActive ? "true" : undefined}
              translate="no"
              className={
                "rounded px-1 py-0.5 transition-colors " +
                (isActive
                  ? "font-semibold text-foreground"
                  : "text-foreground/60 hover:text-foreground")
              }
            >
              {locale.label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}

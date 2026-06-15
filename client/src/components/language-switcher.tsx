import { useLocation } from "wouter";
import { Globe, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Locale switcher. Text labels (not flag icons — flags represent countries, not
// languages). Add new locales here as their landing pages ship; the dropdown
// scales automatically. Rendered as a compact dropdown so it stays tidy in the
// header/footer regardless of how many locales exist.
type Locale = { code: string; label: string; href: string };

const LOCALES: Locale[] = [
  { code: "en", label: "English", href: "/" },
  { code: "es", label: "Español", href: "/es" },
  { code: "fr", label: "Français", href: "/fr" },
  { code: "zh", label: "中文", href: "/zh" },
  { code: "ja", label: "日本語", href: "/ja" },
  { code: "ko", label: "한국어", href: "/ko" },
  { code: "tr", label: "Türkçe", href: "/tr" },
];

// Short labels for the trigger button (keeps the header compact).
const SHORT: Record<string, string> = {
  en: "EN",
  es: "ES",
  fr: "FR",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  tr: "TR",
};

function currentLocale(location: string): Locale {
  const match = LOCALES.find(
    (l) => l.href !== "/" && (location === l.href || location.startsWith(l.href + "/")),
  );
  return match ?? LOCALES[0];
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const [location, navigate] = useLocation();
  const active = currentLocale(location);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="language-switcher"
        aria-label="Language"
        className={
          "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-foreground/70 transition-colors hover:bg-black/[0.03] hover:text-foreground " +
          className
        }
      >
        <Globe className="size-3.5" />
        <span translate="no">{SHORT[active.code]}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {LOCALES.map((locale) => {
          const isActive = locale.code === active.code;
          return (
            <DropdownMenuItem
              key={locale.code}
              data-testid={`link-lang-${locale.code}`}
              translate="no"
              onSelect={() => navigate(locale.href)}
              className="flex items-center justify-between gap-2"
            >
              <span>{locale.label}</span>
              {isActive && <Check className="size-3.5 opacity-70" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

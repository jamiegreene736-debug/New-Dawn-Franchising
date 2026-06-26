// Reusable "Download the brochure" CTA — a SECONDARY action that sits beneath the
// primary "Request the FDD" / book-a-call CTA. Clicking opens a light gated form
// (email required, name + country optional) that captures the lead through the
// existing /api/leads pipeline, then reveals the correct-language PDF. A
// "view in browser" link lets friction-averse visitors open the PDF ungated.
//
// COMPLIANCE: the brochure MARKETS; it is never an offer. The FDD (Item 19) is the
// actual disclosure/offer, so every brochure path points onward to "Request the FDD".
// The investor and partner/broker journeys are kept separate (distinct `kind` +
// distinct CRM lead source); broker commission/override figures never appear here.
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, ExternalLink, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import {
  BROCHURE_LANGS,
  type BrochureKind,
  type BrochureLang,
  brochureLangFromPath,
  brochureUrl,
} from "@/lib/brochures";

// Kept in sync with the list in request-fdd.tsx / contact.tsx.
const COUNTRIES = [
  "Mexico", "Canada", "Colombia", "Argentina", "Brazil", "Chile", "Peru", "Venezuela",
  "Spain", "Germany", "France", "United Kingdom", "Italy", "Portugal", "Netherlands", "Belgium",
  "Turkey", "South Korea", "Japan", "China", "India", "Pakistan", "Australia", "New Zealand",
  "South Africa", "Nigeria", "Kenya", "UAE", "Saudi Arabia", "Israel", "Other",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg";

type BrochureDownloadProps = {
  /** Which brochure + lead journey. Defaults to the investor brochure. */
  kind?: BrochureKind;
  /** Override the trigger button label. */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  testId?: string;
};

const COPY: Record<BrochureKind, { trigger: string; title: string; description: string; eventType: string; leadType: string }> = {
  investor: {
    trigger: "Download the brochure",
    title: "Download the investor brochure",
    description:
      "A quick overview of the New Dawn E-2 franchise opportunity. The brochure is a summary, not an offer — franchises are offered only through the FDD.",
    eventType: "investor",
    leadType: "investor-brochure",
  },
  partner: {
    trigger: "Download the partner one-pager",
    title: "Download the partner one-pager",
    description:
      "An overview of the New Dawn referral-partner program for brokers, attorneys, and advisors who introduce qualified E-2 investors.",
    eventType: "partner",
    leadType: "partner-broker",
  },
};

export function BrochureDownload({
  kind = "investor",
  label,
  variant = "outline",
  size = "default",
  className,
  testId,
}: BrochureDownloadProps) {
  const [location] = useLocation();
  const { toast } = useToast();
  const copy = COPY[kind];

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [company, setCompany] = useState("");
  const [lang, setLang] = useState<BrochureLang>(() => brochureLangFromPath(location));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pdfUrl = brochureUrl(kind, lang);
  const langLabel = BROCHURE_LANGS.find((l) => l.value === lang)?.label ?? lang;

  function viewInBrowser() {
    trackEvent("brochure_view", { brochure_type: copy.eventType, language: lang });
  }

  function onDownloadClick() {
    trackEvent("brochure_download", { brochure_type: copy.eventType, language: lang });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      const note =
        kind === "partner"
          ? `[Partner / Broker Inquiry]${company.trim() ? ` Company: ${company.trim()}.` : ""} Preferred language: ${langLabel}.`
          : `[Investor Brochure]${country.trim() ? ` Country: ${country.trim()}.` : ""} Preferred language: ${langLabel}.`;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name.trim() || email.trim().split("@")[0],
          email: email.trim(),
          country: country.trim() || undefined,
          message: note,
          leadType: copy.leadType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Something went wrong");
      }
      trackEvent("brochure_lead", { brochure_type: copy.eventType, language: lang });
      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Couldn't submit",
        description: err?.message || "Please try again, or use the view-in-browser link below.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          data-testid={testId ?? `button-brochure-${kind}`}
          variant={variant}
          size={size}
          className={className ? `gap-2 ${className}` : "gap-2"}
        >
          <FileDown className="size-4" />
          {label ?? copy.trigger}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md" data-testid={`dialog-brochure-${kind}`}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div data-testid={`brochure-success-${kind}`} className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="grid size-12 place-items-center rounded-full border bg-[hsl(var(--accent))]/10">
              <CheckCircle2 className="size-6 text-[hsl(var(--accent))]" />
            </div>
            <div className="text-base font-semibold">Your brochure is ready</div>
            <Button data-testid={`button-brochure-open-${kind}`} className="w-full gap-2" asChild>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" onClick={onDownloadClick}>
                <FileDown className="size-4" />
                Open the {langLabel} brochure
              </a>
            </Button>
            {kind === "investor" && (
              <div className="w-full rounded-lg border bg-white/60 p-3 text-sm text-muted-foreground">
                The brochure is an overview. The full offer and financials live in the FDD (Item 19).
                <Button data-testid="button-brochure-next-fdd" variant="link" className="mt-1 h-auto gap-1 p-0" asChild>
                  <a href="/request-fdd">
                    Request the FDD
                    <ArrowRight className="size-3.5" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor={`brochure-name-${kind}`}>Name (optional)</Label>
              <Input
                data-testid={`input-brochure-name-${kind}`}
                id={`brochure-name-${kind}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`brochure-email-${kind}`}>Email *</Label>
              <Input
                data-testid={`input-brochure-email-${kind}`}
                id={`brochure-email-${kind}`}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="you@example.com"
                required
                aria-required="true"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? `brochure-email-err-${kind}` : undefined}
                autoComplete="email"
              />
              {emailError && (
                <p id={`brochure-email-err-${kind}`} className="text-[0.8rem] font-medium text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            {kind === "investor" ? (
              <div className="grid gap-1.5">
                <Label htmlFor={`brochure-country-${kind}`}>Country (optional)</Label>
                <select
                  data-testid={`select-brochure-country-${kind}`}
                  id={`brochure-country-${kind}`}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor={`brochure-company-${kind}`}>Company / brokerage (optional)</Label>
                <Input
                  data-testid={`input-brochure-company-${kind}`}
                  id={`brochure-company-${kind}`}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Your firm"
                  autoComplete="organization"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Language</span>
              <div role="radiogroup" aria-label="Brochure language" className="inline-flex rounded-md border p-0.5">
                {BROCHURE_LANGS.map((l) => {
                  const active = l.value === lang;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`button-brochure-lang-${kind}-${l.value}`}
                      onClick={() => setLang(l.value)}
                      className={
                        "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors " +
                        (active
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "text-foreground/70 hover:bg-black/[0.04]")
                      }
                    >
                      <span translate="no">{l.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button data-testid={`button-brochure-submit-${kind}`} type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              {submitting ? "Preparing…" : "Get the brochure"}
            </Button>

            <a
              data-testid={`link-brochure-view-${kind}`}
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={viewInBrowser}
              className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Prefer not to share your details? View the brochure in your browser
            </a>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

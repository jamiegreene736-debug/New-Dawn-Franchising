// NOTE: submits into the existing /api/leads pipeline (creates a CRM client + email notifications). No separate HubSpot hook exists in this repo; vertical-of-interest is folded into the message field because the leads schema has no vertical column. Flagged for client review.
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

const SEO = {
  title: "Request the FDD | New Dawn Franchising E-2 Visa Franchise",
  description:
    "Request the New Dawn Franchising Franchise Disclosure Document (FDD). Share your treaty country and vertical of interest and we'll send the FDD, confirm your timeline, and schedule a call. Investment from $225,000.",
  canonical: "https://www.newdawnfranchising.com/request-fdd",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

// Reused from contact.tsx — keep in sync if that list changes.
const COUNTRIES = [
  "", "Mexico", "Canada", "Colombia", "Argentina", "Brazil", "Chile", "Peru", "Venezuela",
  "Spain", "Germany", "France", "United Kingdom", "Italy", "Portugal", "Netherlands", "Belgium",
  "Turkey", "South Korea", "Japan", "China", "India", "Pakistan", "Australia", "New Zealand",
  "South Africa", "Nigeria", "Kenya", "UAE", "Saudi Arabia", "Israel", "Other",
];

const VERTICALS = [
  { value: "", label: "Select one…" },
  { value: "Property Management", label: "Property Management" },
  { value: "Telecom", label: "Telecom" },
  { value: "Insurance", label: "Insurance" },
  { value: "Not sure yet", label: "Not sure yet" },
];

const NEXT_STEPS = [
  { t: "We send you the FDD plus a franchise overview", id: "n1" },
  { t: "We confirm your treaty country and investment timeline", id: "n2" },
  { t: "We schedule a short intro call to answer your questions", id: "n3" },
];

type FddFormState = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  vertical: string;
  message: string;
};

const DEFAULTS: FddFormState = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  vertical: "",
  message: "",
};

function setMetaTag(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !el;
  const previous = el?.getAttribute("content") ?? null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return () => {
    if (created) el?.remove();
    else if (previous !== null) el?.setAttribute("content", previous);
  };
}

function useRequestFddSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO.title;

    const cleanups: Array<() => void> = [];
    cleanups.push(setMetaTag('meta[name="description"]', "name", "description", SEO.description));
    cleanups.push(setMetaTag('meta[property="og:title"]', "property", "og:title", SEO.title));
    cleanups.push(setMetaTag('meta[property="og:description"]', "property", "og:description", SEO.description));
    cleanups.push(setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", SEO.title));
    cleanups.push(setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", SEO.description));

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const prevCanonical = canonical?.getAttribute("href") ?? null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SEO.canonical);

    return () => {
      document.title = prevTitle;
      cleanups.forEach((fn) => fn());
      if (createdCanonical) canonical?.remove();
      else if (prevCanonical !== null) canonical?.setAttribute("href", prevCanonical);
    };
  }, []);
}

export default function RequestFddPage() {
  useRequestFddSeo();
  const { toast } = useToast();
  const [state, setState] = useState<FddFormState>(DEFAULTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FddFormState>(key: K, value: FddFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!state.fullName.trim() || !state.email.trim()) {
      toast({
        title: "Missing info",
        description: "Please add your name and email.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // The leads schema accepts { fullName, email, phone, country, timeline, capitalRange, message }.
      // Nationality maps to `country`; vertical-of-interest is folded into the message string.
      const payload = {
        fullName: state.fullName,
        email: state.email,
        phone: state.phone,
        country: state.country,
        timeline: "",
        capitalRange: "",
        message: [
          "[FDD Request]",
          state.vertical ? `Vertical of interest: ${state.vertical}` : "",
          state.message,
        ]
          .filter(Boolean)
          .join("\n\n"),
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Something went wrong");
      }

      setSubmitted(true);
      toast({
        title: "Request received",
        description: "We'll be in touch shortly with the FDD and overview.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't submit",
        description: err.message || "Please try again or email us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div data-testid="page-request-fdd" className="min-h-screen">
      <section data-testid="section-fdd-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <FileText className="size-3.5 text-[hsl(var(--accent))]" />
              Franchise Disclosure Document
            </div>
            <h1 data-testid="fdd-title" className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Request the FDD
            </h1>
            <p
              data-testid="fdd-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Tell us a little about yourself and we'll send you the New Dawn Franchising Franchise Disclosure Document
              and overview. Investment from $225,000. <span lang="es" className="text-foreground/50">También hablamos español.</span>
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-[.9fr_1.1fr]">
            {/* Left column — what the FDD is + what happens next */}
            <Card data-testid="card-fdd-intro" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-11 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                <FileText className="size-5 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">What is the FDD?</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The Franchise Disclosure Document (FDD) is the formal disclosure a franchisor provides under the FTC
                Franchise Rule. It covers the investment, fees, obligations, and the relationship between you and New
                Dawn Franchising — the detailed information you need to evaluate the opportunity with your own advisors.
              </p>

              <div className="mt-6 text-sm font-semibold">What happens next</div>
              <div className="mt-4 grid gap-3">
                {NEXT_STEPS.map((x) => (
                  <div
                    key={x.id}
                    data-testid={`row-fdd-next-${x.id}`}
                    className="flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 text-[hsl(var(--accent))]" />
                    <div className="text-sm text-muted-foreground">{x.t}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border bg-white/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Phone className="size-4 text-[hsl(var(--primary))]" />
                    Prefer to call?
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Reach us at <a href={`tel:${COMPANY.phoneTel}`} className="font-semibold text-foreground hover:underline">{COMPANY.phone}</a>
                  </div>
                </div>
                <a href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border bg-white/60 p-4 transition-colors hover:bg-white/80">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="size-4 text-[hsl(var(--primary))]" />
                    Our office
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{COMPANY.addressFull}</div>
                </a>
              </div>
            </Card>

            {/* Right column — the form */}
            <Card data-testid="card-fdd-form" className="nh-surface nh-noise border-card-border/80 p-6">
              {submitted ? (
                <div data-testid="form-success" className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="grid size-14 place-items-center rounded-full border bg-[hsl(var(--accent))]/10">
                    <CheckCircle2 className="size-7 text-[hsl(var(--accent))]" />
                  </div>
                  <div className="text-xl font-semibold">Confirmed — we've received your request</div>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Thanks, {state.fullName.split(" ")[0]}! A member of our team will be in touch shortly with the FDD
                    and a franchise overview.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label data-testid="label-fullname" htmlFor="fullName">
                      Full name *
                    </Label>
                    <Input
                      data-testid="input-fullname"
                      id="fullName"
                      value={state.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label data-testid="label-email" htmlFor="email">
                        Email *
                      </Label>
                      <Input
                        data-testid="input-email"
                        id="email"
                        type="email"
                        value={state.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label data-testid="label-phone" htmlFor="phone">
                        Phone (optional)
                      </Label>
                      <Input
                        data-testid="input-phone"
                        id="phone"
                        value={state.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="+1 (___) ___-____"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label data-testid="label-country" htmlFor="country">
                      Nationality / treaty country
                    </Label>
                    <select
                      data-testid="select-country"
                      id="country"
                      value={state.country}
                      onChange={(e) => update("country", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select country…</option>
                      {COUNTRIES.filter(Boolean).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label data-testid="label-vertical" htmlFor="vertical">
                      Vertical of interest
                    </Label>
                    <select
                      data-testid="select-vertical"
                      id="vertical"
                      value={state.vertical}
                      onChange={(e) => update("vertical", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {VERTICALS.map((v) => (
                        <option key={v.value || "placeholder"} value={v.value} disabled={v.value === ""}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label data-testid="label-message" htmlFor="message">
                      Message (optional)
                    </Label>
                    <Textarea
                      data-testid="textarea-message"
                      id="message"
                      value={state.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder="Tell us about your goals, timeline, or any questions…"
                      className="min-h-28"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button data-testid="button-submit-fdd" type="submit" className="gap-2" disabled={isSubmitting}>
                      <Mail className="size-4" />
                      {isSubmitting ? "Submitting…" : "Request the FDD"}
                    </Button>
                    <div data-testid="text-form-note" className="text-xs text-muted-foreground">
                      Submitting this form requests franchise information; it is not legal or immigration advice.
                    </div>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* ── Page-level fine-print disclaimer ── */}
      <section data-testid="section-fdd-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              <ShieldCheck className="size-3" />
              Important disclaimer
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              This page is for informational purposes only and is not an offer to sell or the solicitation of an offer
              to buy a franchise. Franchises are offered solely through a Franchise Disclosure Document in compliance
              with the FTC Franchise Rule and applicable state law, and only in states where New Dawn Franchising is
              registered, exempt, or otherwise authorized. New Dawn Franchising does not provide legal or immigration
              advice and does not guarantee any E-2 visa approval or any financial result. Prospective investors should
              consult independent legal, immigration, and financial advisors.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

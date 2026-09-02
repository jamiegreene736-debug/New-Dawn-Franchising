// Public "Partners / Refer & Earn" page — a SEPARATE path from the investor
// journey, reached from the footer + a secondary nav slot. It markets the referral
// program to franchise brokers, immigration attorneys, and advisors, and gates the
// 1-page broker brochure behind a light partner-inquiry form (BrochureDownload
// kind="partner", tagged as a partner/broker lead in the CRM).
//
// COMPLIANCE: never surface commission/override figures here. Partner-comp numbers
// live only in admin-gated server code (server/partner-sequence-service.ts) and are
// disclosed privately in the Partner Commission Schedule on agreement — mirror the
// gated portal's vague language ("earn a partner fee", "rate provided on agreement").
import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Handshake,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrochureDownload } from "@/components/brochure-download";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
};

const SEO = {
  title: "Partner Program — Refer & Earn | New Dawn Franchising",
  description:
    "Partner with New Dawn Franchising. Franchise brokers, immigration attorneys, and advisors earn a partner fee for every qualified E-2 investor they introduce who becomes a franchisee. Download the partner one-pager.",
  canonical: "https://www.newdawnfranchising.com/partners",
};

const AUDIENCE = [
  { icon: Handshake, title: "Franchise brokers & consultants", desc: "Add a differentiated, E-2-ready franchise to the opportunities you present to international clients." },
  { icon: ShieldCheck, title: "Immigration attorneys", desc: "Refer clients to a real, operating U.S. business structured around E-2 Treaty Investor requirements." },
  { icon: Users, title: "Wealth & relocation advisors", desc: "Introduce clients exploring U.S. residency through investment to a director-led ownership model: they own and direct the business; New Dawn implements the day-to-day." },
];

const STEPS = [
  { n: "1", title: "Introduce a qualified investor", desc: "Send us a warm introduction to a prospective E-2 investor in your network." },
  { n: "2", title: "We handle the heavy lifting", desc: "Our team manages the FDD, discovery process, and onboarding from first call through signing." },
  { n: "3", title: "You earn a partner fee", desc: "When your referred client funds their franchise, you earn a partner fee. The rate is set out in the Partner Commission Schedule provided on agreement." },
];

const BENEFITS = [
  "A dedicated partnerships contact and co-branded materials",
  "Transparent client tracking through the Broker Portal",
  "Multilingual support for investors (English, Spanish, 中文)",
  "A clear written Referring Partner agreement — no ambiguity",
];

function usePartnersSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO.title;

    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
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
    };

    const cleanups = [
      setMeta('meta[name="description"]', "name", "description", SEO.description),
      setMeta('meta[property="og:title"]', "property", "og:title", SEO.title),
      setMeta('meta[property="og:description"]', "property", "og:description", SEO.description),
    ];

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

export default function PartnersPage() {
  usePartnersSeo();

  return (
    <div data-testid="page-partners" className="min-h-screen">
      {/* ── Hero ── */}
      <section data-testid="section-partners-hero" className="border-b">
        <div className="nh-container py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Handshake className="size-3.5 text-[hsl(var(--accent))]" />
              Partner Program
            </div>
            <h1 data-testid="partners-title" className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Refer investors. Earn for every funded franchise.
            </h1>
            <p data-testid="partners-subtitle" className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              Franchise brokers, immigration attorneys, and advisors partner with New Dawn Franchising to introduce
              qualified E-2 investors to a real, operating U.S. business — and earn a partner fee when they become
              franchisees.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <BrochureDownload
                kind="partner"
                variant="default"
                label="Get the partner one-pager"
                testId="button-partners-hero-brochure"
              />
              <Button data-testid="button-partners-hero-contact" variant="secondary" className="gap-2" asChild>
                <Link href="/contact?type=broker">
                  Talk to our partnerships team
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Already a registered partner?{" "}
              <Link href="/brokers" data-testid="link-partners-portal" className="font-medium text-[hsl(var(--primary))] hover:underline">
                Sign in to the Broker Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section data-testid="section-partners-audience" className="py-10 md:py-16">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">Built for the people investors already trust</h2>
            <p className="mt-3 text-muted-foreground">
              If you advise international clients on franchises, immigration, or relocation, the New Dawn model gives you
              a credible, E-2-ready opportunity to introduce.
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
            {AUDIENCE.map((a) => (
              <Card key={a.title} data-testid={`card-audience-${a.title}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-11 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <a.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{a.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section data-testid="section-partners-how" className="border-t bg-white/50 py-10 md:py-16">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">How the partnership works</h2>
          </div>
          <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} data-testid={`step-partners-${s.n}`} className="rounded-3xl border bg-white/60 p-6">
                <div className="grid size-9 place-items-center rounded-full bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
                  {s.n}
                </div>
                <div className="mt-4 text-base font-semibold">{s.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why partner ── */}
      <section data-testid="section-partners-benefits" className="py-10 md:py-16">
        <div className="nh-container">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Why partner with New Dawn</h2>
              <p className="mt-3 text-muted-foreground">
                You make the introduction; we do the rest — professionally, transparently, and with your client's
                experience front of mind.
              </p>
            </div>
            <ul className="grid gap-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <span className="text-sm text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section data-testid="section-partners-cta" className="border-t bg-white/50 py-10 md:py-16">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="partners-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Start earning as a New Dawn partner
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Download the one-page partner overview, then register in the Broker Portal to start referring clients and
              tracking their pipeline stage.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <BrochureDownload
                kind="partner"
                variant="default"
                label="Get the partner one-pager"
                testId="button-partners-cta-brochure"
              />
              <Button data-testid="button-partners-cta-portal" variant="secondary" className="gap-2" asChild>
                <Link href="/brokers">
                  <UserPlus className="size-4" />
                  Register in the Broker Portal
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-partners-email"
                href={`mailto:${COMPANY.email}?subject=Partner%20Program%20Inquiry`}
                className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Mail className="size-4 text-[hsl(var(--primary))]" />
                {COMPANY.email}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fine print ── */}
      <section data-testid="section-partners-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              <ShieldCheck className="size-3" />
              Important disclaimer
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              This page describes a referral relationship for professionals and is not an offer to sell a franchise.
              Franchises are offered solely through a Franchise Disclosure Document in compliance with the FTC Franchise
              Rule and applicable state law. Partner fees are paid only under a written Referring Partner agreement; the
              applicable rate and conditions are set out in the Partner Commission Schedule provided on agreement
              execution. New Dawn Franchising does not provide legal or immigration advice and does not guarantee any
              E-2 visa approval or any financial result.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

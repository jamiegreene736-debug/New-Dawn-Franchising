import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Cpu,
  FileText,
  Handshake,
  Headphones,
  LayoutDashboard,
  LineChart,
  Mail,
  MapPin,
  Network,
  Phone,
  Plus,
  Repeat,
  Rocket,
  Server,
  ShieldCheck,
  Signal,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  address: "2601 N Zaragoza Rd",
  city: "El Paso, TX 79938",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
};

const INVESTMENT_FROM = "$225,000";
const CANONICAL_URL = "https://www.newdawnfranchising.com/telecom";

// ─── SEO / metadata ───────────────────────────────────────────────────────────
// The site is a JS-rendered React app with a single static index.html, so per-page
// metadata is applied on the client here. (If/when the marketing pages move to
// server- or pre-rendering, this same title/description/JSON-LD can be emitted at
// build time so it is crawlable without executing JS.)
const SEO = {
  title:
    "New Dawn Franchising | Telecom Franchise for E-2 Visa Investors — Recurring-Revenue Telecom | El Paso, TX",
  description:
    "E-2 visa telecom franchise. Own and direct a recurring-revenue U.S. telecom business while New Dawn's teams run daily operations. Investment from $225,000. FDD available upon request.",
  ogImage: "https://www.newdawnfranchising.com/opengraph.jpg",
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// ─── Section 9 — FAQ (also emitted as FAQPage JSON-LD for SEO) ─────────────────
const FAQ_ITEMS = [
  {
    id: "what-sells",
    q: "What does the Telecom franchise actually sell?",
    // TODO(client): confirm the final, plain-language service mix before publish —
    // e.g. wireless/mobile plans, business internet & connectivity, hosted phone
    // (VoIP/UCaaS) — sold under New Dawn's established carrier and provider
    // agreements. Page copy and the FDD must not contradict. — see brief Placeholder #1 & FAQ #1.
    a: "The franchise signs residential and business customers to ongoing service agreements — such as mobile and wireless plans, business internet and connectivity, and hosted phone systems (VoIP/UCaaS) — sold under New Dawn's established carrier and provider relationships.",
  },
  {
    id: "recurring",
    q: "Where does the recurring revenue come from?",
    a: "Each customer signs an ongoing service agreement. The franchise earns activation compensation up front and recurring residual income each month the customer stays active, so revenue builds as the base grows and renews.",
  },
  {
    id: "day-to-day",
    q: "Do I have to run the day-to-day myself?",
    a: "No. You are the owner and director. Approved local teams handle daily execution while you maintain ownership control, bank-account oversight, and executive supervision through your owner dashboard.",
  },
  {
    id: "e2-support",
    q: "How does this support my E-2 visa?",
    a: "It's a real, operating business that you own and direct, generates recurring revenue, and employs U.S. workers — characteristics that support a credible E-2 petition and produce an auditable record for renewals. New Dawn does not provide legal or immigration advice or guarantee any visa outcome.",
  },
  {
    id: "live-anywhere",
    q: "Can I live anywhere in the U.S.?",
    a: "Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live elsewhere in the United States while maintaining executive oversight.",
  },
  {
    id: "investment",
    q: "How much do I invest?",
    a: "Telecom franchise investment starts at $225,000. The E-2 visa has no fixed minimum, but the investment must be substantial relative to the total cost of the business.",
  },
];

// ─── Section 1 — The business at a glance (service mix) ───────────────────────
// TODO(client): confirm the exact service mix and only name a specific carrier /
// platform partner once it is approved in writing. — see brief Placeholder #1.
const SERVICES = [
  {
    icon: Signal,
    title: "Mobile & wireless plans",
    desc: "Recurring residential and business mobile/wireless service activated under established carrier relationships.",
    id: "wireless",
  },
  {
    icon: Wifi,
    title: "Business internet & connectivity",
    desc: "Ongoing internet and connectivity service that companies depend on every day — billed on recurring terms.",
    id: "internet",
  },
  {
    icon: Headphones,
    title: "VoIP / hosted phone (UCaaS)",
    desc: "Cloud business phone, voicemail, and collaboration delivered on a per-seat monthly subscription.",
    id: "voip",
  },
  {
    icon: Network,
    title: "Managed mobility & add-ons",
    desc: "Device management, accessories, and add-on services layered onto the recurring base.",
    id: "mobility",
  },
];

// ─── Section 3 — We run it, you direct it ─────────────────────────────────────
const RUN_IT = [
  {
    icon: Users,
    title: "Approved local teams",
    // TODO(client): confirm the specific roles your operating teams cover
    // (sales, onboarding, retention/customer service, field/install). — see brief Placeholder #4.
    desc: "Day-to-day execution — sales, customer onboarding, retention and customer service — is handled by approved local teams.",
    id: "teams",
  },
  {
    icon: Cpu,
    title: "Proprietary technology",
    desc: "Sales workflows, customer communication, billing-support coordination, marketing, and lead generation that runs around the clock.",
    id: "tech",
  },
  {
    icon: LayoutDashboard,
    title: "Owner dashboards",
    desc: "Real-time visibility into sales, active subscribers, residual revenue, churn, and staffing — the information you use to supervise the team and make key decisions.",
    id: "dashboards",
  },
  {
    icon: Server,
    title: "Centralized back-office",
    desc: "Coordinates the carrier and provider relationships, compliance, and reporting so you keep executive focus.",
    id: "back-office",
  },
];

// ─── Section 4 — Roles a telecom operation creates ────────────────────────────
// TODO(client): confirm roles and any defensible, FDD-backed headcount targets.
// Keep qualitative unless the figure is supportable. — see brief Placeholder #4.
const JOBS = [
  {
    icon: TrendingUp,
    title: "Sales & account development",
    desc: "Signing new residential and business customers and growing the recurring book.",
    id: "sales",
  },
  {
    icon: Rocket,
    title: "Customer onboarding & account management",
    desc: "Provisioning service and configuring accounts for each new customer.",
    id: "onboarding",
  },
  {
    icon: Headphones,
    title: "Customer service & retention",
    desc: "The ongoing support that keeps recurring accounts active and renewing.",
    id: "retention",
  },
  {
    icon: Briefcase,
    title: "Operations & administration",
    desc: "Billing support, provider coordination, and back-office functions.",
    id: "operations",
  },
];

// ─── Section 5 — Why telecom works for E-2 investors ──────────────────────────
const WHY_E2 = [
  {
    icon: BadgeCheck,
    title: "You own and direct a real operating business",
    desc: "The foundation of a strong E-2 petition — an active enterprise with documented systems and supervisory control.",
    id: "own-direct",
  },
  {
    icon: Repeat,
    title: "Recurring revenue, not one-time sales",
    desc: "Predictable monthly income that compounds as your base grows and renews.",
    id: "recurring",
  },
  {
    icon: Users,
    title: "Creates U.S. jobs",
    desc: "Helps demonstrate the enterprise is not marginal and contributes to the local economy.",
    id: "jobs",
  },
  {
    icon: LineChart,
    title: "Auditable management trail",
    desc: "Owner dashboards and reporting create a clean record of your active oversight, supporting visa renewals.",
    id: "audit",
  },
  {
    icon: ShieldCheck,
    title: "Hands-off daily operations",
    desc: "Approved teams run execution; you keep executive control while living anywhere in the United States.",
    id: "hands-off",
  },
  {
    icon: Cpu,
    title: "Proprietary technology included",
    desc: "Built for E-2 investor oversight, not off-the-shelf software.",
    id: "tech",
  },
  {
    icon: Wallet,
    title: "In-house buy-back program",
    desc: "Available after approximately 4 years, giving owners a defined path for the next stage.",
    id: "buyback",
  },
  {
    icon: Briefcase,
    title: "Structured to meet E-2 capital requirements",
    desc: `Franchise investment from ${INVESTMENT_FROM}, backed by in-house E-2 immigration, finance, and legal professionals.`,
    id: "capital",
  },
];

// ─── Section 6 — How it works ─────────────────────────────────────────────────
const STEPS = [
  {
    title: "Invest in your telecom franchise",
    desc: `Acquire your New Dawn Telecom franchise starting at ${INVESTMENT_FROM}. The structured investment is designed to meet E-2 visa capital requirements and gives you a real, operating business.`,
    id: "invest",
  },
  {
    title: "Apply for your E-2 visa",
    desc: "Our partner immigration attorneys guide you through the application. You own and direct a legitimate U.S. telecom enterprise — the foundation of your petition.",
    id: "apply",
  },
  {
    title: "Local teams launch operations",
    desc: "Approved operating teams handle sales, onboarding, and customer service while you oversee performance through your owner dashboard.",
    id: "launch",
  },
  {
    title: "Grow your recurring base",
    desc: "As your subscriber base and residual income grow, you scale the team, build equity, and maintain executive control.",
    id: "grow",
  },
];

// ─── Section 8 — Is telecom the right vertical for you? ───────────────────────
// TODO(client): confirm any additional investor-fit criteria you want surfaced. — see brief Placeholder #5.
const FIT = [
  "Want a recurring-revenue business with compounding monthly income",
  "Are comfortable directing a sales-and-service operation",
  "Value a technology-driven, dashboard-supervised model",
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">{children}</div>
  );
}

function E2Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState<string | null>(FAQ_ITEMS[0].id);
  return (
    <div className="mx-auto mt-10 max-w-3xl space-y-2">
      {FAQ_ITEMS.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id} data-testid={`telecom-faq-${item.id}`} className="overflow-hidden rounded-xl border bg-white/60">
            <button
              data-testid={`telecom-faq-question-${item.id}`}
              onClick={() => setOpen(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-black/[0.02]"
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <Plus className={`size-4 shrink-0 text-foreground/40 transition-transform ${isOpen ? "rotate-45" : ""}`} />
            </button>
            {isOpen && (
              <div
                data-testid={`telecom-faq-answer-${item.id}`}
                className="border-t bg-white/40 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground"
              >
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TelecomPage() {
  // Apply page-level metadata + FAQPage structured data on mount; restore on unmount.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO.title;
    setMeta("name", "description", SEO.description);
    setMeta("property", "og:title", SEO.title);
    setMeta("property", "og:description", SEO.description);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", CANONICAL_URL);
    setMeta("property", "og:image", SEO.ogImage);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", SEO.title);
    setMeta("name", "twitter:description", SEO.description);
    setMeta("name", "twitter:image", SEO.ogImage);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    const prevCanonicalHref = canonical.getAttribute("href");
    canonical.setAttribute("href", CANONICAL_URL);

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.setAttribute("data-telecom-faq", "true");
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      ld.remove();
      if (createdCanonical) {
        canonical?.remove();
      } else if (prevCanonicalHref) {
        canonical?.setAttribute("href", prevCanonicalHref);
      }
    };
  }, []);

  return (
    <div data-testid="page-telecom" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-telecom-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Cpu className="size-3.5 text-[hsl(var(--accent))]" />
              About Us → Telecom · one of three New Dawn verticals
            </div>
            <h1
              data-testid="telecom-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Telecom: Recurring Revenue You Direct, Operations We Run
            </h1>
            <p
              data-testid="telecom-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              A real, operating U.S. telecom business built around recurring service contracts — structured so you own
              and direct the enterprise while New Dawn's teams and technology handle daily execution, exactly as the E-2
              visa requires.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-telecom-hero-fdd" className="gap-2" asChild>
                <Link href="/contact">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-telecom-hero-call" variant="secondary" className="gap-2" asChild>
                <Link href="/contact">
                  Schedule an Intro Call
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 1 — The business at a glance ── */}
      <section data-testid="section-telecom-glance" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The business at a glance</SectionEyebrow>
            <h2 data-testid="telecom-glance-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              A recurring-service telecom business
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The New Dawn Telecom franchise signs residential and business customers to ongoing service agreements —
              delivered through established carrier and provider relationships. The model is built on{" "}
              <span className="font-medium text-foreground">recurring revenue</span>, not one-time sales: every customer
              your franchise activates generates income month after month for as long as that customer stays on service,
              supported by centralized systems, structured sales workflows, and owner-level oversight dashboards.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <Card key={s.id} data-testid={`card-telecom-service-${s.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <s.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{s.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              This is the trait that makes telecom well-suited to the E-2 visa: a genuine operating enterprise with
              documented systems, staffing, supervisory control, and renewal-ready reporting — the characteristics that
              support a credible E-2 business.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — The contracts: where the revenue comes from ── */}
      <section data-testid="section-telecom-contracts" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Where the revenue comes from</SectionEyebrow>
            <h2 data-testid="telecom-contracts-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Two layers of contracts, working together
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The Telecom vertical earns money through provider relationships upstream and customer service agreements
              downstream.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-telecom-contract-upstream" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Handshake className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">1. Provider / carrier agreements (upstream)</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {/* TODO(client): confirm the exact upstream structure — authorized dealer vs. master
                    agency vs. reseller — and whether any carrier is named. — see brief Placeholder #2. */}
                New Dawn maintains the authorized relationships with the underlying carriers and service providers. Your
                franchise sells under these established agreements, so you start with credible products and provisioning
                on day one rather than building carrier relationships from scratch.
              </p>
            </Card>

            <Card data-testid="card-telecom-contract-downstream" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Repeat className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">2. Customer service agreements (downstream)</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Each customer your franchise signs enters a recurring service contract. The franchise earns:
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <span><span className="font-medium text-foreground">Activation / upfront compensation</span> when a new customer is signed and provisioned.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <span><span className="font-medium text-foreground">Recurring residual income</span> for every month the customer remains active — the core of the model.</span>
                </li>
                {/* TODO(client): confirm whether accessory / equipment / add-on margin applies, and
                    add it here only if defensible. — see brief Placeholder #3. */}
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <span><span className="font-medium text-foreground">Add-on margin</span> where applicable, from accessories, equipment, and value-added services.</span>
                </li>
              </ul>
            </Card>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Because residual income compounds as the customer base grows and renews, the business builds a base of
              predictable monthly cash flow over time rather than restarting from zero each month.
            </p>
          </div>

          <E2Callout>
            <span className="font-medium text-foreground">Why this matters for E-2:</span> Recurring contractual revenue
            demonstrates that the enterprise is real, active, and capable of generating more than a marginal living — and
            it produces a clean, auditable record of ongoing business activity that supports visa renewals.
          </E2Callout>
        </div>
      </section>

      {/* ── SECTION 3 — We run it, you direct it ── */}
      <section data-testid="section-telecom-direct" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Own and direct</SectionEyebrow>
            <h2 data-testid="telecom-direct-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              We run it, you direct it
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              You are the owner and director of the business. New Dawn provides the operating infrastructure so you
              maintain executive control without being buried in daily minutiae.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {RUN_IT.map((r) => (
              <Card key={r.id} data-testid={`card-telecom-runit-${r.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                    <r.icon className="size-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{r.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              You set direction, review performance, approve key decisions, and maintain ownership and bank-account
              control. The teams execute. This is the &ldquo;own and direct&rdquo; structure the E-2 visa is built
              around.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — How it creates jobs ── */}
      <section data-testid="section-telecom-jobs" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>U.S. job creation</SectionEyebrow>
            <h2 data-testid="telecom-jobs-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How it creates jobs
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A New Dawn Telecom franchise is staffed to operate as a real business, which means it employs people in the
              United States. As the subscriber base grows, the team grows with it.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOBS.map((j) => (
              <Card key={j.id} data-testid={`card-telecom-job-${j.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <j.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{j.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{j.desc}</div>
              </Card>
            ))}
          </div>

          {/* TODO(client): if you have a defensible, FDD-backed headcount target (e.g. "a team of
              X–Y employees within the first 24 months"), insert it here. Do NOT publish invented
              job numbers — USCIS and the consular officer compare them to your actual plan. — see brief Placeholder #4. */}

          <E2Callout>
            <span className="font-medium text-foreground">Why this matters for E-2:</span> One of the central E-2
            requirements is that the business not be &ldquo;marginal&rdquo; — it must do more than provide a minimal
            living for the investor's family. A telecom operation that employs U.S. workers and generates recurring
            revenue directly addresses this, contributing to the local economy and demonstrating the enterprise's real
            economic impact.
          </E2Callout>
        </div>
      </section>

      {/* ── SECTION 5 — Why telecom works for E-2 investors ── */}
      <section data-testid="section-telecom-why" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>A strong fit for E-2 Treaty Investors</SectionEyebrow>
            <h2 data-testid="telecom-why-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Why telecom works for E-2 investors
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {WHY_E2.map((f) => (
              <Card key={f.id} data-testid={`card-telecom-why-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                    <f.icon className="size-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{f.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
            Backed by in-house E-2 immigration, finance, and legal professionals, and part of the{" "}
            <span translate="no">New Dawn Franchising Group of Companies&trade;</span>.
          </p>
        </div>
      </section>

      {/* ── SECTION 6 — How it works ── */}
      <section data-testid="section-telecom-how" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The pathway</SectionEyebrow>
            <h2 data-testid="telecom-how-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How it works
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <Card key={step.id} data-testid={`card-telecom-step-${step.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary))] text-base font-semibold text-white">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{step.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — Investment & buy-back ── */}
      <section data-testid="section-telecom-investment" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Investment &amp; buy-back</SectionEyebrow>
            <h2 data-testid="telecom-investment-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Structured to meet the E-2 investment requirement
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            <Card data-testid="card-telecom-invest-from" className="nh-surface nh-noise border-card-border/80 p-6">
              <Wallet className="size-6 text-[hsl(var(--accent))]" />
              <div className="mt-4 text-2xl font-semibold">{INVESTMENT_FROM}</div>
              <div className="mt-1 text-sm font-medium text-foreground">Franchise investment from</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Covers your franchise license, training, technology platform access, and operational setup. Financing
                options are available through affiliated lending partners.
              </p>
            </Card>
            <Card data-testid="card-telecom-invest-buyback" className="nh-surface nh-noise border-card-border/80 p-6">
              <Repeat className="size-6 text-[hsl(var(--accent))]" />
              <div className="mt-4 text-2xl font-semibold">~4 years</div>
              <div className="mt-1 text-sm font-medium text-foreground">In-house buy-back program</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                An in-house buy-back program is available after approximately four years, giving owners a defined path
                for the next stage.
              </p>
            </Card>
            <Card data-testid="card-telecom-invest-fdd" className="nh-surface nh-noise border-card-border/80 p-6">
              <FileText className="size-6 text-[hsl(var(--accent))]" />
              <div className="mt-4 text-2xl font-semibold">FDD</div>
              <div className="mt-1 text-sm font-medium text-foreground">Full details on request</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The E-2 visa requires a substantial, at-risk investment in a U.S. business. Full details are provided in
                the Franchise Disclosure Document.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION 8 — Is telecom the right vertical for you? ── */}
      <section data-testid="section-telecom-fit" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Is it the right fit?</SectionEyebrow>
            <h2 data-testid="telecom-fit-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Is telecom the right vertical for you?
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Telecom tends to be the strongest fit for investors who:
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {FIT.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border bg-white/60 p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
                <span className="text-sm leading-relaxed text-foreground/90">{item}</span>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
            During discovery, we compare Telecom against Property Management and Insurance based on your goals, market
            fit, investment preferences, and E-2 strategy, and walk you through the strongest fit.
          </p>
        </div>
      </section>

      {/* ── SECTION 9 — FAQ ── */}
      <section data-testid="section-telecom-faq" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 data-testid="telecom-faq-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── SECTION 10 — CTA / contact ── */}
      <section data-testid="section-telecom-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="telecom-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Direct a recurring-revenue telecom business in the U.S.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Request the FDD and schedule an intro call to see whether the Telecom vertical fits your E-2 goals.
            </p>

            <div className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-3">
              <a
                data-testid="link-telecom-cta-address"
                href="https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-xl border bg-white/70 p-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                <span>{COMPANY.addressFull}</span>
              </a>
              <a
                data-testid="link-telecom-cta-phone"
                href={`tel:${COMPANY.phoneTel}`}
                className="flex items-start gap-2 rounded-xl border bg-white/70 p-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Phone className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                <span>{COMPANY.phone}</span>
              </a>
              <a
                data-testid="link-telecom-cta-email"
                href={`mailto:${COMPANY.email}`}
                className="flex items-start gap-2 rounded-xl border bg-white/70 p-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                <span className="break-all">{COMPANY.email}</span>
              </a>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-telecom-cta-fdd" className="gap-2" asChild>
                <Link href="/contact">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-telecom-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Schedule an Intro Call
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Page-level fine-print disclaimer (in addition to the site-wide footer disclaimer) ── */}
      <section data-testid="section-telecom-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Important disclaimer
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              This page is for informational purposes only and is not an offer to sell or the solicitation of an offer
              to buy a franchise. Franchises are offered solely through a Franchise Disclosure Document in compliance
              with the FTC Franchise Rule and applicable state law, and only in states where New Dawn Franchising is
              registered, exempt, or otherwise authorized. New Dawn Franchising does not provide legal or immigration
              advice and does not guarantee any E-2 visa approval or any financial result. Eligibility for and approval
              of an E-2 Treaty Investor visa is determined solely by the U.S. Department of State and/or U.S. Citizenship
              and Immigration Services based on each applicant's individual circumstances. Prospective investors should
              consult independent legal, immigration, and financial advisors.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

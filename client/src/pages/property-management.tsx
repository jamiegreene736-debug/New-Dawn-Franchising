import { useEffect } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  KeyRound,
  Layers,
  LineChart,
  MapPin,
  Phone,
  Repeat,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

// ─── SEO / metadata (mirrors homepage style; no per-page meta framework exists,
// so we set it imperatively and clean up on unmount). ─────────────────────────
const SEO = {
  title:
    "New Dawn Franchising | Property Management Franchise for E-2 Visa Investors — Long-Term Rentals | El Paso, TX",
  description:
    "E-2 visa property management franchise. Own and direct a recurring-revenue long-term rental management business while New Dawn's local teams run daily operations. Investment from $225,000. FDD available upon request.",
  canonical: "https://www.newdawnfranchising.com/property-management",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

// ─── Section 1 — The business at a glance ─────────────────────────────────────
const GLANCE = [
  {
    icon: Repeat,
    title: "Recurring revenue, not one-time sales",
    desc: "Each property under management generates a monthly management fee for as long as the property owner stays a client — revenue that compounds rather than restarting from zero each month.",
    id: "recurring",
  },
  {
    icon: ClipboardList,
    title: "Documented operating systems",
    desc: "Local execution teams, documented SOPs, and owner-level reporting dashboards give the enterprise the structure, staffing, and supervisory control that support a credible E-2 business.",
    id: "systems",
  },
  {
    icon: ShieldCheck,
    title: "Long-term rental stability",
    desc: "Annual leases mean predictable monthly fees, established tenants, and steady cash flow — rather than the seasonal swings of short-term or vacation rentals.",
    id: "stability",
  },
];

// ─── Section 2 — The fees attached to the management agreement ────────────────
// TODO(client): confirm the exact fee basis (e.g. % of collected monthly rent),
// the leasing/placement fee, and any ancillary fees against the FDD before
// publish. Page copy and the FDD must not contradict — keep generic until
// verified. (See brief Section 2 / placeholders #1 & #2.)
const FEES = [
  {
    icon: Repeat,
    title: "Recurring management fee",
    desc: "Earned every month a property is under management — typically based on the collected monthly rent. This is the compounding core of the model.",
    id: "management-fee",
  },
  {
    icon: KeyRound,
    title: "Leasing / tenant-placement fee",
    desc: "Earned when a new tenant is placed in a managed property.",
    id: "leasing-fee",
  },
  {
    icon: Repeat,
    title: "Lease renewal fee",
    desc: "Earned, where applicable, when an existing tenant renews their lease.",
    id: "renewal-fee",
  },
  {
    icon: Wrench,
    title: "Ancillary fees",
    desc: "Additional fees such as maintenance coordination and application fees may apply, where offered.",
    id: "ancillary-fee",
  },
];

// ─── Section 3 — We run it, you direct it ─────────────────────────────────────
const OPERATIONS = [
  {
    icon: Users,
    title: "Approved local teams",
    desc: "Day-to-day execution — leasing, tenant relations, rent collection, maintenance coordination, and inspections — is handled by approved operating teams in your market.",
    id: "teams",
  },
  {
    icon: Settings,
    title: "Proprietary technology",
    desc: "Leasing workflows, tenant and owner communication, rent collection, maintenance ticketing, marketing, and lead generation that run around the clock.",
    id: "technology",
  },
  {
    icon: Gauge,
    title: "Owner dashboards",
    desc: "Real-time visibility into doors under management, occupancy, rent collected, management-fee revenue, delinquencies, and staffing — the information you use to supervise and decide.",
    id: "dashboards",
  },
  {
    icon: FileText,
    title: "Client (property-owner) reporting",
    desc: "Your franchise delivers monthly owner statements to the property owners you serve — a standard industry expectation and a driver of client retention.",
    id: "reporting",
  },
  {
    icon: Briefcase,
    title: "Centralized back-office support",
    desc: "Coordinated compliance, accounting, and reporting so you keep executive control without being buried in daily minutiae.",
    id: "back-office",
  },
];

// ─── Section 4 — Roles a property management operation creates ────────────────
// TODO(client): confirm specific roles, headcount targets, and any field-
// inspector role against the FDD / business plan before publish. Do NOT publish
// invented job numbers — USCIS and the consular officer compare them to the
// actual plan. (See brief Section 4 / placeholder #3.)
const JOBS = [
  {
    icon: Building2,
    title: "Property / portfolio managers",
    desc: "Oversee the managed portfolio and the owner relationships behind it.",
    id: "portfolio-managers",
  },
  {
    icon: KeyRound,
    title: "Leasing agents",
    desc: "Market vacancies, screen applicants, and place qualified tenants.",
    id: "leasing-agents",
  },
  {
    icon: Wrench,
    title: "Maintenance coordinators",
    desc: "Triage and coordinate repairs and vendor work across managed properties.",
    id: "maintenance",
  },
  {
    icon: Briefcase,
    title: "Administrative & bookkeeping staff",
    desc: "Owner statements, rent reconciliation, and the day-to-day back office.",
    id: "admin",
  },
];

// ─── Section 5 — Why property management works for E-2 investors ──────────────
const WHY = [
  {
    icon: BadgeCheck,
    title: "You own and direct a real operating business",
    desc: "The foundation of a strong E-2 petition — a genuine, active enterprise under your direction.",
    id: "own-direct",
  },
  {
    icon: Repeat,
    title: "Recurring revenue, not one-time sales",
    desc: "Predictable monthly management fees that compound as your portfolio grows and clients renew.",
    id: "recurring",
  },
  {
    icon: Home,
    title: "Long-term rental stability",
    desc: "Annual leases mean steady cash flow and lower turnover than short-term rentals.",
    id: "stability",
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
    id: "auditable",
  },
  {
    icon: Settings,
    title: "You direct; local teams execute",
    desc: "Approved local teams handle daily execution while you set strategy, approve key decisions, and supervise performance through your owner dashboard — executive control without the daily minutiae.",
    id: "direct",
  },
  {
    icon: Gauge,
    title: "Proprietary technology included",
    desc: "Built for E-2 investor oversight — not off-the-shelf software.",
    id: "technology",
  },
  {
    icon: ShieldCheck,
    title: "You hold financial control",
    desc: "You control the franchise's bank accounts, approve major expenditures, and direct hiring and strategy — the substantive 'develop and direct' role the E-2 visa requires.",
    id: "control",
  },
  {
    icon: Briefcase,
    title: "Structured to meet E-2 capital requirements",
    desc: "Franchise investment from $225,000, backed by in-house E-2 immigration, finance, real estate, and legal professionals.",
    id: "capital",
  },
];

// ─── Section 6 — How it works ─────────────────────────────────────────────────
const STEPS = [
  {
    title: "Invest in your property management franchise",
    desc: "Acquire your New Dawn Property Management franchise starting at $225,000. The structured investment is designed to meet E-2 visa capital requirements and gives you a real, operating business.",
  },
  {
    title: "Apply for your E-2 visa",
    desc: "Our partner immigration attorneys guide you through the application. You own and direct a legitimate U.S. property management enterprise — the foundation of your petition.",
  },
  {
    title: "Local teams launch operations",
    desc: "Approved operating teams handle leasing, tenant relations, and maintenance while you oversee performance through your owner dashboard.",
  },
  {
    title: "Grow your portfolio",
    desc: "As your doors under management and recurring fee income grow, you scale the team, build equity, and maintain executive control.",
  },
];

// ─── Section 8 — Investor fit ─────────────────────────────────────────────────
// TODO(client): add any additional investor-fit criteria you want surfaced.
// (See brief Section 8 / placeholder #4.)
const FIT = [
  "Want a recurring-revenue business with stable, compounding monthly income",
  "Are comfortable directing a local service operation with a hands-on team",
  "Value real estate as a familiar, tangible business category",
];

// ─── Section 9 — FAQ ──────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What does the Property Management franchise actually do?",
    a: "It manages residential long-term rentals on behalf of property owners — handling leasing, rent collection, tenant relations, maintenance coordination, and owner reporting — under ongoing management agreements.",
  },
  {
    q: "Where does the recurring revenue come from?",
    a: "Each property owner signs a management agreement. The franchise earns a recurring monthly management fee for every property under management, plus leasing fees when tenants are placed, so revenue builds as the portfolio grows and clients renew.",
  },
  {
    q: "Do I have to run the day-to-day myself?",
    a: "No. You are the owner and director. Approved local teams handle daily execution while you maintain ownership control, bank-account oversight, and executive supervision through your owner dashboard.",
  },
  {
    q: "Is this long-term rentals or short-term/vacation rentals?",
    a: "Long-term rentals — annual leases with established tenants. This provides steadier monthly income and lower turnover than short-term or vacation rentals.",
  },
  {
    q: "How does this support my E-2 visa?",
    a: "It's a real, operating business that you own and direct, generates recurring revenue, and employs U.S. workers — characteristics that support a credible E-2 petition and produce an auditable record for renewals. New Dawn does not provide legal or immigration advice or guarantee any visa outcome.",
  },
  {
    q: "Can I live anywhere in the U.S.?",
    a: "Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live elsewhere in the United States while maintaining executive oversight.",
  },
  {
    q: "How much do I invest?",
    a: "Property Management franchise investment starts at $225,000. The E-2 visa has no fixed minimum, but the investment must be substantial relative to the total cost of the business.",
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">{children}</div>
  );
}

// Set/replace a <meta> tag by name or property; returns a cleanup that restores
// the previous value (or removes the tag if we created it).
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

function usePropertyManagementSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO.title;

    const cleanups: Array<() => void> = [];
    cleanups.push(setMetaTag('meta[name="description"]', "name", "description", SEO.description));
    cleanups.push(setMetaTag('meta[property="og:title"]', "property", "og:title", SEO.title));
    cleanups.push(setMetaTag('meta[property="og:description"]', "property", "og:description", SEO.description));
    cleanups.push(setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", SEO.title));
    cleanups.push(setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", SEO.description));

    // Canonical link
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const prevCanonical = canonical?.getAttribute("href") ?? null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SEO.canonical);

    // FAQPage structured data (JSON-LD)
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      cleanups.forEach((fn) => fn());
      if (createdCanonical) canonical?.remove();
      else if (prevCanonical !== null) canonical?.setAttribute("href", prevCanonical);
      ld.remove();
    };
  }, []);
}

export default function PropertyManagementPage() {
  usePropertyManagementSeo();

  return (
    <div data-testid="page-property-management" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-pm-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Home className="size-3.5 text-[hsl(var(--accent))]" />
              One of three New Dawn verticals
            </div>
            <h1
              data-testid="pm-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Property Management: Recurring Revenue You Direct, Operations We Run
            </h1>
            <p
              data-testid="pm-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              A real, operating U.S. property management business built around long-term rental contracts —
              structured so you own and direct the enterprise while New Dawn's local teams handle daily execution,
              exactly as the E-2 visa requires.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-pm-hero-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-pm-hero-call" variant="secondary" className="gap-2" asChild>
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
      <section data-testid="section-pm-glance" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The business at a glance</SectionEyebrow>
            <h2 data-testid="pm-glance-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Long-term rental management, built on recurring revenue
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The New Dawn Property Management franchise manages residential rental properties on behalf of property
              owners under ongoing management agreements — handling leasing, rent collection, tenant relations,
              maintenance coordination, and owner reporting. It is a genuine operating enterprise with documented
              systems, staffing, supervisory control, and renewal-ready reporting.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GLANCE.map((g) => (
              <Card key={g.id} data-testid={`card-pm-glance-${g.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <g.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{g.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — The contracts: where the revenue comes from ── */}
      <section data-testid="section-pm-contracts" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Where the revenue comes from</SectionEyebrow>
            <h2 data-testid="pm-contracts-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The contracts behind the recurring revenue
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Each property owner signs an ongoing property management agreement appointing your franchise to manage
              their rental. This is the engine of the business and the source of recurring revenue — and it carries
              several fees.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {FEES.map((f) => (
              <Card key={f.id} data-testid={`card-pm-fee-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <f.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{f.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</div>
              </Card>
            ))}
          </div>

          {/* The growth metric: doors under management */}
          <div className="mx-auto mt-10 max-w-4xl">
            <Card data-testid="card-pm-doors" className="nh-surface nh-noise border-card-border/80 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <DoorOpen className="size-6 text-[hsl(var(--primary))]" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold">The growth metric: doors under management</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    In property management, the asset that builds value is the number of &ldquo;doors&rdquo; (units)
                    under management. Each door added increases recurring monthly fee income, so the business
                    compounds as the portfolio grows and clients renew — rather than restarting from zero each month.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Why this matters for E-2 */}
          <div
            data-testid="pm-contracts-e2-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why this matters for E-2:</span> Recurring contractual
              revenue across a portfolio of managed properties demonstrates that the enterprise is real, active, and
              capable of generating more than a marginal living — and it produces a clean, auditable record of ongoing
              business activity that supports visa renewals.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — We run it, you direct it ── */}
      <section data-testid="section-pm-operations" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>We run it, you direct it</SectionEyebrow>
            <h2 data-testid="pm-operations-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              You direct the business; our teams run the operations
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              You are the owner and director. New Dawn provides the operating infrastructure so you maintain executive
              control without being buried in daily minutiae. You set direction, review performance, approve key
              decisions, and maintain ownership and bank-account control — the &ldquo;own and direct&rdquo; structure
              the E-2 visa is built around.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OPERATIONS.map((o) => (
              <Card key={o.id} data-testid={`card-pm-operation-${o.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <o.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{o.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.desc}</div>
              </Card>
            ))}
          </div>

          {/* ★ Real estate licensing — vertical-specific compliance note. */}
          {/* TODO(client): confirm exactly how the franchise handles state real-estate
              broker licensing for residential property management (e.g. operated under
              NDF's in-house licensing, a designated broker per market, or franchisee-
              held licensing) and finalize this copy so it is accurate and compliant.
              (See brief placeholder #6 — this is specific to Property Management.) */}
          <div
            data-testid="pm-licensing-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border bg-white/60 p-5 shadow-sm"
          >
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--primary))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Licensing handled for you.</span> In many U.S. states,
              residential property management is performed under a licensed real estate broker. New Dawn structures
              each market so operations are conducted in compliance with applicable state licensing requirements —
              so you can focus on directing the business.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — How it creates jobs ── */}
      <section data-testid="section-pm-jobs" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>U.S. job creation</SectionEyebrow>
            <h2 data-testid="pm-jobs-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How the business creates American jobs
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A New Dawn Property Management franchise is staffed to operate as a real business, which means it employs
              people in the United States. As the portfolio of doors under management grows, the team grows with it. A
              typical operation supports roles such as:
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOBS.map((j) => (
              <Card key={j.id} data-testid={`card-pm-job-${j.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <j.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{j.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{j.desc}</div>
              </Card>
            ))}
          </div>

          <div
            data-testid="pm-jobs-e2-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <Users className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why this matters for E-2:</span> One of the central E-2
              requirements is that the business not be &ldquo;marginal&rdquo; — it must do more than provide a minimal
              living for the investor's family. A property management operation that employs U.S. workers and generates
              recurring revenue directly addresses this, contributing to the local economy and demonstrating the
              enterprise's real economic impact.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — Why property management works for E-2 investors ── */}
      <section data-testid="section-pm-why" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>A strong fit for E-2 Treaty Investors</SectionEyebrow>
            <h2 data-testid="pm-why-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Why property management works for E-2 investors
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The vertical maps to what{" "}
              <Link href="/e-2-visa-process" className="underline underline-offset-2 hover:text-foreground">the E-2 visa process</Link>{" "}
              actually requires — a real, operating, owner-directed business that is substantial and not marginal. Backed
              by in-house E-2 immigration, finance, real estate, and legal professionals, and part of the New Dawn
              Franchising Group of Companies&trade;.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <Card key={w.id} data-testid={`card-pm-why-${w.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                    <w.icon className="size-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{w.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Compliance callout — approval is never guaranteed (DOS / USCIS decide). */}
          <div
            data-testid="pm-why-compliance-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Purchasing a franchise does not guarantee E-2 approval. Eligibility and approval are determined solely by
              U.S. consular officers and USCIS based on each individual petition. The Property Management vertical is
              structured to support — never to guarantee — a strong E-2 case.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — How it works ── */}
      <section data-testid="section-pm-how" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 data-testid="pm-how-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              From investment to a growing portfolio
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <Card key={i} data-testid={`card-pm-step-${i + 1}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10 text-base font-semibold text-[hsl(var(--primary))]">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{s.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — Investment ── */}
      <section data-testid="section-pm-investment" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Investment</SectionEyebrow>
            <h2 data-testid="pm-investment-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              A substantial, at-risk investment — structured for E-2
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            <Card data-testid="card-pm-investment-amount" className="nh-surface nh-noise border-card-border/80 p-6 text-center">
              <Briefcase className="mx-auto size-6 text-[hsl(var(--accent))]" />
              <div className="mt-3 text-3xl font-semibold text-[hsl(var(--primary))]">$225,000</div>
              <div className="mt-1 text-sm text-muted-foreground">Franchise investment from</div>
            </Card>
            <Card data-testid="card-pm-investment-includes" className="nh-surface nh-noise border-card-border/80 p-6 md:col-span-2">
              <div className="text-base font-semibold">What it covers</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your franchise license, training, technology platform access, and operational setup. Financing options
                are available through affiliated lending partners.
              </p>
            </Card>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The E-2 visa requires a substantial, at-risk investment in a U.S. business. The Property Management
              vertical is structured specifically to meet this requirement. Full details are provided in the Franchise
              Disclosure Document (FDD).
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 8 — Is property management the right vertical for you? ── */}
      <section data-testid="section-pm-fit" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Is this the right vertical for you?</SectionEyebrow>
            <h2 data-testid="pm-fit-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Property Management tends to fit investors who&hellip;
            </h2>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <ul className="space-y-3">
              {FIT.map((item, i) => (
                <li key={i} data-testid={`pm-fit-item-${i}`} className="flex items-start gap-3 rounded-xl border bg-white/60 p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
                  <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
              During discovery, we compare Property Management against Telecom and Insurance based on your goals,
              market fit, investment preferences, and E-2 strategy, and walk you through the strongest fit.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 9 — FAQ ── */}
      <section data-testid="section-pm-faq" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Frequently asked questions</SectionEyebrow>
            <h2 data-testid="pm-faq-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Property Management, answered
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} data-testid={`pm-faq-item-${i}`}>
                  <AccordionTrigger className="text-left text-base font-semibold">
                    <span className="flex items-start gap-2">
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                      {f.q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── SECTION 10 — CTA / contact ── */}
      <section data-testid="section-pm-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="pm-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Direct a Recurring-Revenue Property Management Business in the U.S.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Request the FDD and schedule an intro call to see whether the Property Management vertical fits your E-2
              goals.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-pm-cta-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-pm-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-pm-address"
                href={COMPANY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {COMPANY.addressFull}
              </a>
              <a
                data-testid="link-pm-phone"
                href={`tel:${COMPANY.phoneTel}`}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0" />
                {COMPANY.phone}
              </a>
              <a
                data-testid="link-pm-email"
                href={`mailto:${COMPANY.email}`}
                className="transition-colors hover:text-foreground"
              >
                {COMPANY.email}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Page-level fine-print disclaimer (in addition to the site-wide footer disclaimer) ── */}
      <section data-testid="section-pm-disclaimer" className="border-t bg-white/50">
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
              advice and does not guarantee any E-2 visa approval or any financial result. Prospective investors should
              consult independent legal, immigration, and financial advisors.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

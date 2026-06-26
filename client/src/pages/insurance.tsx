import { useEffect } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  Handshake,
  HelpCircle,
  Layers,
  LineChart,
  MapPin,
  Phone,
  Repeat,
  Settings,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrochureDownload } from "@/components/brochure-download";
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
    "New Dawn Franchising | Insurance Franchise for E-2 Visa Investors — Recurring Commission Revenue | El Paso, TX",
  description:
    "E-2 visa insurance franchise. Own and direct a recurring-revenue insurance agency while New Dawn's licensed teams run daily operations. Investment from $225,000. FDD available upon request.",
  canonical: "https://www.newdawnfranchising.com/insurance",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

// ─── Section 1 — The business at a glance ─────────────────────────────────────
const GLANCE = [
  {
    icon: Repeat,
    title: "Recurring revenue, not one-time sales",
    desc: "Every policy your agency writes earns commission again at each renewal for as long as the client stays insured — income that compounds rather than restarting from zero each year.",
    id: "recurring",
  },
  {
    icon: ClipboardList,
    title: "Documented, supervised systems",
    desc: "Licensed producers, documented operating systems, compliant supervision, and owner-level reporting dashboards give the enterprise the structure that supports a credible E-2 business.",
    id: "systems",
  },
  {
    icon: ShieldCheck,
    title: "A sticky, high-retention book",
    desc: "High client retention produces predictable, compounding commission income year after year — a renewing book of business rather than seasonal swings.",
    id: "retention",
  },
];

// ─── Section 2 — The contracts: where the revenue comes from ──────────────────
// TODO(client): confirm lines of business, agency structure (independent multi-
// carrier vs. captive/branded), whether carriers are named, and the exact
// commission components (new-business %, renewal, contingent/bonus) against the
// FDD before publish. Page copy and the FDD must not contradict — keep generic
// until verified. (See brief Section 2 / placeholders #1–#3.)
const COMMISSIONS = [
  {
    icon: FileText,
    title: "New-business commission",
    desc: "Earned when a policy is first written — typically a percentage of first-year premium.",
    id: "new-business",
  },
  {
    icon: Repeat,
    title: "Recurring renewal commission",
    desc: "Earned each time the policy renews, for as long as the client stays insured. This is the compounding core of the model.",
    id: "renewal",
  },
  {
    icon: TrendingUp,
    title: "Contingent / bonus commissions",
    desc: "Where applicable, carriers may pay additional commissions based on volume or retention performance.",
    id: "contingent",
  },
];

// ─── Section 3 — We run it, you direct it ─────────────────────────────────────
const OPERATIONS = [
  {
    icon: UserCheck,
    title: "Licensed local teams",
    desc: "Day-to-day execution — quoting, sales, account management, customer service, and policy processing — is handled by licensed producers and support staff in your market.",
    id: "teams",
  },
  {
    icon: Settings,
    title: "Proprietary technology",
    desc: "Quoting and sales workflows, client communication, policy servicing, renewals, marketing, and lead generation that run around the clock.",
    id: "technology",
  },
  {
    icon: Gauge,
    title: "Owner dashboards",
    desc: "Real-time visibility into policies in force, new business, renewals, retention, commission revenue, and staffing — the information you use to supervise and decide.",
    id: "dashboards",
  },
  {
    icon: Briefcase,
    title: "Compliant supervision & back-office",
    desc: "Coordinated carrier relationships, licensing compliance, and reporting so you keep executive control without being buried in daily minutiae.",
    id: "back-office",
  },
];

// ─── Section 4 — Roles an insurance agency creates ────────────────────────────
// TODO(client): confirm specific roles, headcount targets, and licensing makeup
// against the FDD / business plan before publish. Do NOT publish invented job
// numbers — USCIS and the consular officer compare them to the actual plan.
// (See brief Section 4 / placeholder #4.)
const JOBS = [
  {
    icon: UserCheck,
    title: "Licensed insurance producers / agents",
    desc: "Quote, sell, and advise clients — the regulated, revenue-generating front line.",
    id: "producers",
  },
  {
    icon: Handshake,
    title: "Account managers",
    desc: "Own client relationships and drive the renewals that compound the book.",
    id: "account-managers",
  },
  {
    icon: Users,
    title: "Customer service representatives",
    desc: "Policy servicing and day-to-day client support that keeps retention high.",
    id: "service",
  },
  {
    icon: Briefcase,
    title: "Administrative & processing staff",
    desc: "Policy processing, documentation, and the day-to-day back office.",
    id: "admin",
  },
];

// ─── Section 5 — Why insurance works for E-2 investors ────────────────────────
const WHY = [
  {
    icon: BadgeCheck,
    title: "You own and direct a real operating business",
    desc: "The foundation of a strong E-2 petition — a genuine, active, regulated enterprise under your direction.",
    id: "own-direct",
  },
  {
    icon: Repeat,
    title: "Recurring revenue, not one-time sales",
    desc: "Renewal commissions that compound as your book of business grows and retains.",
    id: "recurring",
  },
  {
    icon: ShieldCheck,
    title: "Sticky, high-retention income",
    desc: "Once written, a well-serviced policy renews year after year.",
    id: "retention",
  },
  {
    icon: Users,
    title: "Creates U.S. jobs",
    desc: "Including licensed producers — helps demonstrate the enterprise is not marginal and contributes to the local economy.",
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
    title: "You direct; licensed teams execute",
    desc: "Licensed local teams handle the regulated, day-to-day execution while you set strategy, approve key decisions, and supervise performance through your owner dashboard — executive control without the daily minutiae.",
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
    desc: "You control the agency's bank accounts, approve major expenditures, and direct hiring and strategy — the substantive 'develop and direct' role the E-2 visa requires.",
    id: "control",
  },
  {
    icon: Briefcase,
    title: "Structured to meet E-2 capital requirements",
    desc: "Franchise investment from $225,000, backed by in-house E-2 immigration, finance, and legal professionals.",
    id: "capital",
  },
];

// ─── Section 6 — How it works ─────────────────────────────────────────────────
const STEPS = [
  {
    title: "Invest in your insurance franchise",
    desc: "Acquire your New Dawn Insurance franchise starting at $225,000. The structured investment is designed to meet E-2 visa capital requirements and gives you a real, operating business.",
  },
  {
    title: "Apply for your E-2 visa",
    desc: "Our partner immigration attorneys guide you through the application. You own and direct a legitimate U.S. insurance agency — the foundation of your petition.",
  },
  {
    title: "Local teams launch operations",
    desc: "Approved, licensed operating teams handle quoting, sales, and policy servicing while you oversee performance through your owner dashboard.",
  },
  {
    title: "Grow your book of business",
    desc: "As your policies in force and renewal commission income grow, you scale the team, build equity, and maintain executive control.",
  },
];

// ─── Section 8 — Investor fit ─────────────────────────────────────────────────
// TODO(client): add any additional investor-fit criteria you want surfaced.
// (See brief Section 8 / placeholder #5.)
const FIT = [
  "Want a recurring-revenue business with sticky, high-retention income",
  "Are comfortable directing a sales-and-service operation with a licensed team",
  "Value a regulated, established business category with durable demand",
];

// ─── Section 9 — FAQ ──────────────────────────────────────────────────────────
// TODO(client): finalize the "what does it sell" and producer-licensing answers
// once lines of business and the licensing structure are confirmed. (See brief
// placeholders #1 & #6.)
const FAQS = [
  {
    q: "What does the Insurance franchise actually sell?",
    a: "The agency sells and services insurance policies on behalf of established carriers under New Dawn's agency appointments. The specific lines of business are detailed during discovery and in the Franchise Disclosure Document.",
  },
  {
    q: "Where does the recurring revenue come from?",
    a: "Each policy earns a commission when written and a renewal commission every time it renews. Because well-serviced policies retain at high rates, the book of business produces compounding annual income as it grows.",
  },
  {
    q: "Do I have to be a licensed insurance agent myself?",
    a: "Insurance is a regulated, licensed business, and the regulated activities are performed by licensed producers. You direct the business and supervise performance; licensed team members carry the producer licensing. New Dawn structures each agency so operations are conducted in compliance with applicable state licensing requirements.",
  },
  {
    q: "Do I have to run the day-to-day myself?",
    a: "No. You are the owner and director. Approved, licensed local teams handle daily execution while you maintain ownership control, bank-account oversight, and executive supervision through your owner dashboard.",
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
    a: "Insurance franchise investment starts at $225,000. The E-2 visa has no fixed minimum, but the investment must be substantial relative to the total cost of the business.",
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

function useInsuranceSeo() {
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

export default function InsurancePage() {
  useInsuranceSeo();

  return (
    <div data-testid="page-insurance" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-insurance-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Shield className="size-3.5 text-[hsl(var(--accent))]" />
              One of three New Dawn verticals
            </div>
            <h1
              data-testid="insurance-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Insurance: Recurring Revenue You Direct, Operations We Run
            </h1>
            <p
              data-testid="insurance-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              A real, operating U.S. insurance agency built around a renewing book of business — structured so you own
              and direct the enterprise while New Dawn's licensed teams handle daily execution, exactly as the E-2 visa
              requires.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-insurance-hero-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-insurance-hero-call" variant="secondary" className="gap-2" asChild>
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
      <section data-testid="section-insurance-glance" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The business at a glance</SectionEyebrow>
            <h2 data-testid="insurance-glance-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              An insurance agency, built on recurring commission revenue
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The New Dawn Insurance franchise operates as an insurance agency — selling and servicing policies on
              behalf of established carriers and earning commission revenue on the policies it places and keeps in
              force. It is a genuine operating enterprise with documented systems, licensed staffing, supervisory
              control, and renewal-ready reporting.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GLANCE.map((g) => (
              <Card key={g.id} data-testid={`card-insurance-glance-${g.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
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
      <section data-testid="section-insurance-contracts" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Where the revenue comes from</SectionEyebrow>
            <h2 data-testid="insurance-contracts-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Two layers of contracts working together
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The Insurance vertical earns money through carrier appointments upstream and client policies downstream —
              the combination that turns each sale into compounding, renewable income.
            </p>
          </div>

          {/* Upstream / downstream */}
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-insurance-upstream" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Handshake className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">1. Carrier appointments (upstream)</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                New Dawn maintains the agency relationships and carrier appointments that allow the franchise to
                represent and sell insurance products. Your franchise sells under these established appointments — so
                you start with credible products and competitive options rather than building carrier relationships
                from scratch.
              </p>
            </Card>

            <Card data-testid="card-insurance-downstream" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Repeat className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">2. Client policies (downstream)</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Each policy your agency writes generates commission revenue — at issue and again at every renewal — for
                as long as the client stays insured.
              </p>
            </Card>
          </div>

          {/* Commission components */}
          <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-3">
            {COMMISSIONS.map((c) => (
              <Card key={c.id} data-testid={`card-insurance-commission-${c.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <c.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{c.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</div>
              </Card>
            ))}
          </div>

          {/* The growth metric: the book of business */}
          <div className="mx-auto mt-10 max-w-4xl">
            <Card data-testid="card-insurance-book" className="nh-surface nh-noise border-card-border/80 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <Layers className="size-6 text-[hsl(var(--primary))]" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold">The growth metric: the book of business</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    In insurance, the asset that builds value is the &ldquo;book of business&rdquo; — the policies in
                    force and the clients behind them. Because renewal commissions recur and high retention compounds,
                    the agency builds a base of predictable annual income that grows as the book grows, rather than
                    restarting from zero each year. Retention rate is the key driver of value.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Why this matters for E-2 */}
          <div
            data-testid="insurance-contracts-e2-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why this matters for E-2:</span> Recurring commission
              revenue across a renewing book of business demonstrates that the enterprise is real, active, and capable
              of generating more than a marginal living — and it produces a clean, auditable record of ongoing business
              activity that supports visa renewals.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — We run it, you direct it ── */}
      <section data-testid="section-insurance-operations" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>We run it, you direct it</SectionEyebrow>
            <h2 data-testid="insurance-operations-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              You direct the business; our licensed teams run the operations
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              You are the owner and director. New Dawn provides the operating infrastructure so you maintain executive
              control without being buried in daily minutiae. You set direction, review performance, approve key
              decisions, and maintain ownership and bank-account control while the licensed teams handle the regulated,
              day-to-day execution. This is the &ldquo;own and direct&rdquo; structure the E-2 visa is built around.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {OPERATIONS.map((o) => (
              <Card key={o.id} data-testid={`card-insurance-operation-${o.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <o.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{o.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.desc}</div>
              </Card>
            ))}
          </div>

          {/* ★ Producer licensing — vertical-specific compliance note. */}
          {/* TODO(client): confirm exactly how the franchise handles state insurance
              producer / agency licensing (e.g. licensed producers on staff, operated
              under NDF's agency license, and/or the path for the owner to obtain
              licensing) and finalize this copy so it is accurate and compliant.
              (See brief placeholder #6 — this is the insurance parallel to the
              real-estate broker requirement on the Property Management page.) */}
          <div
            data-testid="insurance-licensing-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border bg-white/60 p-5 shadow-sm"
          >
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--primary))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Licensing handled for you.</span> Insurance sales are
              state-regulated and performed by licensed producers. New Dawn structures each agency so the regulated
              activities are carried out under appropriate producer and agency licensing — so you can focus on
              directing the business.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — How it creates jobs ── */}
      <section data-testid="section-insurance-jobs" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>U.S. job creation</SectionEyebrow>
            <h2 data-testid="insurance-jobs-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How the business creates American jobs
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A New Dawn Insurance franchise is staffed to operate as a real, regulated business, which means it employs
              people in the United States. As the book of business grows, the team grows with it. A typical operation
              supports roles such as:
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOBS.map((j) => (
              <Card key={j.id} data-testid={`card-insurance-job-${j.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <j.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{j.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{j.desc}</div>
              </Card>
            ))}
          </div>

          <div
            data-testid="insurance-jobs-e2-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <Users className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why this matters for E-2:</span> One of the central E-2
              requirements is that the business not be &ldquo;marginal&rdquo; — it must do more than provide a minimal
              living for the investor's family. An insurance agency that employs U.S. workers (including licensed
              producers) and generates recurring commission revenue directly addresses this, contributing to the local
              economy and demonstrating the enterprise's real economic impact.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — Why insurance works for E-2 investors ── */}
      <section data-testid="section-insurance-why" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>A strong fit for E-2 Treaty Investors</SectionEyebrow>
            <h2 data-testid="insurance-why-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Why insurance works for E-2 investors
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The vertical maps to what{" "}
              <Link href="/e-2-visa-process" className="underline underline-offset-2 hover:text-foreground">the E-2 visa process</Link>{" "}
              actually requires — a real, operating, owner-directed business that is substantial and not marginal. Backed
              by in-house E-2 immigration, finance, and legal professionals, and part of the New Dawn Franchising Group of
              Companies&trade;.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <Card key={w.id} data-testid={`card-insurance-why-${w.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
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
            data-testid="insurance-why-compliance-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Purchasing a franchise does not guarantee E-2 approval. Eligibility and approval are determined solely by
              U.S. consular officers and USCIS based on each individual petition. The Insurance vertical is structured
              to support — never to guarantee — a strong E-2 case.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — How it works ── */}
      <section data-testid="section-insurance-how" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 data-testid="insurance-how-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              From investment to a growing book of business
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <Card key={i} data-testid={`card-insurance-step-${i + 1}`} className="nh-surface nh-noise border-card-border/80 p-6">
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
      <section data-testid="section-insurance-investment" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Investment</SectionEyebrow>
            <h2 data-testid="insurance-investment-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              A substantial, at-risk investment — structured for E-2
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            <Card data-testid="card-insurance-investment-amount" className="nh-surface nh-noise border-card-border/80 p-6 text-center">
              <Briefcase className="mx-auto size-6 text-[hsl(var(--accent))]" />
              <div className="mt-3 text-3xl font-semibold text-[hsl(var(--primary))]">$225,000</div>
              <div className="mt-1 text-sm text-muted-foreground">Franchise investment from</div>
            </Card>
            <Card data-testid="card-insurance-investment-includes" className="nh-surface nh-noise border-card-border/80 p-6 md:col-span-2">
              <div className="text-base font-semibold">What it covers</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your franchise license, training, technology platform access, and operational setup. Financing options
                are available through affiliated lending partners.
              </p>
            </Card>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The E-2 visa requires a substantial, at-risk investment in a U.S. business. The Insurance vertical is
              structured specifically to meet this requirement. Full details are provided in the Franchise Disclosure
              Document (FDD).
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 8 — Is insurance the right vertical for you? ── */}
      <section data-testid="section-insurance-fit" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Is this the right vertical for you?</SectionEyebrow>
            <h2 data-testid="insurance-fit-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Insurance tends to fit investors who&hellip;
            </h2>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <ul className="space-y-3">
              {FIT.map((item, i) => (
                <li key={i} data-testid={`insurance-fit-item-${i}`} className="flex items-start gap-3 rounded-xl border bg-white/60 p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
                  <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
              During discovery, we compare Insurance against Property Management and Telecom based on your goals, market
              fit, investment preferences, and E-2 strategy, and walk you through the strongest fit.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 9 — FAQ ── */}
      <section data-testid="section-insurance-faq" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Frequently asked questions</SectionEyebrow>
            <h2 data-testid="insurance-faq-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Insurance, answered
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} data-testid={`insurance-faq-item-${i}`}>
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
      <section data-testid="section-insurance-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="insurance-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Direct a Recurring-Revenue Insurance Agency in the U.S.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Request the FDD and schedule an intro call to see whether the Insurance vertical fits your E-2 goals.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-insurance-cta-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-insurance-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
                </a>
              </Button>
              <BrochureDownload kind="investor" variant="outline" testId="button-insurance-cta-brochure" />
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-insurance-address"
                href={COMPANY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {COMPANY.addressFull}
              </a>
              <a
                data-testid="link-insurance-phone"
                href={`tel:${COMPANY.phoneTel}`}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0" />
                {COMPANY.phone}
              </a>
              <a
                data-testid="link-insurance-email"
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
      <section data-testid="section-insurance-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Important disclaimer
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              This page is for informational purposes only and is not an offer to sell or the solicitation of an offer
              to buy a franchise. Franchises are offered solely through a Franchise Disclosure Document in compliance
              with the FTC Franchise Rule and applicable state law, and only in states where New Dawn Franchising is
              registered, exempt, or otherwise authorized. New Dawn Franchising does not provide legal, immigration, or
              insurance advice and does not guarantee any E-2 visa approval or any financial result. Insurance products
              are offered only through appropriately licensed entities and producers. Prospective investors should
              consult independent legal, immigration, and financial advisors.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

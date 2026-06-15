import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Cloud,
  Cpu,
  FileText,
  GraduationCap,
  Handshake,
  Headphones,
  Layers,
  LineChart,
  Megaphone,
  MessageSquare,
  Network,
  Phone,
  Repeat,
  Rocket,
  Server,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
};

// ─── Section 1 — Core services ────────────────────────────────────────────────
const SERVICES = [
  {
    icon: Cloud,
    title: "Business VoIP / cloud phone systems (UCaaS)",
    desc: "Unified Communications as a Service: business phone, voicemail, mobile and desktop apps, and collaboration tools delivered over the internet on a per-seat subscription.",
    id: "ucaas",
  },
  {
    icon: Network,
    title: "SIP trunking & connectivity",
    desc: "The underlying voice capacity businesses use to make and receive calls, typically billed per concurrent call path plus usage.",
    id: "sip",
  },
  {
    icon: Headphones,
    title: "Contact center solutions (CCaaS)",
    desc: "Higher-value seats for companies that run inbound and outbound calling operations.",
    id: "ccaas",
  },
  {
    icon: MessageSquare,
    title: "Business messaging & digital fax",
    desc: "SMS / text, chat, and secure digital fax that integrate into existing workflows.",
    id: "messaging",
  },
];

// ─── Section 2 — Why recurring revenue matters to an investor ──────────────────
const REVENUE_REASONS = [
  {
    icon: Repeat,
    title: "Predictability",
    desc: "Unlike a restaurant or retail store that starts from zero every morning, a telecom book of business renews automatically. Revenue is contracted, not hoped for.",
    id: "predictability",
  },
  {
    icon: ShieldCheck,
    title: "Stickiness",
    desc: "Businesses rarely switch phone and communications providers casually — the switching friction is high, which supports strong customer retention.",
    id: "stickiness",
  },
  {
    icon: Layers,
    title: "Scalability",
    desc: "Adding the next customer costs far less than acquiring the first. Margins improve as the recurring base grows.",
    id: "scalability",
  },
  {
    icon: TrendingUp,
    title: "Compounding value",
    desc: "A company valued on recurring revenue becomes more valuable as that revenue base grows — which matters when you eventually want to demonstrate growth or exit.",
    id: "compounding",
  },
];

// ─── Section 3 — How the vertical maps to the E-2 requirements ─────────────────
const E2_FIT = [
  {
    icon: BadgeCheck,
    title: "Real and operating",
    desc: "This is an active services business with paying customers and live contracts from day one of operation — not a passive or speculative holding.",
    id: "real-operating",
  },
  {
    icon: Settings,
    title: "You develop and direct it",
    desc: "As owner-operator you control hiring, customer strategy, vendor relationships, and growth. New Dawn provides operational support while you direct and develop the enterprise.",
    id: "develop-direct",
  },
  {
    icon: Briefcase,
    title: "Substantial investment",
    desc: "Your investment funds the operating company, its staffing, customer acquisition, and working capital — capital committed to a real, active enterprise.",
    id: "substantial",
  },
  {
    icon: Users,
    title: "Not marginal — it creates jobs",
    desc: "A recurring-revenue services business gives you a credible, scalable hiring story. Job creation and economic impact sit at the heart of a strong E-2 case.",
    id: "not-marginal",
  },
];

// ─── Section 4 — Roles a managed communications business creates ───────────────
const JOBS = [
  {
    icon: TrendingUp,
    title: "Sales & account development",
    desc: "Acquiring new business customers and growing the recurring book.",
    id: "sales",
  },
  {
    icon: Rocket,
    title: "Customer onboarding & implementation",
    desc: "Provisioning service and configuring systems for each new account.",
    id: "onboarding",
  },
  {
    icon: Headphones,
    title: "Technical support & customer success",
    desc: "The ongoing support that keeps recurring accounts renewing.",
    id: "support",
  },
  {
    icon: Briefcase,
    title: "Operations & administration",
    desc: "Billing, vendor management, and back-office functions.",
    id: "operations",
  },
];

// ─── Section 5 — Franchise support ────────────────────────────────────────────
// TODO(client): confirm these against the actual New Dawn telecom support package /
// FDD Item 11 obligations before publish. Page copy and the FDD must not contradict.
const SUPPORT = [
  {
    icon: FileText,
    title: "Established operating playbook & SOPs",
    desc: "A documented way of running the business so you can operate with confidence from day one.",
    id: "playbook",
  },
  {
    icon: Server,
    title: "Vendor & infrastructure relationships",
    desc: "Enterprise-grade carrier infrastructure through New Dawn's vendor relationships — so you don't build a carrier from scratch.",
    id: "infrastructure",
  },
  {
    icon: GraduationCap,
    title: "Onboarding, training & ongoing support",
    desc: "Structured onboarding and continued operational support as your customer base grows.",
    id: "training",
  },
  {
    icon: Megaphone,
    title: "Marketing & customer-acquisition support",
    desc: "Tools and guidance to help you find and win business customers in your market.",
    id: "marketing",
  },
  {
    icon: LineChart,
    title: "Back-office, systems & CRM tooling",
    desc: "Proprietary technology for pipeline, reporting, and the day-to-day operating cadence.",
    id: "systems",
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">{children}</div>
  );
}

export default function TelecomPage() {
  return (
    <div data-testid="page-telecom" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-telecom-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Cpu className="size-3.5 text-[hsl(var(--accent))]" />
              One of three New Dawn verticals
            </div>
            <h1
              data-testid="telecom-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Telecom — Own a Recurring-Revenue Business Communications Company in the U.S.
            </h1>
            <p
              data-testid="telecom-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Cloud-based voice, messaging, and connectivity services that businesses pay for every month —
              operated under your direction, built on enterprise-grade infrastructure, and structured to support a
              strong E-2 Treaty Investor petition.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-telecom-hero-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Speak with our team
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-telecom-hero-e2" variant="secondary" className="gap-2" asChild>
                <Link href="/e2-fit">
                  See how the E-2 pathway works
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 1 — What this business actually is ── */}
      <section data-testid="section-telecom-what" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>What this business is</SectionEyebrow>
            <h2 data-testid="telecom-what-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Managed cloud communications for U.S. businesses
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The New Dawn telecom franchise places you at the center of one of the most durable corners of the modern
              economy: the communications services that businesses cannot operate without. As the owner-operator, your
              company delivers managed cloud communications to small and mid-sized businesses across the United States.
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
              You are not building a phone network from scratch. The business operates on{" "}
              {/* TODO(client): confirm the exact platform / wholesale / white-label relationship and only
                  name a third party (e.g. a specific carrier/platform partner) once it is approved in writing.
                  Until then keep the generic language below. — see brief Section 1. */}
              enterprise-grade carrier infrastructure provided through New Dawn's vendor relationships — so your
              company can focus on what creates value locally: acquiring business customers, onboarding and supporting
              them, and growing a book of recurring accounts.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — The contracts / recurring revenue ── */}
      <section data-testid="section-telecom-contracts" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Where the revenue comes from</SectionEyebrow>
            <h2 data-testid="telecom-contracts-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              A contract-based, recurring-revenue business
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              That single fact is what makes telecom attractive both as an investment and as the foundation of an E-2
              petition. Your company holds two complementary types of agreements.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-telecom-contract-end-customer" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Repeat className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">1. End-customer service contracts</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Businesses subscribe to your communications services on monthly or multi-year terms. Each account is a
                recurring revenue stream:
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <span><span className="font-medium text-foreground">Subscription component</span> — predictable monthly recurring revenue (MRR), usually priced per user / seat.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <span><span className="font-medium text-foreground">Usage component</span> — additional revenue from call volume, overage, and add-on services layered on top of the base subscription.</span>
                </li>
              </ul>
            </Card>

            <Card data-testid="card-telecom-contract-channel" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Handshake className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">2. Channel & reseller relationships</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A portion of the business can be grown through Managed Service Providers (MSPs) and resellers who carry
                the end-customer relationship while your company supplies the underlying service — an efficient way to
                scale without proportionally scaling your own sales headcount.
              </p>
            </Card>
          </div>

          {/* TODO(client, only if verified): representative pricing ranges, target ARPU, or typical
              contract length may be inserted here. If published, the numbers must be defensible.
              Until verified, the section stays qualitative — see brief Section 2. */}

          <div className="mx-auto mt-10 max-w-3xl text-center">
            <h3 className="text-lg font-semibold">Why this structure matters to an investor</h3>
          </div>
          <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REVENUE_REASONS.map((r) => (
              <Card key={r.id} data-testid={`card-telecom-revenue-${r.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <r.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{r.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — Strong fit for E-2 ── */}
      <section data-testid="section-telecom-e2-fit" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>A strong fit for E-2 Treaty Investors</SectionEyebrow>
            <h2 data-testid="telecom-e2-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Built around what the E-2 visa actually requires
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              <Link href="/e-2-visa-process" className="underline underline-offset-2 hover:text-foreground">The E-2 visa process</Link>{" "}
              requires more than money. It requires a business that is real and operating,
              an investment that is substantial and at risk, an investor who will develop and direct the enterprise, and
              a business that is not marginal — one with the capacity to generate more than a minimal living, typically
              by creating jobs and economic impact. The telecom vertical maps to each of these.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {E2_FIT.map((f) => (
              <Card key={f.id} data-testid={`card-telecom-e2-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
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

          {/* TODO(client): confirm the exact division of control between the franchisee and New Dawn so the
              petition clearly shows the investor "directs and develops" (USCIS scrutinizes franchisor control),
              and reference the package investment figure consistent with your FDD where appropriate. */}

          {/* Compliance callout — approval is never guaranteed (DOS / USCIS decide). */}
          <div
            data-testid="telecom-e2-compliance-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Purchasing a franchise does not guarantee E-2 approval. Eligibility and approval are determined solely by
              U.S. consular officers and USCIS based on each individual petition. The telecom vertical is structured to
              support — never to guarantee — a strong E-2 case.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — How the business creates U.S. jobs ── */}
      <section data-testid="section-telecom-jobs" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>U.S. job creation</SectionEyebrow>
            <h2 data-testid="telecom-jobs-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How the business creates American jobs
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              E-2 petitions succeed in large part on the strength of their job-creation and economic-impact story. A
              managed communications business creates real, ongoing American roles as it grows its customer base.
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

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Because the business is recurring and scalable, headcount grows with the customer base — giving your
              petition a defensible, multi-year hiring trajectory rather than a one-time spike.
            </p>
            {/* TODO(client): insert your projected hiring plan / headcount-by-year figures from your business plan
                and financial model. They must be realistic and supportable — do NOT publish invented job numbers,
                as USCIS and the consular officer will compare them to your actual plan. — see brief Section 4. */}
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — How New Dawn supports you ── */}
      <section data-testid="section-telecom-support" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>How New Dawn supports you</SectionEyebrow>
            <h2 data-testid="telecom-support-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              You are not doing this alone
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              New Dawn provides the franchise framework that lets an investor — including one new to the U.S. market and
              to telecom — operate with confidence.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORT.map((s) => (
              <Card key={s.id} data-testid={`card-telecom-support-${s.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <s.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{s.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — Closing CTA ── */}
      <section data-testid="section-telecom-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="telecom-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Build a real U.S. business — and a real U.S. immigration foundation
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              The telecom vertical combines a durable, recurring-revenue business model with the job-creating,
              owner-directed profile that supports a strong E-2 Treaty Investor petition. Talk with our team about
              whether it's the right fit for you.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-telecom-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Schedule a consultation
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-telecom-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
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
              This page is for informational purposes only and is not legal or immigration advice. New Dawn Franchising
              is not a law firm and does not provide legal or immigration services. Eligibility for and approval of an
              E-2 Treaty Investor visa is determined solely by the U.S. Department of State and/or U.S. Citizenship and
              Immigration Services based on each applicant's individual circumstances; no outcome is guaranteed.
              Prospective franchisees should consult independent qualified immigration counsel. This is not a franchise
              offering. A franchise offering is made only by Franchise Disclosure Document. Financial and operational
              results vary; nothing herein is a guarantee of revenue, profit, employment levels, or business success.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

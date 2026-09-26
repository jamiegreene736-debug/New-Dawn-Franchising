import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Coins,
  FileText,
  Gauge,
  Handshake,
  Layers,
  Lock,
  Phone,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
};

// ─── Section 1 — What New Dawn provides on the acquired business ───────────────
const WHAT_WE_PROVIDE = [
  {
    icon: Search,
    title: "Pre-acquisition vetting",
    desc: "Every target business — whether you bring it to us or we source it — passes the same vetting gate for E-2 viability and renewal survivability before we proceed.",
    id: "vetting",
  },
  {
    icon: Settings,
    title: "Deal & entity structuring",
    desc: "We structure the acquisition and entity to satisfy the E-2 'develop and direct' requirement, in coordination with your immigration counsel.",
    id: "structuring",
  },
  {
    icon: Layers,
    title: "A snap-on operations layer",
    desc: "A standardized management and oversight overlay installed onto the acquired business so you stay out of the daily grind — not a bespoke build per client.",
    id: "operations",
  },
  {
    icon: FileText,
    title: "Initial application support",
    desc: "Documentation, business plan, and financial packaging — assembled in coordination with your immigration counsel, who prepares and files the petition.",
    id: "application",
  },
  {
    icon: RefreshCw,
    title: "Renewal compliance support",
    desc: "Refreshed financials and non-marginality evidence at each renewal cycle, with counsel coordination, to support renewal.",
    id: "renewal",
  },
  {
    icon: BadgeCheck,
    title: "You keep ownership & direction",
    desc: "You acquire and own the operating business and direct its strategy. New Dawn is the operations and compliance layer — not the law firm, not the owner.",
    id: "ownership",
  },
];

// ─── Section 2 — Two ways a client enters ─────────────────────────────────────
const ENTRY_PATHS = [
  {
    icon: Briefcase,
    title: "Bring your own (BYO)",
    desc: "You identify a target business and submit it to New Dawn for vetting. If it clears the gate, we structure the deal and install the operations layer.",
    id: "byo",
  },
  {
    icon: Search,
    title: "We source it",
    desc: "You tell us a desired industry. New Dawn sources candidate businesses, vets them, and presents qualified options for you to choose from.",
    id: "sourced",
  },
];

// ─── Section 3 — How the vertical maps to the E-2 requirements ─────────────────
const E2_FIT = [
  {
    icon: BadgeCheck,
    title: "Real and operating",
    desc: "The target is an existing business with operating history — real financials and a genuine operating record, not a speculative start-up.",
    id: "real-operating",
  },
  {
    icon: Settings,
    title: "You develop and direct it",
    desc: "You set strategy, hold hiring/firing authority over management, sign off on major decisions, and control the entity. The installed management layer executes under your direction.",
    id: "develop-direct",
  },
  {
    icon: Briefcase,
    title: "Substantial investment",
    desc: "Acquisition price starts at a $100,000 minimum (no maximum), funding a substantial, at-risk investment into a real operating enterprise.",
    id: "substantial",
  },
  {
    icon: Users,
    title: "Not marginal",
    desc: "Every target must credibly clear the non-marginality bar at renewal — generating more than a minimal living for the investor and family.",
    id: "not-marginal",
  },
];

// ─── Section 4 — Fee schedule (recommended defaults; final per engagement) ─────
const FEES = [
  {
    icon: Settings,
    component: "Setup & Structuring Fee",
    type: "One-time",
    amount: "$50,000",
    covers:
      "Business vetting, E-2 deal & entity structuring, source-of-funds and business-plan support, operations setup, and counsel coordination for the initial petition.",
    id: "setup",
  },
  {
    icon: Repeat,
    component: "Operations Management",
    type: "Recurring (monthly)",
    amount: "Tiered $2.5K / $4K / $6K",
    covers:
      "The installed snap-on management and oversight layer (plus coordination of the local manager) running the acquired business. Tier is set by business complexity at vetting.",
    id: "ops",
  },
  {
    icon: RefreshCw,
    component: "Renewal Compliance",
    type: "Per renewal cycle",
    amount: "$12,000",
    covers:
      "Refreshed financials, non-marginality evidence, proof the investor still directs the enterprise, and counsel coordination for the renewal.",
    id: "renewal-fee",
  },
];

const OPS_TIERS = [
  {
    tier: "Tier 1",
    price: "$2,500 / mo",
    desc: "Simple, low-headcount, single-location service business.",
    id: "tier-1",
  },
  {
    tier: "Tier 2",
    price: "$4,000 / mo",
    desc: "Moderate complexity, small staff, inventory or multi-channel.",
    id: "tier-2",
  },
  {
    tier: "Tier 3",
    price: "$6,000 / mo",
    desc: "Multi-location, larger headcount, or regulated operations.",
    id: "tier-3",
  },
];

// ─── Section 5 — Deal flow ────────────────────────────────────────────────────
const DEAL_FLOW = [
  {
    step: "1",
    title: "Intake & qualification",
    desc: "We confirm your risk profile, funds available ($100K minimum), and target industry — then set your path: bring your own target, or have New Dawn source candidates.",
    id: "intake",
  },
  {
    step: "2",
    title: "Vetting gate (hard stop)",
    desc: "The target is assessed for E-2 viability, renewal survivability, and whether the snap-on operations layer can credibly be installed and run. Fail → we decline or find another target. Pass → we proceed.",
    id: "vetting",
  },
  {
    step: "3",
    title: "Structuring",
    desc: "Counsel and New Dawn set the entity, ownership, and develop-and-direct framework. The operations tier is assigned.",
    id: "structuring",
  },
  {
    step: "4",
    title: "Purchase agreement + escrow",
    desc: "A signed purchase agreement is executed and funds are placed into escrow, with E-2 approval as the sole release condition.",
    id: "escrow",
  },
  {
    step: "5",
    title: "Application support",
    desc: "New Dawn packages financials, business plan, and compliance evidence. Your immigration counsel prepares and files the petition.",
    id: "application",
  },
  {
    step: "6",
    title: "Approval",
    desc: "On approval, escrow releases, the purchase closes, and you take ownership of the business.",
    id: "approval",
  },
  {
    step: "7",
    title: "Operations handover",
    desc: "New Dawn installs the snap-on operations layer; a local manager runs daily operations under New Dawn oversight. The recurring ops retainer begins.",
    id: "handover",
  },
  {
    step: "8",
    title: "Renewal cycle",
    desc: "New Dawn refreshes the compliance evidence and your counsel files the renewal at each cycle.",
    id: "renewal",
  },
];

// ─── Section 6 — The vetting gate (what gets rejected) ─────────────────────────
const VETTING_REJECT = [
  "Can't credibly clear the non-marginality bar at renewal.",
  "Falls below the $100,000 acquisition floor.",
  "Has financials or books too thin or messy to support a clean application.",
  "Sits in an industry the snap-on model can't realistically run to standard.",
  "Carries a purchase-agreement structure counsel can't make E-2-clean.",
];

// ─── Section 7 — Included vs excluded ──────────────────────────────────────────
const INCLUDED = [
  "Pre-acquisition vetting",
  "Deal & entity structuring support",
  "Operations setup and management (the snap-on layer)",
  "Compliance-evidence packaging",
  "Immigration-counsel coordination",
  "Renewal compliance support",
];

const EXCLUDED = [
  "Finding & choosing the business — the client, or New Dawn if you opt for sourcing (always subject to New Dawn vetting).",
  "The legal petition — prepared and filed by licensed immigration counsel, not New Dawn.",
  "The purchase capital — your money, held in escrow.",
  "The outcome — no guarantee of approval or renewal; that is the government's decision.",
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">{children}</div>
  );
}

export default function E2SnapOnPage() {
  return (
    <div data-testid="page-e2-snapon" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-snapon-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-[hsl(var(--accent))]" />
              Standalone E-2 offering — separate from our three franchise verticals
            </div>
            <h1
              data-testid="snapon-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              The E-2 SnapOn — You Choose It. You Direct It. We Run It.
            </h1>
            <p
              data-testid="snapon-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              A standalone E-2 operations-and-compliance service for treaty investors who already have a business — or
              an industry — in mind. You acquire your own operating business; New Dawn snaps a standardized management
              and compliance layer onto it, takes the daily grind off your plate, and packages the evidence to support a
              strong E-2 petition — prepared and filed by your immigration counsel.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-snapon-hero-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Speak with our team
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-snapon-hero-e2" variant="secondary" className="gap-2" asChild>
                <Link href="/e-2-visa-process">
                  See how the E-2 process works
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 1 — What it is ── */}
      <section data-testid="section-snapon-what" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>What it is</SectionEyebrow>
            <h2 data-testid="snapon-what-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              One productized model that snaps onto any qualifying business
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Unlike the franchise route — where you buy into one of our owned, pre-engineered businesses (
              <Link href="/property-management" className="underline underline-offset-2 hover:text-foreground">property management</Link>,{" "}
              <Link href="/telecom" className="underline underline-offset-2 hover:text-foreground">telecom</Link>, or{" "}
              <Link href="/insurance" className="underline underline-offset-2 hover:text-foreground">insurance</Link>) —
              here you acquire your own operating business that falls outside those verticals. New Dawn drops a
              repeatable operations-and-compliance overlay onto whatever qualifying business you buy. You keep ownership
              and direction; we run the day-to-day and package the compliance evidence.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_WE_PROVIDE.map((s) => (
              <Card key={s.id} data-testid={`card-snapon-provide-${s.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <s.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{s.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
              </Card>
            ))}
          </div>

          {/* Two ways to enter */}
          <div className="mx-auto mt-10 max-w-3xl text-center">
            <h3 className="text-lg font-semibold">Two ways a client enters</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Either way, every target passes the same vetting gate before we proceed.
            </p>
          </div>
          <div className="mx-auto mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
            {ENTRY_PATHS.map((p) => (
              <Card key={p.id} data-testid={`card-snapon-entry-${p.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <p.icon className="size-6 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-lg font-semibold">{p.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Acquisition price: a $100,000 minimum, with no maximum.</span>{" "}
              The floor ensures the business is substantial enough to support the application and clear marginality at
              renewal. Above the floor is necessary but not sufficient — the vetting gate still confirms the specific
              business throws off more than a minimal living, regardless of sticker price.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — Capital protection guarantee ── */}
      <section data-testid="section-snapon-capital" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The guarantee we can make</SectionEyebrow>
            <h2 data-testid="snapon-capital-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Your purchase capital is protected
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              We never guarantee a visa — approval is the government's decision. What we can guarantee is capital
              protection. Your purchase funds sit in escrow and release only on E-2 approval; if the petition is denied,
              the funds return in full.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-snapon-pool-a" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Lock className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">Pool A — Business purchase capital</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your money. Held in escrow and released only on E-2 approval, with approval as the sole release
                condition. Protected and returned in full if the petition is denied. This is not New Dawn revenue.
              </p>
            </Card>
            <Card data-testid="card-snapon-pool-b" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Coins className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="mt-4 text-lg font-semibold">Pool B — New Dawn service fees</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Our fees for vetting, structuring, operations, and compliance support — delivered regardless of outcome.
                Because the promise is effort, structure, and operations (never an outcome), these fees are
                non-refundable.
              </p>
            </Card>
          </div>

          <div
            data-testid="snapon-capital-callout"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Because the target is an existing business with operating history, the application rests on a signed
              purchase agreement, funded escrow, and real financials — a strong package. Escrow releases and the
              purchase closes after approval.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — Strong fit for E-2 ── */}
      <section data-testid="section-snapon-e2-fit" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>A strong fit for E-2 Treaty Investors</SectionEyebrow>
            <h2 data-testid="snapon-e2-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Built around what the E-2 visa actually requires
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The{" "}
              <Link href="/e-2-visa-process" className="underline underline-offset-2 hover:text-foreground">E-2 visa process</Link>{" "}
              requires more than money: a business that is real and operating, an investment that is substantial and at
              risk, an investor who will develop and direct the enterprise, and a business that is not marginal. The
              SnapOn model is structured around each of these.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {E2_FIT.map((f) => (
              <Card key={f.id} data-testid={`card-snapon-e2-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
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

          {/* Develop-and-direct watch-point */}
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 size-5 shrink-0 text-[hsl(var(--primary))]" />
              <div>
                <div className="text-base font-semibold">Develop and direct — by design</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  E-2 requires the investor to develop and direct the enterprise — passive investment does not qualify.
                  You set strategy, hold hiring/firing authority over management, sign off on major decisions, and
                  control the entity. New Dawn's installed management layer and the local manager execute day-to-day
                  under your direction — your management resource, not the controlling mind. That framing is carried
                  consistently through the org chart, operating agreement, and petition narrative.
                </p>
              </div>
            </div>
          </div>

          {/* Compliance callout — approval is never guaranteed (DOS / USCIS decide). */}
          <div
            data-testid="snapon-e2-compliance-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              The SnapOn service does not guarantee E-2 approval. Eligibility and approval are determined solely by U.S.
              consular officers and USCIS based on each individual petition. We structure and document the investment to
              maximize approval likelihood — never to guarantee the outcome.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — Fee schedule ── */}
      <section data-testid="section-snapon-fees" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Fee schedule</SectionEyebrow>
            <h2 data-testid="snapon-fees-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              A separate fee schedule, weighted toward recurring
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A modest setup fee plus a meaningful operations retainer beats a large front-loaded number — better
              retention, and far less exposure than a single large upfront sum. Recommended defaults are shown; final
              numbers are confirmed per engagement.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-3">
            {FEES.map((f) => (
              <Card key={f.id} data-testid={`card-snapon-fee-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <f.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-foreground/60">{f.type}</div>
                <div className="mt-1 text-base font-semibold">{f.component}</div>
                <div className="mt-1 text-2xl font-semibold text-[hsl(var(--primary))]">{f.amount}</div>
                <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.covers}</div>
              </Card>
            ))}
          </div>

          {/* Operations tiers */}
          <div className="mx-auto mt-10 max-w-3xl text-center">
            <h3 className="text-lg font-semibold">Operations tiers (set at vetting)</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The monthly operations retainer is set by the complexity of the acquired business.
            </p>
          </div>
          <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-3">
            {OPS_TIERS.map((t) => (
              <Card key={t.id} data-testid={`card-snapon-tier-${t.id}`} className="nh-surface nh-noise border-card-border/80 p-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60">{t.tier}</div>
                <div className="mt-1 text-xl font-semibold text-[hsl(var(--primary))]">{t.price}</div>
                <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.desc}</div>
              </Card>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground/70">
            Figures shown are recommended defaults and may vary by engagement and the structure of any attorney-fee
            arrangement. New Dawn service fees cover effort, structure, and operations, and are non-refundable;
            your business purchase capital is held separately in escrow (see above).
          </p>
        </div>
      </section>

      {/* ── SECTION 5 — Deal flow ── */}
      <section data-testid="section-snapon-flow" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Deal flow</SectionEyebrow>
            <h2 data-testid="snapon-flow-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              From intake to renewal — step by step
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A clear, repeatable path with a hard vetting gate up front and capital held in escrow until approval.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {DEAL_FLOW.map((s) => (
              <Card key={s.id} data-testid={`card-snapon-flow-${s.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full border bg-[hsl(var(--primary))]/10 text-sm font-semibold text-[hsl(var(--primary))]">
                    {s.step}
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

      {/* ── SECTION 6 — The vetting gate ── */}
      <section data-testid="section-snapon-vetting" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The vetting gate (non-negotiable)</SectionEyebrow>
            <h2 data-testid="snapon-vetting-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Renewal survivability — not just "can we file"
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Because we operate a business we did not design, the bar at intake is renewal survivability. A documented
              pass/fail checklist at this gate protects margin, reputation, and renewal rates. We reject any target that:
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {VETTING_REJECT.map((r) => (
              <div
                key={r}
                data-testid="snapon-vetting-item"
                className="flex items-start gap-3 rounded-2xl border bg-white/60 p-4 shadow-sm"
              >
                <XCircle className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
                <span className="text-sm leading-relaxed text-muted-foreground">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — Included vs excluded ── */}
      <section data-testid="section-snapon-scope" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>What's included vs. excluded</SectionEyebrow>
            <h2 data-testid="snapon-scope-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Clear lines on who does what
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-snapon-included" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-[hsl(var(--primary))]" />
                <div className="text-lg font-semibold">Included (New Dawn)</div>
              </div>
              <ul className="mt-4 space-y-2">
                {INCLUDED.map((i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card data-testid="card-snapon-excluded" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-center gap-3">
                <XCircle className="size-6 text-[hsl(var(--accent))]" />
                <div className="text-lg font-semibold">Excluded / by others</div>
              </div>
              <ul className="mt-4 space-y-2">
                {EXCLUDED.map((i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION 8 — Closing CTA ── */}
      <section data-testid="section-snapon-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Handshake className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="snapon-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Bring the business. We'll run it — and package the compliance.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              If you already have a business or an industry in mind that sits outside our three franchise verticals, the
              E-2 SnapOn lets you keep ownership and direction while New Dawn handles operations and compliance. Talk
              with our team about whether your target qualifies.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-snapon-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Schedule a consultation
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-snapon-cta-call" variant="secondary" className="gap-2" asChild>
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
      <section data-testid="section-snapon-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Important disclaimer
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              This page is for informational purposes only and is not legal or immigration advice. New Dawn Franchising
              is the business-operations and compliance-documentation layer; it is not a law firm and does not provide
              legal or immigration services or prepare or file petitions. The E-2 petition is prepared and filed by the
              client's licensed immigration counsel. Eligibility for and approval of an E-2 Treaty Investor visa is
              determined solely by the U.S. Department of State and/or U.S. Citizenship and Immigration Services based on
              each applicant's individual circumstances; no outcome is guaranteed. Escrow terms, the develop-and-direct
              structure, source-of-funds, and all petition work require the client's immigration counsel on a per-deal
              basis. Fees shown are recommended defaults and may vary by engagement. Financial and operational results
              vary; nothing herein is a guarantee of revenue, profit, employment levels, business success, or visa
              approval.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

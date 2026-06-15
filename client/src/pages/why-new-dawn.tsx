import { useEffect } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  CheckCircle2,
  FileText,
  Gauge,
  GraduationCap,
  Handshake,
  HelpCircle,
  LineChart,
  MapPin,
  Megaphone,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  X,
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
    "What Makes New Dawn Different | E-2-Compliant Franchise Platform — Live Anywhere, Human-Run Operations | El Paso, TX",
  description:
    "New Dawn was engineered around E-2 visa requirements — own and direct a real U.S. business, live anywhere in the country, with day-to-day operations run by human teams and AI powering growth and oversight.",
  canonical: "https://www.newdawnfranchising.com/why-new-dawn",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

// ─── Three-pillar summary band ────────────────────────────────────────────────
const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Engineered for E-2 Compliance",
    desc: "Built from the E-2 requirements up — own and direct, non-marginal, substantial and at-risk, renewal-ready.",
    href: "#e2-compliance",
    id: "compliance",
  },
  {
    icon: MapPin,
    title: "Live Anywhere in the USA",
    desc: "Trained local teams handle execution, so you direct the business from wherever your family chooses to live.",
    href: "#live-anywhere",
    id: "anywhere",
  },
  {
    icon: Sparkles,
    title: "Human Operations, AI-Powered Growth",
    desc: "Day-to-day operations are 100% human. AI powers growth, analysis, documentation, and your oversight tools.",
    href: "#human-ai",
    id: "human-ai",
  },
];

// ─── Section 1 — Traditional E-2 business vs. New Dawn ────────────────────────
const COMPARISON = [
  {
    traditional: "Tied to one location — your life happens where the business is",
    newdawn: "Live anywhere in the U.S. while directing the business",
  },
  {
    traditional: "You work the counter / the shift yourself",
    newdawn: "You direct; trained local teams handle daily execution",
  },
  {
    traditional: "Thin margins; can look “marginal” to officers",
    newdawn: "Recurring revenue plus real U.S. jobs — a non-marginal profile",
  },
  {
    traditional: "Renewal record reconstructed under pressure years later",
    newdawn: "Auditable management trail built from day one",
  },
];

// ─── Section 2 — Engineered for E-2 compliance ────────────────────────────────
const E2_PRINCIPLES = [
  {
    icon: BadgeCheck,
    title: "You own and direct — genuinely",
    desc: "You hold ownership control, bank-account authority, and executive decision-making. You set direction, approve key decisions, supervise the team, and review performance through your owner dashboard — real direction, not a passive stake dressed up to look active.",
    id: "own-direct",
  },
  {
    icon: Users,
    title: "A real, non-marginal enterprise",
    desc: "Every vertical is a real operating business that generates recurring revenue — telecom residuals, property management fees, or insurance renewal commissions — and employs trained U.S. workers. Recurring revenue plus real jobs is the profile that speaks to non-marginality.",
    id: "non-marginal",
  },
  {
    icon: Building2,
    title: "A substantial, at-risk investment",
    desc: "The franchise investment — starting at $225,000 — is structured to meet the E-2 substantiality requirement, with capital deployed into a real, operating enterprise rather than parked passively.",
    id: "substantial",
  },
  {
    icon: FileText,
    title: "Renewal-ready by design",
    desc: "An E-2 visa must be renewed, and at renewal you must show the business is still real, active, and directed by you. Our model produces an auditable trail of your active management — documented decisions, reporting, and oversight — so the record is built from day one, not reconstructed under pressure.",
    id: "renewal-ready",
  },
];

// ─── Section 3 — Live and work anywhere ───────────────────────────────────────
const ANYWHERE = [
  {
    icon: MapPin,
    title: "Choose where your family lives",
    desc: "Base the decision on schools, community, and lifestyle — not on where the business happens to be.",
    id: "choose",
  },
  {
    icon: Gauge,
    title: "Real executive oversight from anywhere",
    desc: "Maintain ownership control and supervision from wherever you are, supported by owner dashboards and reporting.",
    id: "oversight",
  },
  {
    icon: LineChart,
    title: "Keep directing as it grows",
    desc: "Scale the business without being tied to a single storefront or shift schedule.",
    id: "grow",
  },
];

// ─── Section 4 — Humans do / AI does ──────────────────────────────────────────
const HUMANS_DO = [
  "Serve customers, place tenants, service policies, and sign telecom subscribers",
  "Answer the phone and solve problems in real time",
  "Build the relationships that drive retention and compound recurring revenue",
  "Fill real U.S. jobs — central to a non-marginal, active enterprise",
];

const AI_DOES = [
  "Growth — marketing, lead generation, and sales support that run around the clock",
  "Analysis — surfacing trends, performance, and opportunities across the business",
  "Documentation & reporting — capturing the auditable management trail for renewals",
  "Owner oversight — real-time, executive-level dashboards you can use from anywhere",
];

// ─── Section 7 — FAQ ──────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How is this different from just buying a business and hiring an attorney?",
    a: "We started from the E-2 requirements and built the business model around them — ownership and direction, recurring revenue, real U.S. jobs, and a documented management trail for renewals. The result is a business designed to be owned and directed by an E-2 investor, not a generic business retrofitted to fit.",
  },
  {
    q: "Does using local teams make my investment “passive”? Would that hurt my E-2?",
    a: "No — and this is the key distinction. You genuinely own and direct the business: ownership control, bank-account authority, key decisions, and supervision are yours. Local teams execute; you direct. The owner dashboards and reporting are built to document exactly that active direction. Your immigration attorney advises on your specific petition.",
  },
  {
    q: "Is AI running my business?",
    a: "No. Day-to-day operations are handled entirely by trained human team members. AI is used for growth (marketing, lead generation), analysis, documentation, reporting, and your oversight dashboards — never to run daily operations.",
  },
  {
    q: "Can I really live anywhere in the U.S.?",
    a: "Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live elsewhere in the United States while maintaining executive oversight of the franchise.",
  },
  {
    q: "What happens at renewal?",
    a: "Because your active management is documented as you go, the record you need at renewal — showing the business is real, active, and directed by you — is being built from day one. New Dawn does not guarantee any visa outcome; renewal decisions rest with the U.S. government.",
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

function useWhyNewDawnSeo() {
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

export default function WhyNewDawnPage() {
  useWhyNewDawnSeo();

  return (
    <div data-testid="page-why-new-dawn" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-wnd-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-[hsl(var(--accent))]" />
              The New Dawn difference
            </div>
            <h1
              data-testid="wnd-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Built for the E-2 Visa, From the Ground Up
            </h1>
            <p
              data-testid="wnd-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Most E-2 investors are handed a business and left to figure out the visa. We did it the other way around —
              New Dawn was engineered around what the E-2 visa actually requires, so you can own and direct a real U.S.
              business, live anywhere in the country, and build a clean record of active ownership from day one.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-wnd-hero-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-wnd-hero-call" variant="secondary" className="gap-2" asChild>
                <Link href="/contact">
                  Schedule an Intro Call
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Three-pillar summary band */}
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {PILLARS.map((p) => (
              <a
                key={p.id}
                href={p.href}
                data-testid={`card-wnd-pillar-${p.id}`}
                className="group rounded-2xl border bg-white/60 p-6 text-left shadow-sm transition-colors hover:border-[hsl(var(--accent))]/40 hover:bg-white"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <p.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-base font-semibold">
                  {p.title}
                  <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 1 — The problem we set out to solve ── */}
      <section data-testid="section-wnd-problem" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The problem we set out to solve</SectionEyebrow>
            <h2 data-testid="wnd-problem-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The E-2 trade-off most investors are forced to make
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              For an E-2 investor, the business isn't just an investment — it's the foundation of your family's life in
              the United States. Yet most options force a hard trade-off.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-wnd-problem-traditional" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="text-base font-semibold">Buy a traditional small business</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A restaurant, a convenience store, a car wash — and you're often tied to one location, working long
                hours in a role you didn't choose, with thin margins and a business that can look &ldquo;marginal&rdquo;
                to immigration officers.
              </p>
            </Card>
            <Card data-testid="card-wnd-problem-passive" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="text-base font-semibold">Buy a passive investment</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                And you risk failing the most basic E-2 test of all: the visa requires you to develop and direct a real,
                active enterprise. Passive money doesn't qualify.
              </p>
            </Card>
          </div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
            The result is a market full of compromises — and a renewal process that catches many owners off guard years
            later, when they're asked to prove the business is real, active, and genuinely theirs to run. New Dawn was
            built to remove that trade-off. We started from the E-2 requirements and designed the business model around
            them — not the reverse.
          </p>

          {/* Comparison block */}
          <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-2xl border bg-white/60 shadow-sm">
            <div className="grid grid-cols-2 border-b bg-white/70 text-sm font-semibold">
              <div className="flex items-center gap-2 p-4 text-muted-foreground">
                <X className="size-4 shrink-0 text-red-500/70" />
                Traditional E-2 business
              </div>
              <div className="flex items-center gap-2 border-l p-4">
                <CheckCircle2 className="size-4 shrink-0 text-[hsl(var(--accent))]" />
                New Dawn
              </div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={i} data-testid={`wnd-comparison-row-${i}`} className="grid grid-cols-2 border-b last:border-b-0 text-sm">
                <div className="p-4 text-muted-foreground">{row.traditional}</div>
                <div className="border-l p-4 text-foreground">{row.newdawn}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — Engineered for E-2 compliance ── */}
      <section id="e2-compliance" data-testid="section-wnd-compliance" className="scroll-mt-24 border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Engineered for E-2 compliance</SectionEyebrow>
            <h2 data-testid="wnd-compliance-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Compliance as the blueprint — not an afterthought
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The E-2 visa rests on a few core principles. We built the platform so each one is addressed by design.
              New Dawn does not provide legal or immigration advice; this describes how the model is structured. Your
              immigration attorney determines what your specific petition requires.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {E2_PRINCIPLES.map((p) => (
              <Card key={p.id} data-testid={`card-wnd-e2-${p.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                    <p.icon className="size-5 text-[hsl(var(--primary))]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{p.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* "Short version" pull-quote */}
          <div
            data-testid="wnd-compliance-pullquote"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">The short version:</span> Own and direct, non-marginal,
              substantial and at-risk, renewal-ready. We didn't bolt compliance on at the end — it's the blueprint.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — Live and work anywhere ── */}
      <section id="live-anywhere" data-testid="section-wnd-anywhere" className="scroll-mt-24 border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Live anywhere in the USA</SectionEyebrow>
            <h2 data-testid="wnd-anywhere-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Direct a business you can run from anywhere
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A traditional E-2 business usually chains you to its address. New Dawn is different: trained local teams
              handle on-the-ground execution, and you direct the business through executive oversight rather than
              physical presence. We're headquartered in El Paso, Texas, but qualified E-2 owners can live anywhere in
              the United States while maintaining ownership control and executive supervision.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
            {ANYWHERE.map((a) => (
              <Card key={a.id} data-testid={`card-wnd-anywhere-${a.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <a.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{a.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.desc}</div>
              </Card>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
            This is the difference between <span className="font-medium text-foreground">buying a job in a fixed
            location</span> and <span className="font-medium text-foreground">directing a business you can run from
            anywhere in the country.</span>
          </p>
        </div>
      </section>

      {/* ── SECTION 4 — Human-run operations, AI-powered growth ── */}
      <section id="human-ai" data-testid="section-wnd-human-ai" className="scroll-mt-24 border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Human operations, AI-powered growth</SectionEyebrow>
            <h2 data-testid="wnd-human-ai-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Humans run the business. AI helps you grow and direct it.
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              There's a lot of noise about AI &ldquo;running&rdquo; businesses. We're deliberately clear about where AI
              belongs in ours — and where it doesn't. Day-to-day operations are 100% human; AI powers the layer around
              operations that helps you grow and prove you're directing the business.
            </p>
          </div>

          {/* Two-column "Humans do / AI does" */}
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card data-testid="card-wnd-humans-do" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <Users className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="text-lg font-semibold">Humans do</div>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-foreground/50">
                Day-to-day operations — 100% human
              </p>
              <ul className="mt-3 space-y-2.5">
                {HUMANS_DO.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card data-testid="card-wnd-ai-does" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <Bot className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="text-lg font-semibold">AI does</div>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-foreground/50">
                Growth, oversight &amp; documentation — never daily operations
              </p>
              <ul className="mt-3 space-y-2.5">
                {AI_DOES.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border bg-white/60 p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why the combination matters:</span> Human operations give
              you the credibility, service quality, and real jobs that make the business genuine. AI gives you the
              scale, insight, and documentation that make it easy to grow and to demonstrate your active direction.
              Most models pick one or the other — we deliberately separated them so each does what it's best at.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — Backed by an experienced, in-house team ── */}
      <section data-testid="section-wnd-team" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Backed by an experienced, in-house team</SectionEyebrow>
            <h2 data-testid="wnd-team-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Not a listing service — a team that stays
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              New Dawn isn't a listing service that hands you a business and disappears. Our team and partners bring
              decades of combined experience across E-2 visa processing, private equity, franchise operations,
              technology product development, corporate law, finance, and real estate — the disciplines that actually
              matter to an E-2 owner. That experience is grounded in risk management, fiduciary responsibility, and
              long-term operational excellence, and it's why serious advisors are comfortable introducing New Dawn to
              their clients.
            </p>
            {/* TODO(client): name key team members / credentials here if you want to
                surface them, consistent with the team/leadership page. (Placeholder #1) */}
            <div className="mt-6">
              <Button data-testid="button-wnd-team" variant="secondary" className="gap-2" asChild>
                <Link href="/team">
                  Meet the team
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ShieldCheck, label: "E-2 visa processing" },
              { icon: LineChart, label: "Private equity & finance" },
              { icon: Handshake, label: "Franchise operations" },
              { icon: Bot, label: "Technology & product" },
              { icon: FileText, label: "Corporate law" },
              { icon: Building2, label: "Real estate" },
            ].map((d, i) => (
              <Card key={i} data-testid={`card-wnd-discipline-${i}`} className="nh-surface nh-noise border-card-border/80 flex items-center gap-3 p-4">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-white/70 shadow-sm backdrop-blur">
                  <d.icon className="size-4 text-[hsl(var(--primary))]" />
                </div>
                <span className="text-sm font-medium">{d.label}</span>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — Backed by the Group of Companies ── */}
      <section data-testid="section-wnd-path" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl">
            <Card data-testid="card-wnd-backing" className="nh-surface nh-noise border-card-border/80 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <ShieldCheck className="size-6 text-[hsl(var(--primary))]" />
                </div>
                <div className="min-w-0">
                  <SectionEyebrow>Owner control, fully backed</SectionEyebrow>
                  <div className="mt-2 text-xl font-semibold">You stay in control — backed by the Group of Companies</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    You hold ownership control, bank-account authority, and final say over major decisions, hiring, and
                    strategy from day one. Behind that control stands the New Dawn Franchising Group of Companies&trade; —
                    in-house E-2 immigration, finance, legal, real estate, and operations teams who support the business
                    you direct, so you are never left to figure it out alone.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — FAQ ── */}
      <section data-testid="section-wnd-faq" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Frequently asked questions</SectionEyebrow>
            <h2 data-testid="wnd-faq-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The New Dawn difference, answered
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} data-testid={`wnd-faq-item-${i}`}>
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

      {/* ── SECTION 8 — CTA / contact ── */}
      <section data-testid="section-wnd-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="wnd-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              A Platform Built Around Your E-2 Goals
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Request the FDD and schedule an intro call to see how the New Dawn model fits your family's plans.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-wnd-cta-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-wnd-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-wnd-address"
                href={COMPANY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {COMPANY.addressFull}
              </a>
              <a
                data-testid="link-wnd-phone"
                href={`tel:${COMPANY.phoneTel}`}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0" />
                {COMPANY.phone}
              </a>
              <a
                data-testid="link-wnd-email"
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
      <section data-testid="section-wnd-disclaimer" className="border-t bg-white/50">
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

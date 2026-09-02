import { useEffect } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  Globe2,
  HelpCircle,
  Landmark,
  MapPin,
  Phone,
  Repeat,
  ShieldCheck,
  Users,
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

// ─── SEO / metadata (mirrors property-management.tsx; no per-page meta framework
// exists, so we set it imperatively and clean up on unmount). ──────────────────
const SEO = {
  title:
    "The E-2 Visa Process, Explained | Treaty Countries, Investment & Timeline | New Dawn Franchising",
  description:
    "An in-depth walkthrough of the E-2 treaty investor visa process: treaty countries, the substantial at-risk investment, the own-and-direct requirement, marginality, typical timeline, and how a New Dawn franchise (from $225,000) provides a real operating business to own and direct.",
  canonical: "https://www.newdawnfranchising.com/e-2-visa-process",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

// ─── Treaty country examples (illustrative only — list changes over time) ──────
const TREATY_EXAMPLES = [
  "Mexico",
  "Canada",
  "Germany",
  "Japan",
  "South Korea",
  "Spain",
  "Italy",
  "Turkey",
  "Israel",
  "Argentina",
  "Colombia",
  "United Kingdom",
  "France",
];

// ─── Timeline steps ───────────────────────────────────────────────────────────
const TIMELINE = [
  {
    title: "Discovery & vertical selection",
    desc: "We compare Property Management, Telecom, and Insurance against your goals, market, and E-2 strategy, and confirm your treaty-country eligibility path with your attorney.",
  },
  {
    title: "Franchise agreement & investment",
    desc: "You sign your franchise agreement and place your structured investment from $225,000, irrevocably committing capital to a real operating business.",
  },
  {
    title: "Business plan",
    desc: "Your immigration attorney, supported by the operating model and financials, prepares the E-2 business plan that documents jobs, projections, and your directing role.",
  },
  {
    title: "File the E-2 petition",
    desc: "Your attorney files the E-2 application — either a consular DS-160 package abroad or, where applicable, a change of status with USCIS.",
  },
  {
    title: "Consular interview / adjudication",
    desc: "A U.S. consular officer (or USCIS) reviews the petition and conducts the interview. Approval is decided solely by the U.S. government — it is never guaranteed.",
  },
  {
    title: "Launch & renew",
    desc: "Once admitted, you direct the business — managing the bank account, making the payments, and making the key decisions — while New Dawn implements the day-to-day operations under your direction. The E-2 is renewable in two- to five-year increments as long as the enterprise continues to qualify.",
  },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "Which countries are eligible for the E-2 visa?",
    a: "The E-2 is available to nationals of countries that maintain a qualifying treaty of commerce and navigation with the United States — more than 80 countries. Examples include Mexico, Canada, Germany, Japan, South Korea, Spain, Italy, Turkey, Israel, Argentina, Colombia, the United Kingdom, and France. The official list changes over time, so confirm your eligibility with a licensed immigration attorney.",
  },
  {
    q: "How long does an E-2 visa last?",
    a: "The E-2 is a nonimmigrant status that can be renewed indefinitely as long as the business continues to qualify. Visas are typically issued in two- to five-year increments depending on your country of nationality and the reciprocity schedule.",
  },
  {
    q: "Can my spouse and children come with me?",
    a: "Yes. Your spouse and unmarried children under 21 can generally accompany you as dependents. Spouses of E-2 investors are typically eligible for work authorization in the United States; children under 21 are dependents and may attend school.",
  },
  {
    q: "How much do I need to invest?",
    a: "The E-2 has no fixed legal minimum. The investment must be substantial relative to the total cost of the business and must be irrevocably committed and at commercial risk. New Dawn's franchise investment starts at $225,000 and is structured to fund a real, operating enterprise.",
  },
  {
    q: "Does buying a franchise guarantee the E-2 visa?",
    a: "No. Purchasing a franchise never guarantees a visa. Eligibility and approval are determined solely by U.S. Department of State consular officers and USCIS based on each individual petition. A New Dawn franchise is structured to support a strong, credible case — never to guarantee an outcome.",
  },
  {
    q: "Can the E-2 lead to a green card?",
    a: "The E-2 itself is a nonimmigrant visa and does not directly grant permanent residence. Some investors later pursue a separate pathway such as the EB-5 immigrant investor program, but that is a distinct process with its own requirements and is not guaranteed. Discuss any long-term immigration strategy with your own licensed attorney.",
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

function useE2VisaProcessSeo() {
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

export default function E2VisaProcessPage() {
  useE2VisaProcessSeo();

  return (
    <div data-testid="page-e2-visa-process" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-e2-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Globe2 className="size-3.5 text-[hsl(var(--accent))]" />
              For treaty investors exploring the United States
            </div>
            <h1
              data-testid="e2-hero-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              The E-2 Treaty Investor Visa Process, Step by Step
            </h1>
            <p
              data-testid="e2-hero-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              A clear, in-depth walkthrough of how the E-2 visa works — treaty countries, the substantial
              at-risk investment, the own-and-direct requirement, marginality, and a typical timeline — and how a
              New Dawn franchise (from $225,000) gives you a real, operating U.S. business to own and direct.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-e2-hero-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-e2-hero-call" variant="secondary" className="gap-2" asChild>
                <Link href="/contact">
                  Schedule an Intro Call
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — What is the E-2 visa ── */}
      <section data-testid="section-e2-what" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>The basics</SectionEyebrow>
            <h2 data-testid="e2-what-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              What is the E-2 visa?
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The E-2 is a nonimmigrant treaty investor visa that lets a national of a treaty country come to the
              United States to develop and direct a business in which they have invested a substantial amount of
              capital. It is renewable as long as the business continues to qualify. Spouses are typically eligible
              for work authorization, and unmarried children under 21 can accompany the investor as dependents.
            </p>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              New Dawn Franchising is a registered franchisor offering three recurring-revenue verticals —{" "}
              <Link href="/property-management" className="underline underline-offset-2 hover:text-foreground">
                Property Management
              </Link>
              ,{" "}
              <Link href="/telecom" className="underline underline-offset-2 hover:text-foreground">
                Telecom
              </Link>
              , and{" "}
              <Link href="/insurance" className="underline underline-offset-2 hover:text-foreground">
                Insurance
              </Link>{" "}
              — each designed to be a genuine operating business an investor can own and direct.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — Treaty countries ── */}
      <section data-testid="section-e2-treaty" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Who qualifies by nationality</SectionEyebrow>
            <h2 data-testid="e2-treaty-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Treaty countries
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The E-2 is open to nationals of more than 80 countries that maintain a qualifying treaty of commerce
              and navigation with the United States. Examples include the countries below — but the official list
              changes over time, so always confirm your eligibility with a licensed immigration attorney.
            </p>
          </div>

          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
            {TREATY_EXAMPLES.map((c) => (
              <span
                key={c}
                data-testid={`chip-e2-treaty-${c.toLowerCase().replace(/\s+/g, "-")}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-3 py-1.5 text-sm font-medium text-foreground/80 shadow-sm"
              >
                <Globe2 className="size-3.5 text-[hsl(var(--accent))]" />
                {c}
              </span>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
            Examples include — and are not limited to — the nations above. Inclusion here is illustrative and does
            not confirm current eligibility for any individual; treaty status and reciprocity terms change.
          </p>
        </div>
      </section>

      {/* ── SECTION 4 — Substantial & at-risk investment ── */}
      <section data-testid="section-e2-investment" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Requirement #1</SectionEyebrow>
            <h2 data-testid="e2-investment-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The substantial &amp; at-risk investment requirement
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The E-2 requires a substantial investment. There is no fixed legal minimum — instead, &ldquo;substantial&rdquo;
              is judged proportionally to the total cost of establishing or purchasing the business. The capital must
              also be irrevocably committed and genuinely at commercial risk; it cannot be passive or fully refundable.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            <Card data-testid="card-e2-investment-amount" className="nh-surface nh-noise border-card-border/80 p-6 text-center">
              <Banknote className="mx-auto size-6 text-[hsl(var(--accent))]" />
              <div className="mt-3 text-3xl font-semibold text-[hsl(var(--primary))]">$225,000</div>
              <div className="mt-1 text-sm text-muted-foreground">Franchise investment from</div>
            </Card>
            <Card data-testid="card-e2-investment-explain" className="nh-surface nh-noise border-card-border/80 p-6 md:col-span-2">
              <div className="text-base font-semibold">A real business, not a deposit</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A New Dawn franchise investment from $225,000 funds a genuine operating enterprise — license, training,
                technology, and operational setup — so the capital is committed to building and running a real business
                rather than sitting idle. Full details, including any financing options, are provided in the{" "}
                <Link href="/request-fdd" className="underline underline-offset-2 hover:text-foreground">
                  Franchise Disclosure Document
                </Link>
                .
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — Own and direct ── */}
      <section data-testid="section-e2-own-direct" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Requirement #2</SectionEyebrow>
            <h2 data-testid="e2-own-direct-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The &ldquo;own and direct&rdquo; requirement
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              An E-2 investor must own at least 50% of the enterprise and must develop and direct it. This is a real,
              substantive role — not a passive investment. You hold ownership and control, make the key decisions, and
              are responsible for the direction of the business.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            <Card data-testid="card-e2-direct-you" className="nh-surface nh-noise border-card-border/80 p-6">
              <BadgeCheck className="size-6 text-[hsl(var(--primary))]" />
              <div className="mt-3 text-base font-semibold">What you direct</div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" /> Majority ownership and control of the company</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" /> Control of the business bank accounts and finances</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" /> Key decisions, budgets, and strategic direction</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" /> Hiring, supervision, and review of performance reporting</li>
              </ul>
            </Card>
            <Card data-testid="card-e2-direct-teams" className="nh-surface nh-noise border-card-border/80 p-6">
              <Users className="size-6 text-[hsl(var(--primary))]" />
              <div className="mt-3 text-base font-semibold">What New Dawn implements</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                New Dawn implements the day-to-day operations under your direction while you keep substantive
                control. You are not a passive owner — you actively direct the enterprise, manage the bank account, make
                the payments, oversee the people doing the daily work, and review the numbers. That directing role is exactly what the E-2 &ldquo;develop and direct&rdquo;
                standard is built around, and it produces an auditable record that supports renewals.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — Marginality ── */}
      <section data-testid="section-e2-marginality" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Requirement #3</SectionEyebrow>
            <h2 data-testid="e2-marginality-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The &ldquo;more than marginal&rdquo; requirement
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              An E-2 business must do more than earn a minimal living for the investor and their family. It should have
              the present or future capacity to generate more than that — typically by creating jobs and contributing to
              the U.S. economy. Recurring-revenue verticals that employ U.S. workers directly address this standard.
            </p>
          </div>

          <div
            data-testid="e2-marginality-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 p-5"
          >
            <Repeat className="mt-0.5 size-5 shrink-0 text-[hsl(var(--accent))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why New Dawn fits:</span> Each vertical builds recurring
              revenue and is staffed to operate as a real business that employs people in the United States. That
              combination — compounding income plus U.S. job creation — is what addresses the marginality test.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — Typical timeline ── */}
      <section data-testid="section-e2-timeline" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>From discovery to admission</SectionEyebrow>
            <h2 data-testid="e2-timeline-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              A typical E-2 timeline
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Every case is different, but the path generally moves through the steps below. From start to consular
              approval, the process commonly takes roughly four to eight months, varying by country and consulate. Once
              approved, the E-2 is renewable in two- to five-year increments.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
            {TIMELINE.map((s, i) => (
              <Card key={i} data-testid={`card-e2-timeline-${i + 1}`} className="nh-surface nh-noise border-card-border/80 p-6">
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

          <div
            data-testid="e2-timeline-note"
            className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border bg-white/60 p-5 shadow-sm"
          >
            <Clock className="mt-0.5 size-5 shrink-0 text-[hsl(var(--primary))]" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Timelines are estimates only. Actual processing depends on your nationality, the specific consulate or
              USCIS workload, and the completeness of your petition. Your attorney sets realistic expectations for your
              situation.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 8 — Role of partner immigration attorneys ── */}
      <section data-testid="section-e2-attorneys" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Who does what</SectionEyebrow>
            <h2 data-testid="e2-attorneys-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The role of partner immigration attorneys
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              New Dawn works with partner and independent immigration attorneys who prepare and file the E-2 petition.
              New Dawn is a franchisor, not a law firm, and does not provide legal or immigration advice. Investors
              retain their own licensed counsel, who is responsible for the petition and for advising on eligibility.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            <Card data-testid="card-e2-attorney-newdawn" className="nh-surface nh-noise border-card-border/80 p-6">
              <Briefcase className="size-6 text-[hsl(var(--accent))]" />
              <div className="mt-3 text-base font-semibold">New Dawn provides the business</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A real, operating franchise to own and direct, the operating model, technology, and the financials and
                documentation your attorney needs to build a credible business plan.
              </p>
            </Card>
            <Card data-testid="card-e2-attorney-counsel" className="nh-surface nh-noise border-card-border/80 p-6">
              <Gavel className="size-6 text-[hsl(var(--accent))]" />
              <div className="mt-3 text-base font-semibold">Your attorney provides the law</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Independent legal advice, eligibility assessment, petition preparation, and filing. The attorney-client
                relationship is between you and your counsel — not New Dawn.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION 9 — FAQ ── */}
      <section data-testid="section-e2-faq" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Frequently asked questions</SectionEyebrow>
            <h2 data-testid="e2-faq-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              The E-2 process, answered
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} data-testid={`e2-faq-item-${i}`}>
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
      <section data-testid="section-e2-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Landmark className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="e2-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Own and Direct a Real U.S. Business Built for the E-2 Visa
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Request the FDD and schedule an intro call to see how a New Dawn franchise — across{" "}
              <Link href="/property-management" className="underline underline-offset-2 hover:text-foreground">
                Property Management
              </Link>
              ,{" "}
              <Link href="/telecom" className="underline underline-offset-2 hover:text-foreground">
                Telecom
              </Link>
              , or{" "}
              <Link href="/insurance" className="underline underline-offset-2 hover:text-foreground">
                Insurance
              </Link>{" "}
              — fits your E-2 strategy.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-e2-cta-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-e2-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-e2-address"
                href={COMPANY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {COMPANY.addressFull}
              </a>
              <a
                data-testid="link-e2-phone"
                href={`tel:${COMPANY.phoneTel}`}
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0" />
                {COMPANY.phone}
              </a>
              <a
                data-testid="link-e2-email"
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
      <section data-testid="section-e2-disclaimer" className="border-t bg-white/50">
        <div className="nh-container py-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Important disclaimer
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/65">
              This page is for informational purposes only and is not an offer to sell or the solicitation of an offer
              to buy a franchise. Franchises are offered solely through a Franchise Disclosure Document in compliance
              with the FTC Franchise Rule and applicable state law, and only in states where New Dawn Franchising is
              registered, exempt, or otherwise authorized. New Dawn Franchising is a franchisor, not a law firm, does not
              provide legal or immigration advice, and does not guarantee any E-2 visa approval or any financial result.
              E-2 eligibility and approval are determined solely by U.S. Department of State consular officers and USCIS.
              Treaty country lists and immigration law change over time. Prospective investors should retain their own
              licensed U.S. immigration attorney and independent legal, immigration, and financial advisors.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

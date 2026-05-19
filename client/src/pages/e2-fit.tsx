import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Clock, FileText, Landmark, Plane, RefreshCw, Search, ShieldCheck, Star, TrendingUp, UserCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const TIMELINE_STEPS = [
  {
    id: "discovery",
    phase: "Phase 1",
    title: "Discovery & consultation",
    duration: "1–2 weeks",
    icon: Search,
    details: [
      "Schedule a call with our team to discuss the franchise opportunity",
      "Review the Franchise Disclosure Document (FDD) including Item 19 financial projections",
      "Evaluate territories and ask questions about the operating model",
      "Determine if the franchise is the right fit for your goals",
    ],
  },
  {
    id: "agreement",
    phase: "Phase 2",
    title: "Franchise agreement & investment",
    duration: "2–4 weeks",
    icon: FileText,
    details: [
      "Sign the franchise agreement and complete your investment",
      "Business entity formation and bank account setup",
      "Engage Joorney or your chosen immigration firm for business plan preparation",
      "Onboarding begins: territory assignment and manager selection",
    ],
  },
  {
    id: "bizplan",
    phase: "Phase 3",
    title: "Business plan & visa preparation",
    duration: "4–6 weeks",
    icon: Landmark,
    details: [
      "Comprehensive E-2 business plan developed with your immigration attorney",
      "Gather supporting documents: financials, credentials, investment proof",
      "Franchise operations manual and training materials provided",
      "Attorney assembles and reviews the complete visa petition package",
    ],
  },
  {
    id: "filing",
    phase: "Phase 4",
    title: "E-2 visa filing & processing",
    duration: "2–4 months",
    icon: Clock,
    details: [
      "Visa petition filed at the U.S. consulate or via change of status (if in the U.S.)",
      "Consular interview scheduled (if filing from abroad)",
      "Processing time varies by consulate — typically 2 to 4 months",
      "Premium processing may be available for change-of-status applicants",
    ],
  },
  {
    id: "approval",
    phase: "Phase 5",
    title: "Visa approval & launch",
    duration: "Immediate",
    icon: UserCheck,
    details: [
      "E-2 visa approved — you're authorized to enter or remain in the U.S.",
      "Your territory-approved manager begins or continues day-to-day operations",
      "90-day contract replacement guarantee kicks in to protect your portfolio",
      "Live anywhere in the USA while your franchise operates in El Paso, Texas",
    ],
  },
];

function Heading({ title, subtitle, testId }: { title: string; subtitle: string; testId: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 data-testid={`${testId}-title`} className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h1>
      <p
        data-testid={`${testId}-subtitle`}
        className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
      >
        {subtitle}
      </p>
    </div>
  );
}

const VISA_TYPES = [
  {
    visa: "E-2 Treaty Investor",
    investment: "$100K–$300K+",
    processing: "2–4 months",
    duration: "2–5 years (renewable)",
    pathToGreen: "No direct path",
    spouseWork: "Yes",
    ownerControl: "Full control",
    highlight: true,
    id: "e2",
  },
  {
    visa: "EB-5 Immigrant Investor",
    investment: "$800K–$1.05M",
    processing: "18–36+ months",
    duration: "Permanent (green card)",
    pathToGreen: "Direct path",
    spouseWork: "Yes",
    ownerControl: "Varies (often passive)",
    highlight: false,
    id: "eb5",
  },
  {
    visa: "L-1 Intracompany Transfer",
    investment: "Existing company required",
    processing: "2–6 months",
    duration: "1–7 years",
    pathToGreen: "Possible via EB-1C",
    spouseWork: "Yes (L-2 EAD)",
    ownerControl: "Must have prior company",
    highlight: false,
    id: "l1",
  },
  {
    visa: "H-1B Specialty Occupation",
    investment: "None (employer-sponsored)",
    processing: "3–6 months + lottery",
    duration: "3 years (max 6)",
    pathToGreen: "Possible via employer",
    spouseWork: "Limited",
    ownerControl: "None (employee role)",
    highlight: false,
    id: "h1b",
  },
  {
    visa: "O-1 Extraordinary Ability",
    investment: "None",
    processing: "1–3 months",
    duration: "3 years (renewable)",
    pathToGreen: "Possible via EB-1A",
    spouseWork: "No",
    ownerControl: "Self-petitioned possible",
    highlight: false,
    id: "o1",
  },
  {
    visa: "E-1 Treaty Trader",
    investment: "Active trade required",
    processing: "2–4 months",
    duration: "2–5 years (renewable)",
    pathToGreen: "No direct path",
    spouseWork: "Yes",
    ownerControl: "Full control",
    highlight: false,
    id: "e1",
  },
];

const WHY_E2 = [
  {
    title: "Lower capital threshold than EB-5",
    desc: "E-2 investments typically start around $100K–$300K, compared to $800K–$1M+ required for EB-5. This makes business ownership accessible without tying up the majority of your wealth.",
    id: "capital",
  },
  {
    title: "You own and control the business",
    desc: "Unlike H-1B or L-1 visas where you work for someone else, the E-2 lets you be the business owner. You direct operations, manage finances, and make strategic decisions.",
    id: "control",
  },
  {
    title: "Fast processing, no lottery",
    desc: "E-2 applications are typically processed in 2–4 months with no annual cap or lottery system — unlike the H-1B, which has a random selection process and limited spots.",
    id: "speed",
  },
  {
    title: "Indefinitely renewable",
    desc: "As long as your business is active and meets E-2 requirements, the visa can be renewed indefinitely in 2–5 year increments, giving you long-term stability without a fixed end date.",
    id: "renewable",
  },
  {
    title: "Your spouse can work in the U.S.",
    desc: "E-2 dependent spouses receive automatic work authorization, allowing your family to build careers and income in the U.S. from day one — a benefit not available with many other visa types.",
    id: "spouse",
  },
];

function TimelineSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section data-testid="section-timeline" className="border-b bg-white/50 py-8 md:py-20">
      <div className="nh-container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Your journey</div>
          <h2 data-testid="timeline-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
            E-2 visa application timeline
          </h2>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
            From your first call to visa approval — here's what to expect at each stage. Click any step to see the details.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl">
          <div className="hidden md:flex items-center justify-between mb-8">
            {TIMELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === activeStep;
              const isCompleted = i < activeStep;
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    data-testid={`button-timeline-${step.id}`}
                    onClick={() => setActiveStep(i)}
                    className={
                      "relative flex flex-col items-center gap-2 group cursor-pointer transition-all duration-200 " +
                      (isActive ? "scale-105" : "hover:scale-105")
                    }
                  >
                    <div
                      className={
                        "grid size-12 place-items-center rounded-full border-2 transition-all duration-300 " +
                        (isActive
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary))]/20"
                          : isCompleted
                            ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                            : "border-border bg-white text-muted-foreground group-hover:border-[hsl(var(--primary))]/50")
                      }
                    >
                      <Icon className="size-5" />
                    </div>
                    <span
                      className={
                        "text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap " +
                        (isActive ? "text-[hsl(var(--primary))]" : "text-muted-foreground")
                      }
                    >
                      {step.phase}
                    </span>
                  </button>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div className="flex-1 mx-2 mt-[-20px]">
                      <div
                        className={
                          "h-0.5 w-full rounded-full transition-colors duration-300 " +
                          (i < activeStep ? "bg-[hsl(var(--accent))]" : "bg-border")
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="md:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
            {TIMELINE_STEPS.map((step, i) => {
              const isActive = i === activeStep;
              return (
                <button
                  key={step.id}
                  data-testid={`button-timeline-mobile-${step.id}`}
                  onClick={() => setActiveStep(i)}
                  className={
                    "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all " +
                    (isActive
                      ? "bg-[hsl(var(--primary))] text-white shadow-md"
                      : "border bg-white text-muted-foreground hover:border-[hsl(var(--primary))]/50")
                  }
                >
                  {step.phase}
                </button>
              );
            })}
          </div>

          <Card
            data-testid={`card-timeline-detail-${TIMELINE_STEPS[activeStep].id}`}
            className="nh-surface nh-noise border-card-border/80 p-6 md:p-8 transition-all duration-300"
          >
            <div className="flex items-start gap-4">
              <div className="hidden md:grid size-12 shrink-0 place-items-center rounded-2xl border bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                {(() => { const Icon = TIMELINE_STEPS[activeStep].icon; return <Icon className="size-5" />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-semibold">{TIMELINE_STEPS[activeStep].title}</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-[hsl(var(--accent))]/10 px-3 py-1 text-xs font-semibold text-[hsl(var(--accent))]">
                    <Clock className="size-3" />
                    {TIMELINE_STEPS[activeStep].duration}
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {TIMELINE_STEPS[activeStep].details.map((detail, j) => (
                    <div
                      key={j}
                      data-testid={`text-timeline-detail-${j}`}
                      className="flex items-start gap-3 rounded-xl border bg-white/60 px-4 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                      <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                data-testid="button-timeline-prev"
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous step
              </button>
              {activeStep < TIMELINE_STEPS.length - 1 ? (
                <button
                  data-testid="button-timeline-next"
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="flex items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))] hover:underline"
                >
                  Next step <ArrowRight className="size-3.5" />
                </button>
              ) : (
                <Link href="/contact">
                  <span className="flex items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))] hover:underline cursor-pointer">
                    Get started today <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              )}
            </div>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Estimated total timeline: 4–7 months from initial consultation to visa approval. Timelines vary based on consulate and individual circumstances. This is informational only — not legal or immigration advice.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function E2FitPage() {
  return (
    <div data-testid="page-e2-fit" className="min-h-screen">
      <section data-testid="section-e2-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <Heading
            testId="e2"
            title="Why E-2?"
            subtitle="The E-2 Treaty Investor visa is one of the most practical paths to business ownership in the U.S. Here's how it compares — and why it's a strong fit for franchise investors."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Card data-testid="card-e2-1" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 size-5 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-semibold">Owner control</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    You retain business oversight and financial control while operations are executed by an approved territory representative.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-e2-2" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Clear operating roles</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Structured responsibilities help reduce confusion: owners manage oversight; the territory rep manages execution.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-e2-3" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Portfolio operations</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The franchise centers on long-term rental management contracts for single-family homes in Texas.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section data-testid="section-visa-comparison" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Visa comparison</div>
            <h2 data-testid="visa-table-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How does the E-2 stack up?
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A side-by-side look at the most common U.S. investor and work visas. This is informational only — consult an immigration attorney for your specific situation.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-6xl overflow-x-auto">
            <table data-testid="table-visa-comparison" className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-semibold text-foreground/80">Visa type</th>
                  <th className="px-4 py-3 font-semibold text-foreground/80">Investment</th>
                  <th className="px-4 py-3 font-semibold text-foreground/80">Processing</th>
                  <th className="px-4 py-3 font-semibold text-foreground/80">Duration</th>
                  <th className="px-4 py-3 font-semibold text-foreground/80">Green card path</th>
                  <th className="px-4 py-3 font-semibold text-foreground/80">Spouse work</th>
                  <th className="px-4 py-3 font-semibold text-foreground/80">Owner control</th>
                </tr>
              </thead>
              <tbody>
                {VISA_TYPES.map((v) => (
                  <tr
                    key={v.id}
                    data-testid={`row-visa-${v.id}`}
                    className={
                      "border-b transition-colors " +
                      (v.highlight
                        ? "bg-[hsl(var(--accent))]/[0.07] font-medium"
                        : "hover:bg-black/[0.02]")
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {v.highlight && <Star className="size-4 text-[hsl(var(--accent))]" />}
                        {v.visa}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.investment}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.processing}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.duration}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.pathToGreen}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.spouseWork}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.ownerControl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section data-testid="section-why-e2" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">The E-2 advantage</div>
            <h2 data-testid="why-e2-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Five reasons the E-2 stands out
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl gap-4">
            {WHY_E2.map((item, i) => (
              <Card
                key={item.id}
                data-testid={`card-why-e2-${item.id}`}
                className="nh-surface nh-noise border-card-border/80 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full border bg-[hsl(var(--accent))]/10 text-sm font-bold text-[hsl(var(--accent))]">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-base font-semibold">{item.title}</div>
                    <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <TimelineSection />

      <section data-testid="section-e2-advantages" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">New Dawn advantages</div>
            <h2 data-testid="advantages-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              More reasons to move forward with confidence
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            <Card data-testid="card-adv-live" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <Plane className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Live anywhere in the USA</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your franchise operates in Texas, but you're free to live anywhere in the United States. No relocation to your territory is required — manage your business from coast to coast.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-adv-guarantee" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <RefreshCw className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">90-day contract replacement guarantee</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The highest risk of losing contracts is when you first acquire the franchise. We replace any lost contracts — for any reason — with new ones at no cost during the first 90 days. If your E-2 visa is declined, we replace your money.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-adv-eb5" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <TrendingUp className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">E-2 to EB-5 pathway</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your E-2 franchise can be a stepping stone to permanent residency. As your business grows and meets EB-5 thresholds, you can transition to a green card — often on an accelerated timeline compared to starting from scratch.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section data-testid="section-e2-checklist" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-e2-good" className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="text-sm font-semibold">This can be a fit if you…</div>
                <div className="mt-4 grid gap-3">
                  {[
                    { t: "Want operational control without daily work", id: "g1" },
                    { t: "Prefer a service business with clear systems", id: "g2" },
                    { t: "Value transparency, reporting, and oversight", id: "g3" },
                    { t: "Want a focused Texas market model", id: "g4" },
                  ].map((x) => (
                    <div
                      key={x.id}
                      data-testid={`row-e2-good-${x.id}`}
                      className="flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 text-[hsl(var(--accent))]" />
                      <div className="text-sm text-muted-foreground">{x.t}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card data-testid="card-e2-not" className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="text-sm font-semibold">This may not be a fit if you…</div>
                <div className="mt-4 grid gap-3">
                  {[
                    { t: "Want a passive investment with zero oversight", id: "n1" },
                    { t: "Prefer short-term rentals or multi-family only", id: "n2" },
                    { t: "Are looking for legal/visa representation", id: "n3" },
                    { t: "Want a purely remote, no-US presence model", id: "n4" },
                  ].map((x) => (
                    <div
                      key={x.id}
                      data-testid={`row-e2-not-${x.id}`}
                      className="flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3"
                    >
                      <Circle className="mt-0.5 size-4 text-muted-foreground/40" />
                      <div className="text-sm text-muted-foreground">{x.t}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="mt-8 text-center">
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Want to see the numbers? Request our FDD to review Item 19 — detailed financial projections showing expected revenue and expenses — and schedule a call with our team.
              </p>
              <Button data-testid="button-e2-cta" className="gap-2" asChild>
                <Link href="/contact">
                  Request our FDD today
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

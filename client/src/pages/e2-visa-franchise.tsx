import { ArrowRight, Building2, CheckCircle2, Cpu, Globe, Layers, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const VERTICALS = [
  {
    icon: Building2,
    title: "Property Management",
    desc: "Long-term rental management operations with local execution teams and owner-level reporting.",
    id: "property-management",
  },
  {
    icon: Cpu,
    title: "Telecom",
    desc: "Recurring-service telecom operations supported by centralized systems, sales workflows, and oversight dashboards.",
    id: "telecom",
  },
  {
    icon: ShieldCheck,
    title: "Insurance",
    desc: "Insurance-sector franchise operations designed around compliant supervision, client service, and recurring revenue.",
    id: "insurance",
  },
];

const E2_REQUIREMENTS = [
  {
    icon: Wallet,
    title: "A substantial investment",
    desc: "Franchise investment starts at $225,000 — a structured amount sized to meet the E-2 substantiality test.",
    id: "substantial",
  },
  {
    icon: ShieldCheck,
    title: "Capital genuinely at risk",
    desc: "Your investment funds a real, operating U.S. business, satisfying the E-2 “at-risk” requirement.",
    id: "at-risk",
  },
  {
    icon: UserCheck,
    title: "You direct and develop it",
    desc: "You own the franchise, control the bank accounts, and make the key decisions while approved teams execute day-to-day.",
    id: "direct",
  },
  {
    icon: Layers,
    title: "More than a marginal enterprise",
    desc: "All three verticals are recurring-revenue businesses built to generate real, ongoing activity — not passive holdings.",
    id: "marginal",
  },
  {
    icon: Globe,
    title: "Open to treaty nationals",
    desc: "The E-2 visa is available to nationals of 80+ treaty countries. We help you confirm your eligibility.",
    id: "treaty",
  },
];

const FAQ = [
  {
    q: "What does “a franchisor built for the E-2 visa” mean?",
    a: "Most franchises are general-purpose businesses that happen to qualify for the E-2 visa. New Dawn Franchising was designed from the ground up around the E-2 requirements — a substantial, at-risk investment in a real operating business that you own and direct, structured for owner oversight and clean documentation.",
    id: "what",
  },
  {
    q: "Which franchise verticals does New Dawn offer?",
    a: "Three recurring-revenue industries chosen for E-2 fit: Property Management, Telecom, and Insurance. You select the one that best matches your goals during the discovery process.",
    id: "verticals",
  },
  {
    q: "How much do I need to invest?",
    a: "Franchise investment starts at $225,000, structured to meet the E-2 substantial-investment requirement. Financing options are available.",
    id: "invest",
  },
  {
    q: "Do I have to run the business day-to-day?",
    a: "No. Each vertical is structured so you are the business director and decision-maker. You keep ownership control and bank-account oversight while approved local teams manage daily execution.",
    id: "hands-off",
  },
  {
    q: "Can I live anywhere in the U.S.?",
    a: "Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live anywhere in the United States while maintaining executive oversight of the franchise.",
    id: "live",
  },
];

export default function E2VisaFranchisePage() {
  return (
    <div data-testid="page-e2-visa-franchise" className="min-h-screen">
      <section data-testid="section-e2vf-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">E-2 Visa Franchise</div>
            <h1
              data-testid="e2vf-title"
              className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              The Franchisor Built for the E-2 Visa
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              New Dawn Franchising is a multi-vertical franchisor designed specifically for E-2 Treaty Investor Visa
              investors. You choose one of three recurring-revenue franchises — Property Management, Telecom, or
              Insurance — own and direct a real U.S. business, and our teams handle the daily execution.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button data-testid="button-e2vf-cta" className="gap-2" asChild>
                <Link href="/contact">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-e2vf-why" variant="outline" asChild>
                <Link href="/e2-fit">Why the E-2 visa?</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-e2vf-builtfor" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Built for E-2, not just E-2-eligible</div>
            <h2 className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Designed around the E-2 requirements
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Our legal structure, operating model, and proprietary technology all reflect what a credible E-2 petition
              needs — so you start from a strong foundation. (This is informational only, not legal or immigration advice.)
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {E2_REQUIREMENTS.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.id} data-testid={`card-e2req-${item.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-5 text-[hsl(var(--primary))]" />
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section data-testid="section-e2vf-verticals" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Three industries, one E-2 platform</div>
            <h2 className="mt-3 text-balance text-3xl font-semibold md:text-4xl">Choose your franchise vertical</h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              We selected three industries that lend themselves to recurring revenue, documented operating systems,
              supervisory control, staffing, and renewal-ready reporting — traits that support a credible E-2 business.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {VERTICALS.map((v) => {
              const Icon = v.icon;
              return (
                <Card key={v.id} data-testid={`card-vertical-${v.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                  <div className="grid size-10 place-items-center rounded-2xl border bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">
                    <Icon className="size-5" />
                  </div>
                  <div className="mt-3 text-base font-semibold">{v.title}</div>
                  <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.desc}</div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section data-testid="section-e2vf-faq" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">FAQ</div>
            <h2 className="mt-3 text-balance text-3xl font-semibold md:text-4xl">Common questions</h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl gap-4">
            {FAQ.map((item) => (
              <Card key={item.id} data-testid={`card-faq-${item.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                  <div>
                    <div className="text-base font-semibold">{item.q}</div>
                    <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-e2vf-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-3xl font-semibold md:text-4xl">Ready to explore the E-2 visa franchise?</h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Request the Franchise Disclosure Document and schedule an intro call. We'll help you compare the three
              verticals and find the strongest fit for your E-2 strategy.
            </p>
            <div className="mt-6">
              <Button data-testid="button-e2vf-cta-bottom" className="gap-2" asChild>
                <Link href="/contact">
                  Request the FDD today
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

import { ArrowRight, Banknote, BookOpen, Building, Building2, Cpu, Flag, Gavel, Handshake, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const COMPANY = {
  name: "New Dawn Franchising LLC",
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

function SectionTitle({ title, subtitle, testId }: { title: string; subtitle: string; testId: string }) {
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

function InfoCard({
  icon,
  title,
  desc,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId} className="nh-surface nh-noise border-card-border/80 p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-11 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</div>
        </div>
      </div>
    </Card>
  );
}

export default function AboutPage() {
  return (
    <div data-testid="page-about" className="min-h-screen">
      <section data-testid="section-about-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <SectionTitle
            testId="about"
            title="About New Dawn"
            subtitle="The first franchise designed specifically for the E-2 Visa investor — structured, compliant, and professionally operated so you can live and work freely anywhere in America."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <InfoCard
              testId="card-about-1"
              icon={<Flag className="size-5 text-[hsl(var(--accent))]" />}
              title="A new horizon in America"
              desc="Our brand is about forward motion — building an American future with structure, professionalism, and confidence."
            />
            <InfoCard
              testId="card-about-2"
              icon={<ShieldCheck className="size-5 text-[hsl(var(--primary))]" />}
              title="Trust-first operations"
              desc="This is a high-accountability service business. We aim to make expectations and roles clear from day one."
            />
            <InfoCard
              testId="card-about-3"
              icon={<Building2 className="size-5 text-[hsl(var(--primary))]" />}
              title="Texas focus"
              desc="We concentrate on single-family long-term rentals in Texas and the operational systems required to manage them well."
            />
          </div>
        </div>
      </section>

      <section data-testid="section-about-group" className="border-b bg-white/50 py-8 md:py-16">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Our organization</div>
            <h2 data-testid="about-group-title" className="mt-3 text-balance text-2xl font-semibold md:text-3xl">
              The <span translate="no">New Dawn Franchising Group of Companies&trade;</span>
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              <span translate="no">New Dawn Franchising</span> is not a standalone venture. It is part of the <span translate="no">New Dawn Franchising Group of Companies&trade;</span> — an established organization with large, experienced teams across real estate, financing, and law, each with over a decade of proven success. All supported by proprietary technology built in-house.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              testId="card-about-group-re"
              icon={<Building className="size-5 text-[hsl(var(--primary))]" />}
              title="Star Spangled Banner Realty"
              desc="An established brokerage with dozens of agents and over a decade of expertise across El Paso and beyond."
            />
            <InfoCard
              testId="card-about-group-fin"
              icon={<Banknote className="size-5 text-[hsl(var(--primary))]" />}
              title="Financing — 10+ years"
              desc="A large financing department helping investors and buyers navigate options, secure competitive terms, and close with confidence."
            />
            <InfoCard
              testId="card-about-group-law"
              icon={<Gavel className="size-5 text-[hsl(var(--primary))]" />}
              title="Legal — 10+ years"
              desc="Experienced legal professionals covering real estate law, franchise compliance, and business structuring."
            />
            <InfoCard
              testId="card-about-group-ai"
              icon={<Cpu className="size-5 text-[hsl(var(--primary))]" />}
              title="Proprietary AI technology"
              desc="AI agents power our marketing, operations, and franchise management — all built on proprietary software developed in-house."
            />
          </div>

          <div className="mx-auto mt-8 max-w-3xl text-center">
            <Button data-testid="button-about-team" className="gap-2" asChild>
              <Link href="/team">
                Meet the team & divisions
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section data-testid="section-business-plans" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Business plans</div>
            <h2 data-testid="bizplan-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              We help you get your business plan right
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              A strong business plan is essential for your E-2 visa application. We work closely with experienced immigration business plan writers to make sure yours is thorough, professional, and USCIS-ready.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            <Card data-testid="card-bizplan-joorney" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <Handshake className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Joorney Business Plans</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    We work closely with Joorney, one of the leading immigration business plan writing firms. They've helped thousands of E-2 investors with USCIS-ready plans across 180+ industries and 65+ countries.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-bizplan-network" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Trusted plan writers</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    In addition to Joorney, we partner with other experienced business plan writers who specialize in E-2 visa applications and franchise models. We'll connect you with the right fit for your situation.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-bizplan-support" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Guided through the process</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    You won't navigate this alone. Our team coordinates with your business plan writer, immigration attorney, and other professionals to ensure everything aligns for a strong application.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section data-testid="section-about-detail" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            <Card data-testid="card-about-oversight" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 size-5 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-semibold">Owner control</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Investors typically want direct control over their business and finances. Our model is built to support that,
                    while removing the need to personally manage day-to-day operations.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-about-next" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="text-sm font-semibold">Next steps</div>
              <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                If you'd like our overview deck and a quick call to see if the model fits your goals, reach out by email or use our contact form.
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button data-testid="button-about-contact" className="gap-2" asChild>
                  <Link href="/contact">
                    Request info
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button data-testid="button-about-email" variant="secondary" className="gap-2" asChild>
                  <a href={`mailto:${COMPANY.email}?subject=About%20New%20Dawn%20-%20Inquiry`}>
                    Email us
                  </a>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

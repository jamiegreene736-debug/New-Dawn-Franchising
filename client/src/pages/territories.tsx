import { Building2, MapPin, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

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

export default function TerritoriesPage() {
  return (
    <div data-testid="page-territories" className="min-h-screen">
      <section data-testid="section-territories-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <Heading
            testId="territories"
            title="El Paso, Texas"
            subtitle="Our franchise currently operates in El Paso, Texas with 300+ active management contracts in the network. A focused model for single-family long-term rental management, designed for repeatable operations and clear oversight."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Card data-testid="card-territories-1" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 text-[hsl(var(--accent))]" />
                <div>
                  <div className="text-sm font-semibold">Defined territories</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Territories help create focus, accountability, and operational consistency — ideal for a service business.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-territories-2" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-5 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-semibold">Single-family, long-term</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    A clear lane: single-family homes under long-term rental management contracts.
                  </div>
                </div>
              </div>
            </Card>

            <Card data-testid="card-territories-3" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-[hsl(var(--primary))]" />
                <div>
                  <div className="text-sm font-semibold">Repeatable ops</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The operating model is built around repeatable reporting, vendor workflows, and consistent tenant communication.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section data-testid="section-territories-note" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-4xl rounded-3xl border bg-white/60 p-8 shadow-sm">
            <div data-testid="text-territories-note-title" className="text-sm font-semibold">
              Availability & next steps
            </div>
            <div data-testid="text-territories-note-body" className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Our current operations are based in El Paso, Texas with 300+ contracts across the network. Email us with your timeline and we'll share the current overview and available territory details.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useEffect } from "react";
import { ArrowRight, Building2, Globe2, Home, MapPin, Phone, Repeat, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

const SEO = {
  title:
    "Where You Operate | Territories & Nationwide Verticals | New Dawn Franchising",
  description:
    "Each New Dawn vertical has its own footprint: Property Management runs in defined local territories (El Paso, TX), while Telecom and Insurance are recurring-revenue businesses that serve clients across the United States. Investment from $225,000.",
  canonical: "https://www.newdawnfranchising.com/territories",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

// ─── The three verticals and how their geography works ────────────────────────
const VERTICALS = [
  {
    id: "property-management",
    icon: Home,
    eyebrow: "Local territory model",
    title: "Property Management",
    scope: "El Paso, Texas — defined territories",
    desc: "Property management is an on-the-ground service business — you manage physical homes, coordinate local vendors, and serve property owners in a specific market. It runs in defined geographic territories, and our operations are established in El Paso, Texas with 300+ active management contracts in the network.",
    points: [
      "Tied to a metro: leasing, inspections, and maintenance happen on location.",
      "Defined territories create focus, accountability, and consistent operations.",
      "Established El Paso operation with 300+ contracts already under management.",
    ],
    href: "/property-management",
  },
  {
    id: "telecom",
    icon: Globe2,
    eyebrow: "Nationwide model",
    title: "Telecom (VoIP)",
    scope: "Serves customers across the United States",
    desc: "Telecom is a recurring-subscription business delivered over the internet and phone networks — it is not tied to a storefront or a single metro. Customers can be located anywhere in the U.S., so the market is national rather than a fixed territory. You direct the business; centralized systems and teams handle provisioning, billing, and support.",
    points: [
      "No geographic territory — subscribers can be anywhere in the country.",
      "Service is delivered remotely, so growth isn't capped by one city's size.",
      "Recurring monthly subscriptions build a nationwide book of revenue.",
    ],
    href: "/telecom",
  },
  {
    id: "insurance",
    icon: ShieldCheck,
    eyebrow: "Nationwide model",
    title: "Insurance",
    scope: "A book of business across the country",
    desc: "Insurance is a renewal-driven business built on a book of clients and recurring premiums. Like telecom, it isn't confined to a single metro — you build a nationwide book of business, subject to applicable state licensing. Licensed staff handle regulated activity under proper supervision while you direct the operation.",
    points: [
      "Not boxed into one market — clients are served across the country.",
      "Renewals recur year after year regardless of where clients live.",
      "Operates under applicable state licensing, handled within the model.",
    ],
    href: "/insurance",
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

function useTerritoriesSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO.title;

    const cleanups: Array<() => void> = [];
    cleanups.push(setMetaTag('meta[name="description"]', "name", "description", SEO.description));
    cleanups.push(setMetaTag('meta[property="og:title"]', "property", "og:title", SEO.title));
    cleanups.push(setMetaTag('meta[property="og:description"]', "property", "og:description", SEO.description));
    cleanups.push(setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", SEO.title));
    cleanups.push(setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", SEO.description));

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const prevCanonical = canonical?.getAttribute("href") ?? null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SEO.canonical);

    return () => {
      document.title = prevTitle;
      cleanups.forEach((fn) => fn());
      if (createdCanonical) canonical?.remove();
      else if (prevCanonical !== null) canonical?.setAttribute("href", prevCanonical);
    };
  }, []);
}

export default function TerritoriesPage() {
  useTerritoriesSeo();

  return (
    <div data-testid="page-territories" className="min-h-screen">
      {/* ── HERO ── */}
      <section data-testid="section-territories-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h1
              data-testid="territories-title"
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Where You Operate
            </h1>
            <p
              data-testid="territories-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              New Dawn is a multi-vertical platform, and each vertical has its own footprint. Property Management is a
              local, on-the-ground business that runs in defined territories — currently El Paso, Texas. Telecom and
              Insurance are recurring-revenue businesses that aren't tied to one city — they serve clients across the
              entire United States.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-territories-hero-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-territories-hero-call" variant="secondary" className="gap-2" asChild>
                <Link href="/contact">
                  Schedule an Intro Call
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Two geographic models, at a glance ── */}
      <section data-testid="section-territories-models" className="border-b bg-white/50 py-8 md:py-16">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Two geographic models</SectionEyebrow>
            <h2 data-testid="territories-models-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              One is local. Two are nationwide.
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The market for property management is a place — physical homes in a defined metro. The market for telecom
              and insurance is the whole country — recurring subscriptions and policies that don't depend on where an
              office sits. Knowing the difference helps you pick the vertical that fits how and where you want to build.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
            <Card data-testid="card-model-local" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <MapPin className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold">Local territory — Property Management</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Run in a defined geographic area where the homes physically are. Operations are established in El
                    Paso, Texas with 300+ active management contracts.
                  </p>
                </div>
              </div>
            </Card>
            <Card data-testid="card-model-national" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <Globe2 className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold">Nationwide — Telecom &amp; Insurance</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Recurring-revenue businesses delivered remotely. Customers and policyholders can be anywhere in the
                    U.S., so the market is the whole country — not a single metro.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Per-vertical detail ── */}
      <section data-testid="section-territories-verticals" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>By vertical</SectionEyebrow>
            <h2 data-testid="territories-verticals-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Where each business operates
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-3">
            {VERTICALS.map((v) => (
              <Card key={v.id} data-testid={`card-territory-${v.id}`} className="nh-surface nh-noise flex flex-col border-card-border/80 p-6">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <v.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4">
                  <SectionEyebrow>{v.eyebrow}</SectionEyebrow>
                  <div className="mt-1 text-lg font-semibold">{v.title}</div>
                  <div className="mt-1 text-sm font-medium text-[hsl(var(--accent))]">{v.scope}</div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
                <ul className="mt-4 space-y-2">
                  {v.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                      <Repeat className="mt-0.5 size-4 shrink-0 text-[hsl(var(--accent))]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-2">
                  <Button data-testid={`button-territory-${v.id}`} variant="secondary" size="sm" className="gap-2" asChild>
                    <Link href={v.href}>
                      Explore {v.title}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live and direct from anywhere (E-2) ── */}
      <section data-testid="section-territories-e2" className="border-b bg-white/50 py-8 md:py-16">
        <div className="nh-container">
          <div className="mx-auto max-w-4xl rounded-3xl border bg-white/60 p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Users className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold">Direct your business — and live where you choose</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Wherever your business operates, you direct it. New Dawn is headquartered in El Paso, Texas, and the
                  Property Management operation runs there, but qualified E-2 owners can live elsewhere in the United
                  States while maintaining ownership, financial control, and executive oversight. Telecom and Insurance
                  add nationwide reach on top of that flexibility. Learn how this fits the visa on our{" "}
                  <Link href="/e-2-visa-process" className="underline underline-offset-2 hover:text-foreground">
                    E-2 visa process
                  </Link>{" "}
                  page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA / contact ── */}
      <section data-testid="section-territories-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="territories-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Find the right vertical and footprint for you
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Tell us your goals and timeline and we'll walk you through whether a local Property Management territory or
              a nationwide Telecom or Insurance business is the better fit — then send the FDD.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-territories-cta-fdd" className="gap-2" asChild>
                <Link href="/request-fdd">
                  Request the FDD
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-territories-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
                </a>
              </Button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
              <a
                data-testid="link-territories-address"
                href={COMPANY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {COMPANY.addressFull}
              </a>
              <a
                data-testid="link-territories-email"
                href={`mailto:${COMPANY.email}`}
                className="transition-colors hover:text-foreground"
              >
                {COMPANY.email}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

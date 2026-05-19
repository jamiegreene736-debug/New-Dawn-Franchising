import {
  ArrowRight,
  Award,
  BadgeDollarSign,
  Building,
  GraduationCap,
  Handshake,
  Home,
  Key,
  Megaphone,
  Phone,
  Send,
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
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

const PATHS = [
  {
    icon: Key,
    title: "Become a Licensed Real Estate Agent",
    desc: "Join our brokerage and get your real estate license with our support. You will have access to experienced mentors, marketing tools, and a proven system to start earning commissions on home sales in the El Paso area and beyond.",
    highlight: true,
    id: "become-agent",
  },
  {
    icon: Send,
    title: "Refer Leads & Earn Commissions",
    desc: "Not interested in getting licensed? Simply refer buyers and sellers to our brokerage and earn a referral commission on every closed deal. Our marketing portal can help you find leads — you just send them our way.",
    highlight: false,
    id: "refer-leads",
  },
];

const BROKERAGE_BENEFITS = [
  {
    icon: Award,
    title: "Star Spangled Banner Realty",
    desc: "Our brokerage, Star Spangled Banner Realty, has over 10 years of experience in the Texas real estate market, with a proven track record of successful transactions.",
    id: "experience",
  },
  {
    icon: Users,
    title: "Dozens of Experienced Agents",
    desc: "Join a team of seasoned professionals who can mentor you, share strategies, and help you grow your real estate career from day one.",
    id: "agents",
  },
  {
    icon: GraduationCap,
    title: "Licensing Support",
    desc: "Want to become a licensed agent? We provide guidance and support through the licensing process so you can get started as quickly as possible.",
    id: "licensing",
  },
  {
    icon: Megaphone,
    title: "Marketing Portal Access",
    desc: "Use the same powerful marketing portal included with your franchise to generate real estate leads — buyers and sellers in El Paso and surrounding areas.",
    id: "marketing",
  },
  {
    icon: TrendingUp,
    title: "Additional Revenue Stream",
    desc: "Real estate sales create a second income stream alongside your property management franchise. Diversify your earnings and grow your business.",
    id: "revenue",
  },
  {
    icon: Handshake,
    title: "Referral Commissions",
    desc: "Even without a license, you earn a referral commission every time a lead you provide results in a closed transaction. No extra work required.",
    id: "referral-commission",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Choose your path",
    desc: "Decide if you want to become a licensed agent through our brokerage or simply refer leads for a commission.",
    id: "step-choose",
  },
  {
    step: "2",
    title: "Get set up",
    desc: "If you choose the agent path, we help you through the licensing process. If you choose referrals, you can start immediately.",
    id: "step-setup",
  },
  {
    step: "3",
    title: "Use the marketing portal",
    desc: "Generate leads for buyers and sellers in the El Paso area and surrounding markets using your franchise marketing portal.",
    id: "step-portal",
  },
  {
    step: "4",
    title: "Close deals or refer leads",
    desc: "As an agent, handle transactions and earn full commissions. As a referral partner, send leads to our brokerage and earn a referral fee on every closed deal.",
    id: "step-earn",
  },
];

export default function RealEstatePage() {
  return (
    <div data-testid="page-real-estate" className="min-h-screen">
      <section data-testid="section-re-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Building className="size-3.5 text-[hsl(var(--accent))]" />
              Additional revenue opportunity for franchise owners
            </div>
            <h1 data-testid="re-hero-title" className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Real Estate Sales
            </h1>
            <p data-testid="re-hero-subtitle" className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              As a <span translate="no">New Dawn</span> franchise owner, you can earn additional income through real estate sales with <span translate="no">Star Spangled Banner Realty</span> — the brokerage arm of the <span translate="no">New Dawn Franchising Group of Companies&trade;</span>. Become a licensed agent or simply refer buyer and seller leads and earn a commission on every closed deal.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-re-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Learn more
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-re-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Talk to our team
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-re-paths" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Two Paths</div>
            <h2 data-testid="re-paths-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Choose how you want to participate
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Whether you want to become a licensed agent or simply refer leads, there is a path that fits your goals.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
            {PATHS.map((path) => (
              <Card key={path.id} data-testid={`card-path-${path.id}`} className={`nh-surface nh-noise border-card-border/80 p-6 ${path.highlight ? "ring-2 ring-[hsl(var(--accent))]/30" : ""}`}>
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <path.icon className="size-6 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-lg font-semibold">{path.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{path.desc}</div>
                {path.highlight && (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--accent))]">
                    <GraduationCap className="size-3.5" />
                    We help you get licensed
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-re-brokerage" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Our Brokerage</div>
            <h2 data-testid="re-brokerage-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Join an established brokerage
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              <span translate="no">Star Spangled Banner Realty</span> brings over a decade of experience, dozens of experienced agents, and the proprietary tools you need to succeed in Texas real estate.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BROKERAGE_BENEFITS.map((b) => (
              <Card key={b.id} data-testid={`card-brokerage-${b.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <b.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{b.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-re-how" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Getting Started</div>
            <h2 data-testid="re-how-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              How it works
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <div className="space-y-0">
              {HOW_IT_WORKS.map((s, i, arr) => (
                <div key={s.id} data-testid={s.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-sm font-bold text-white">
                      {s.step}
                    </div>
                    {i < arr.length - 1 && <div className="w-px grow bg-border" />}
                  </div>
                  <div className={i === arr.length - 1 ? "pb-0" : "pb-8"}>
                    <div className="text-base font-semibold">{s.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-re-marketing" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                <Home className="size-6 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Your marketing portal works for real estate too</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The same franchise marketing portal that helps you find property management clients can also generate leads for people looking to buy or sell homes in El Paso and the surrounding areas. Use email drip campaigns, PPC ads, social media, and more to find motivated buyers and sellers — all from the same dashboard.
                </p>
                <Button data-testid="button-re-marketing" className="mt-4 gap-2" variant="secondary" asChild>
                  <Link href="/marketing">
                    Explore the marketing portal
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-re-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <BadgeDollarSign className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="re-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Ready to add real estate to your franchise?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Whether you want to become an agent or refer leads for a commission, our team will help you get started.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-re-cta-contact" className="gap-2" asChild>
                <Link href="/contact">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-re-cta-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Call {COMPANY.phone}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

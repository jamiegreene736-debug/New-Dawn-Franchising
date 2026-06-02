import {
  ArrowRight,
  BarChart3,
  Bot,
  Globe2,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Phone,
  Printer,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Target,
  Users,
  Zap,
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

const CHANNELS = [
  {
    icon: Search,
    title: "Homeowner Data Scraping",
    desc: "Source potential clients by scraping data for homeowners within your designated territory. Build targeted lead lists without lifting a finger.",
    id: "scraping",
  },
  {
    icon: Mail,
    title: "Automated Email Drip Campaigns",
    desc: "Launch cold email drip campaigns that nurture homeowner leads over time with automated follow-ups, all managed from your portal.",
    id: "email-drip",
  },
  {
    icon: MessageSquare,
    title: "SMS & Text Outreach",
    desc: "Reach homeowners directly via automated text campaigns. Personalized messaging at scale with full tracking and compliance built in.",
    id: "sms",
  },
  {
    icon: Share2,
    title: "Social Media AI Content",
    desc: "Our AI generates and posts engaging content on Facebook, X (Twitter), and YouTube — keeping your brand active and visible with minimal effort from you.",
    id: "social",
  },
  {
    icon: Printer,
    title: "Physical Mailers",
    desc: "Coordinate physical direct-mail campaigns targeting homeowners in your territory. The portal manages design, printing, and distribution.",
    id: "mailers",
  },
  {
    icon: MousePointerClick,
    title: "Pay-Per-Click Advertising",
    desc: "Run targeted PPC campaigns to reach both homeowners and real estate agents. Optimized bidding and targeting handled through the portal.",
    id: "ppc",
  },
];

const FEATURES = [
  {
    icon: Bot,
    title: "Intelligent Campaign Recommendations",
    desc: "The portal actively suggests new campaigns to launch and recommends optimizations to improve your existing campaigns based on real performance data.",
    id: "ai-recs",
  },
  {
    icon: BarChart3,
    title: "Full Analytics Dashboard",
    desc: "Track every lead, campaign, and conversion. See exactly what's working and where to invest more — all in one place.",
    id: "analytics",
  },
  {
    icon: Smartphone,
    title: "Apple App for On-the-Go",
    desc: "Review leads, respond to inquiries, and manage campaigns from anywhere with our dedicated Apple app.",
    id: "mobile-app",
  },
  {
    icon: Users,
    title: "Real Estate Agent Referral Program",
    desc: "Agents earn a referral fee for every homeowner they send your way. Everything is tracked and managed inside your portal automatically.",
    id: "agent-referral",
  },
  {
    icon: Zap,
    title: "AI + Human Touch",
    desc: "We don't just automate — we blend AI efficiency with experienced marketing professionals who ensure quality and strategy at every step.",
    id: "ai-human",
  },
  {
    icon: Megaphone,
    title: "24/7 Strategy Support",
    desc: "Our team is available around the clock to advise on campaign strategies, troubleshoot issues, and help you plan your next move.",
    id: "support-247",
  },
];

const REAL_ESTATE_FEATURES = [
  {
    icon: Search,
    title: "Find Buyers & Sellers",
    desc: "Use the same lead generation tools to find people looking to buy or sell homes in El Paso and surrounding areas.",
    id: "re-find",
  },
  {
    icon: Mail,
    title: "Real Estate Drip Campaigns",
    desc: "Launch automated email and text campaigns targeted at potential home buyers and sellers in your market.",
    id: "re-drip",
  },
  {
    icon: MousePointerClick,
    title: "PPC for Real Estate",
    desc: "Run pay-per-click campaigns targeting home buyers and sellers. The portal handles targeting and optimization.",
    id: "re-ppc",
  },
];

export default function MarketingPage() {
  return (
    <div data-testid="page-marketing" className="min-h-screen">
      <section data-testid="section-marketing-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-[hsl(var(--accent))]" />
              Included with your franchise — no additional cost
            </div>
            <h1 data-testid="marketing-hero-title" className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Your Marketing Engine
            </h1>
            <p data-testid="marketing-hero-subtitle" className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              A state-of-the-art marketing department at your fingertips, powered by proprietary technology built exclusively for New Dawn franchisees. Our systems automate campaigns, generate content, and optimize your outreach — with a human touch — so you can grow your property management portfolio without becoming a marketing expert.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-marketing-login" className="gap-2" asChild>
                <Link href="/login">
                  Access Marketing Academy
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-marketing-contact" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  <Phone className="size-4" />
                  Talk to our team
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-marketing-portal" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">The Portal</div>
            <h2 data-testid="marketing-portal-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              One portal. Every marketing channel.
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              Your proprietary franchise marketing academy is your command center for growing your business. Our technology works across every channel — from email campaigns to social media content — and is built exclusively for New Dawn franchisees. Access it through the login page or the Apple app — everything syncs in real time.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((ch) => (
              <Card key={ch.id} data-testid={`card-channel-${ch.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <ch.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{ch.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{ch.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-marketing-features" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Built for You</div>
            <h2 data-testid="marketing-features-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              More than software — a full marketing team
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The portal doesn't just give you tools — it gives you intelligence, strategy, and support around the clock.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.id} data-testid={`card-feature-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
                  <f.icon className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{f.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-marketing-how" className="border-b bg-white/50 py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">How It Works</div>
            <h2 data-testid="marketing-how-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              From portal to signed contract
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <div className="space-y-0">
              {[
                { step: "1", title: "Log in to your marketing academy", desc: "Access your dashboard through the website login or the Apple app.", id: "step-login" },
                { step: "2", title: "Choose your campaign", desc: "Pick from email drips, SMS, social media, mailers, PPC, or agent referrals — or let the AI recommend the best mix for your territory.", id: "step-choose" },
                { step: "3", title: "Launch & automate", desc: "Set your campaigns live. The AI handles scheduling, follow-ups, and content generation while you focus on your business.", id: "step-launch" },
                { step: "4", title: "Track & optimize", desc: "Monitor leads, conversions, and ROI in real time. The portal suggests tweaks to maximize your results.", id: "step-track" },
                { step: "5", title: "Close new contracts", desc: "Convert inbound leads into signed property management contracts with support from our team whenever you need it.", id: "step-close" },
              ].map((s, i, arr) => (
                <div key={s.id} data-testid={s.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-sm font-bold text-white">
                      {s.step}
                    </div>
                    {i < arr.length - 1 && <div className="w-px grow bg-border" />}
                  </div>
                  <div className={`pb-8 ${i === arr.length - 1 ? "pb-0" : ""}`}>
                    <div className="text-base font-semibold">{s.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-marketing-real-estate" className="border-b py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Real Estate Sales</div>
            <h2 data-testid="marketing-re-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Generate real estate leads too
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              The same marketing academy works for finding buyers and sellers — not just property management clients. Earn additional income through our brokerage.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {REAL_ESTATE_FEATURES.map((f) => (
              <Card key={f.id} data-testid={`card-re-${f.id}`} className="nh-surface nh-noise border-card-border/80 p-6">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-[hsl(var(--primary))]/10">
                  <f.icon className="size-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="mt-4 text-base font-semibold">{f.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</div>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-6 max-w-4xl text-center">
            <Button data-testid="button-marketing-re-link" variant="secondary" className="gap-2" asChild>
              <Link href="/real-estate">
                Learn about real estate sales
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section data-testid="section-marketing-cta" className="py-8 md:py-20">
        <div className="nh-container">
          <div className="mx-auto max-w-2xl rounded-3xl border bg-white/60 p-8 text-center shadow-sm">
            <Target className="mx-auto size-10 text-[hsl(var(--accent))]" />
            <h2 data-testid="marketing-cta-title" className="mt-4 text-2xl font-semibold md:text-3xl">
              Ready to see it in action?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              The marketing academy is included with every franchise at no additional cost. Log in to explore, or contact us for a walkthrough.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-marketing-cta-login" className="gap-2" asChild>
                <Link href="/login">
                  Log in to portal
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-marketing-cta-contact" variant="secondary" className="gap-2" asChild>
                <Link href="/contact">
                  <Globe2 className="size-4" />
                  Request info
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

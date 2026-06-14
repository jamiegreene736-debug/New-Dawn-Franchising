import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Bot,
  Building,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  FileDown,
  Gavel,
  Globe2,
  Heart,
  Landmark,
  Mail,
  MapPin,
  Pause,
  Plane,
  Play,
  Printer,
  Quote,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  Volume2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { EmbassyCheckerModal } from "@/components/embassy-checker";

const COMPANY = {
  name: "New Dawn Franchising LLC",
  domain: "newdawnfranchising.com",
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  focus: "El Paso, Texas",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

function Pill({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-2 rounded-full border bg-white/60 px-3 py-1 text-[13px] font-medium text-foreground/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40"
    >
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  testId,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  testId: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div
        data-testid={`${testId}-eyebrow`}
        className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60"
      >
        {eyebrow}
      </div>
      <h2
        data-testid={`${testId}-title`}
        className="mt-3 text-balance text-3xl font-semibold leading-tight text-foreground md:text-4xl"
      >
        {title}
      </h2>
      <p
        data-testid={`${testId}-subtitle`}
        className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground"
      >
        {subtitle}
      </p>
    </div>
  );
}

function FeatureCard({
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
    <Card
      data-testid={testId}
      className="nh-surface nh-noise group relative overflow-hidden border-card-border/80 p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-card-border"
    >
      <div className="flex items-start gap-4">
        <div className="grid size-11 place-items-center rounded-xl border bg-white/70 shadow-sm backdrop-blur">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight">{title}</div>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Card>
  );
}

// Each scene is shown one at a time, in sync with its narration segment
// (server: OVERVIEW_SEGMENTS). Keep the count and order matched.
const OVERVIEW_SCENES = [
  {
    id: "unique",
    kicker: "Why New Dawn",
    title: "Own a U.S. business without running it",
    copy: "The first franchise built from the ground up for the E-2 visa — keep full oversight, skip the day-to-day, let our proprietary AI drive the growth, and live anywhere in the USA.",
    icon: Landmark,
  },
  {
    id: "hands-off",
    kicker: "Own it. Direct it.",
    title: "You direct it. We run it.",
    copy: "Own a real U.S. business while our teams handle daily operations — and live anywhere in the USA.",
    icon: Plane,
  },
  {
    id: "verticals",
    kicker: "Three franchises",
    title: "Property Management · Telecom · Insurance",
    copy: "Choose one of three recurring-revenue verticals, each built for E-2 fit.",
    icon: Building2,
  },
  {
    id: "returns",
    kicker: "Real returns",
    title: "Built to earn",
    copy: "Recurring-revenue businesses designed for steady, ongoing returns. Details in the FDD.",
    icon: TrendingUp,
  },
  {
    id: "guarantee",
    kicker: "Peace of mind",
    title: "Approved — or your money back",
    copy: "If your E-2 visa isn't approved, you get your investment back.",
    icon: ShieldCheck,
  },
  {
    id: "escrow",
    kicker: "Protected",
    title: "Held safely in escrow",
    copy: "Your $225,000 stays in escrow until your visa is approved — then it funds your business.",
    icon: Wallet,
  },
  {
    id: "buyback",
    kicker: "A built-in exit",
    title: "In-house buy-back program",
    copy: "A clear path to recover your investment, typically after about four years.",
    icon: RefreshCw,
  },
  {
    id: "team",
    kicker: "Invest with confidence",
    title: "Backed by an experienced team",
    copy: "In-house immigration, finance, real estate, and legal pros with a decade-plus of success.",
    icon: Users,
  },
  {
    id: "brokers",
    kicker: "Partner with us",
    title: "Broker referral program",
    copy: "Brokers and advisors earn a referral fee for every qualified investor they introduce.",
    icon: Banknote,
  },
  {
    id: "cta",
    kicker: "Get started",
    title: "Invest from $225,000",
    copy: "Request the FDD and compare your three options.",
    icon: CheckCircle2,
  },
];

const FRANCHISE_VERTICALS = [
  {
    id: "property-management",
    title: "Property Management",
    desc: "Long-term rental management operations with local execution teams and owner-level reporting.",
    icon: Building2,
  },
  {
    id: "telecom",
    title: "Telecom",
    desc: "Recurring-service telecom operations supported by centralized systems, sales workflows, and oversight dashboards.",
    icon: Cpu,
  },
  {
    id: "insurance",
    title: "Insurance",
    desc: "Insurance-sector franchise operations designed around compliant supervision, client service, and recurring revenue.",
    icon: ShieldCheck,
  },
];

function HomepageVideoCard({ hero = false }: { hero?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobsRef = useRef<string[] | null>(null);
  const sceneRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [activeScene, setActiveScene] = useState(0);
  const [progress, setProgress] = useState(0); // progress within the current scene

  const playScene = (i: number) => {
    sceneRef.current = i;
    setActiveScene(i);
    setProgress(0);
    const audio = audioRef.current;
    const blobs = blobsRef.current;
    if (!audio || !blobs) return;
    audio.src = blobs[i];
    audio.play().catch(() => {});
  };

  const startPlayback = async () => {
    try {
      setStatus("loading");
      if (!blobsRef.current) {
        // Get the current narration version so changing the script busts the
        // browser's cached audio (the URLs are otherwise immutable).
        let v = "";
        try {
          const m = await fetch("/api/homepage-overview-voiceover", { cache: "no-store" });
          if (m.ok) v = (await m.json()).version ?? "";
        } catch {
          /* fall back to unversioned URLs */
        }
        const q = v ? `?v=${encodeURIComponent(v)}` : "";
        // Fetch every scene's narration up front (cached server-side), so the
        // scenes advance with no gaps.
        blobsRef.current = await Promise.all(
          OVERVIEW_SCENES.map((_, i) =>
            fetch(`/api/homepage-overview-voiceover/${i}${q}`)
              .then((r) => {
                if (!r.ok) throw new Error("voiceover unavailable");
                return r.blob();
              })
              .then((b) => URL.createObjectURL(b)),
          ),
        );
      }
      setStatus("idle");
      setIsPlaying(true);
      playScene(0);
    } catch {
      setStatus("error");
      setIsPlaying(false);
    }
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    // Resume mid-scene if audio is loaded and not finished; otherwise (re)start.
    if (audio && audio.src && !audio.ended) {
      try {
        await audio.play();
        setIsPlaying(true);
        return;
      } catch {
        /* fall through to a fresh start */
      }
    }
    await startPlayback();
  };

  const scene = OVERVIEW_SCENES[activeScene];
  const SceneIcon = scene.icon;
  const overall = (activeScene + progress) / OVERVIEW_SCENES.length;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid={hero ? "hero-video-preview-card" : "video-preview-card"}
        onClick={togglePlayback}
        disabled={status === "loading"}
        className="group block w-full overflow-hidden rounded-[2rem] border border-white/80 bg-[hsl(var(--primary))] text-left shadow-2xl transition hover:-translate-y-0.5 hover:shadow-[0_30px_90px_rgba(15,23,42,0.30)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--accent))]/40 disabled:cursor-wait"
        aria-label={isPlaying ? "Pause the 30-second overview" : "Play the 30-second overview"}
      >
        <div className="relative p-4 text-white md:p-5">
          <div className="absolute inset-0 opacity-20 nh-fine-grid" />

          {/* Header */}
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">
                {status === "loading" ? "Loading…" : "30-Second Overview"}
              </div>
              <div className="mt-1 font-serif text-xl leading-tight text-white md:text-2xl">New Dawn Franchising</div>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 transition group-hover:scale-105">
              {isPlaying ? (
                <Pause className="size-5 text-[hsl(var(--accent))]" />
              ) : (
                <Volume2 className="size-5 text-[hsl(var(--accent))]" />
              )}
            </div>
          </div>

          {/* Scene stage — one scene at a time; nothing overlaps the text */}
          <div className="relative mt-4 grid min-h-[300px] place-items-center overflow-hidden rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.16),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,0,0,0.18))] p-6 md:min-h-[340px] md:p-7 lg:min-h-[370px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center text-center"
              >
                <div className="grid size-16 place-items-center rounded-2xl border border-white/25 bg-white/10 text-[hsl(var(--accent))] shadow-lg md:size-20">
                  <SceneIcon className="size-8 md:size-10" />
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
                  {scene.kicker}
                </div>
                <div className="mt-2 text-balance text-2xl font-semibold leading-tight md:text-3xl">
                  {scene.title}
                </div>
                <p className="mt-2 max-w-lg text-pretty text-sm leading-relaxed text-white/75 md:text-base">{scene.copy}</p>
              </motion.div>
            </AnimatePresence>

            {/* Idle: play CTA pinned to the TOP of the stage so it never covers
                the scene title/copy below. */}
            {!isPlaying && (
              <div className="pointer-events-none absolute inset-0 z-10 bg-[hsl(var(--primary))]/25">
                <div className="absolute inset-x-0 top-0 flex justify-center pt-5 md:pt-6">
                  <div className="grid size-16 -translate-x-4 place-items-center rounded-full bg-white shadow-2xl ring-1 ring-black/5 transition duration-300 group-hover:scale-110 md:size-20 md:-translate-x-6">
                    <span className="ml-1.5 block h-0 w-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-red-600 md:border-y-[16px] md:border-l-[26px]" />
                  </div>
                </div>
              </div>
            )}

            {/* Playing: pause button fades in on hover, in the same top spot. */}
            {isPlaying && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:pt-6">
                <div className="grid size-16 -translate-x-4 place-items-center rounded-full bg-white shadow-2xl ring-1 ring-black/5 md:size-20 md:-translate-x-6">
                  <Pause className="size-7 text-red-600 md:size-8" />
                </div>
              </div>
            )}
          </div>

          {/* Scene indicator dots */}
          <div className="relative mt-4 flex items-center justify-center gap-1.5">
            {OVERVIEW_SCENES.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeScene ? "w-6 bg-[hsl(var(--accent))]" : "w-1.5 bg-white/25"
                }`}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-[hsl(var(--accent))] transition-[width] duration-150 ease-linear"
              style={{ width: `${isPlaying || overall > 0 ? Math.min(100, overall * 100) : 4}%` }}
            />
          </div>
        </div>
      </button>
      {status === "error" && (
        <p className="mt-3 text-sm text-red-600">
          Voiceover unavailable. Check ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in Railway.
        </p>
      )}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration && isFinite(a.duration)) setProgress(a.currentTime / a.duration);
        }}
        onEnded={() => {
          const next = sceneRef.current + 1;
          if (next < OVERVIEW_SCENES.length) {
            playScene(next);
          } else {
            setIsPlaying(false);
            setProgress(0);
            setActiveScene(0);
            sceneRef.current = 0;
          }
        }}
      />
    </div>
  );
}

const HOMEPAGE_TEAM = [
  {
    name: "Jeffrey Tung",
    role: "Founding Member",
    focus: "SMB operations, private equity, and multi-market execution",
    bullets: [
      "Co-Founder & Partner at CPS Capital, a private equity firm focused on SMBs",
      "Works with management teams to support growth, execution, and operating discipline",
      "Board and audit committee experience across private and public company contexts",
      "Background includes Inner Spirit Holdings, Auxly Cannabis Group, McKinsey, and SAP",
    ],
    image: "/jeffrey-tung-headshot.jpg",
    imageClass: "object-cover",
    imageOverlay: "from-slate-950/10 via-transparent to-[hsl(var(--primary))]/20",
  },
  {
    name: "Chris von Pohlot",
    role: "Managing Director",
    focus: "Alternative finance, real estate, and capital markets",
    bullets: [
      "Columbia University-educated fintech entrepreneur",
      "Founder of Altbanc, an alternative lending platform for SMB debt refinancing",
      "Real estate acquisitions and asset management experience at The Bascom Group",
      "Capital markets background with financial analysis experience at Eastdil Secured",
    ],
    image: "/chris-von-pohlot-headshot.jpg",
    imageClass: "object-[center_32%]",
    imageOverlay: "from-emerald-950/10 via-transparent to-[hsl(var(--primary))]/18",
  },
  {
    name: "Tom Meister",
    role: "Founding Member",
    focus: "Fintech, specialty finance, and legal strategy",
    bullets: [
      "Attorney, entrepreneur, and investor across capital markets and fintech",
      "Began his legal career at Wilson Sonsini and Goodwin Procter",
      "Executive roles at Funding Circle, NepFin, and Zilch; two reached unicorn status",
      "Leads Grizzly Peak Ventures and co-founded Brightpoint Law, LLP",
    ],
    image: "/tom-meister-headshot.jpg",
    imageClass: "object-[center_25%]",
    imageOverlay: "from-amber-950/10 via-transparent to-[hsl(var(--primary))]/20",
  },
];

function HomepageTeamRow() {
  return (
    <section data-testid="section-homepage-team" className="border-b bg-[linear-gradient(180deg,#ffffff_0%,#f7faf8_100%)] py-10 md:py-16">
      <div className="nh-container">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/55">Senior team</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              The people behind the platform.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-right">
            New Dawn combines franchise development, real estate, finance, and legal experience so investors are backed by operators who understand both the business and the visa pathway.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {HOMEPAGE_TEAM.map((member) => (
            <div key={member.name} className="group overflow-hidden rounded-3xl border bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
              <div className="relative aspect-[4/3] overflow-hidden bg-[hsl(var(--primary))]">
                <img
                  src={member.image}
                  alt={`${member.name} — ${member.role}`}
                  className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.035] ${member.imageClass}`}
                  loading="lazy"
                />
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${member.imageOverlay}`} />
              </div>
              <div className="p-5">
                <div className="text-lg font-semibold">{member.name}</div>
                <div className="mt-1 text-sm font-medium text-[hsl(var(--primary))]">{member.role}</div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{member.focus}</p>
                <ul className="mt-4 space-y-2 border-t pt-4">
                  {member.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-[13px] leading-snug text-foreground/75">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[hsl(var(--accent))]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex justify-center">
          <Button data-testid="button-homepage-team" variant="secondary" className="gap-2" asChild>
            <Link href="/team">
              Meet the full team
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function EmbassyTechnologyBridge() {
  const items = [
    {
      title: "Check timing",
      text: "Start with the embassy timeline for your country.",
      icon: <Clock className="size-5" />,
    },
    {
      title: "Build the file",
      text: "Use the franchise model, FDD, and operating documents.",
      icon: <FileDown className="size-5" />,
    },
    {
      title: "Run with systems",
      text: "Launch with technology, reporting, and managed operations.",
      icon: <Cpu className="size-5" />,
    },
  ];

  return (
    <section data-testid="section-embassy-tech-bridge" className="relative z-10 -mt-10 bg-[#f7faf8] pb-8 md:-mt-14 md:pb-12">
      <div className="nh-container">
        <div className="mx-auto grid max-w-5xl gap-3 rounded-3xl border bg-white/95 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur md:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-2xl px-4 py-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--accent))] shadow-sm">
                {item.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{item.title}</div>
                <div className="mt-1 text-sm leading-snug text-muted-foreground">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── E-2 FAQ Accordion ─────────────────────────────────────────────────────────
const E2_FAQ_ITEMS = [
  { q: "How much do I need to invest?", a: "There is no fixed minimum, but the investment must be \"substantial\" relative to the cost of the business. Most E-2 investors invest $100,000 or more. Our franchise packages start at $225,000, which is designed to clearly meet the substantiality requirement." },
  { q: "Does the E-2 lead to a green card?", a: "Not directly. However, a growing E-2 business can be a stepping stone to an EB-5 immigrant investor visa, which does lead to a green card (permanent residency)." },
  { q: "Can my spouse work in the US on E-2?", a: "Yes. Your spouse receives an E-2 dependent visa and can apply for work authorization (EAD), allowing them to work for any US employer." },
  { q: "How long does the process take?", a: "Typically 3–9 months from business setup to visa approval, depending on your country's embassy wait times. Use our embassy checker above to estimate your wait." },
  { q: "What if my visa is denied?", a: "Our franchise is structured with an escrow arrangement — if your E-2 visa is not approved, your investment is returned from escrow. You are never left with no visa and no money." },
];

function E2FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {E2_FAQ_ITEMS.map((item, i) => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
            aria-expanded={open === i}
          >
            <span>{item.q}</span>
            <span className={`ml-2 text-gray-400 transition-transform shrink-0 ${open === i ? "rotate-180" : ""}`}>▾</span>
          </button>
          {open === i && (
            <div className="px-4 pb-3 text-xs text-gray-600 leading-relaxed border-t bg-gray-50/50 pt-3">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [embassyOpen, setEmbassyOpen] = useState(false);

  return (
    <div data-testid="page-home" className="min-h-screen">
      <main data-testid="main-content" id="top">
        <section
          data-testid="section-hero"
          className="relative isolate overflow-hidden border-b bg-[linear-gradient(180deg,#f8fbff_0%,#eef5f4_100%)]"
        >
          <div className="absolute inset-0 -z-10 nh-hero-bg" />
          <div className="absolute inset-0 -z-10 opacity-60 nh-fine-grid" />
          <div className="nh-container py-5 md:py-8 lg:py-10">
            {/* Redesigned hero: clearer conversion path on the left, video as the visual anchor on the right. */}
            <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr] xl:gap-12">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
              >
                <div className="flex flex-wrap gap-2">
                  <Pill testId="pill-location">
                    <MapPin className="size-4 text-foreground/70" /> {COMPANY.focus}
                  </Pill>
                  <Pill testId="pill-focus">
                    <Globe2 className="size-4 text-foreground/70" /> E-2 investor focus
                  </Pill>
                  <Pill testId="pill-verticals">
                    <Building className="size-4 text-foreground/70" /> Property Management · Telecom · Insurance
                  </Pill>
                </div>

                <h1
                  data-testid="text-hero-title"
                  className="mt-5 text-balance text-4xl font-semibold leading-[1.02] tracking-tight md:text-5xl lg:text-6xl"
                >
                  You Own It.{" "}
                  <span className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
                    You Direct It.
                  </span>{" "}
                  We Run It.
                </h1>

                <p
                  data-testid="text-hero-subtitle"
                  className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
                >
                  A multi-vertical franchise platform designed to help qualified E-2 investors and their families live in the USA. Choose from Property Management, Telecom, or Insurance while you maintain executive control and our operating teams handle the daily execution.
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {FRANCHISE_VERTICALS.map((vertical) => {
                    const Icon = vertical.icon;
                    return (
                      <div key={vertical.id} data-testid={`card-hero-vertical-${vertical.id}`} className="rounded-2xl border bg-white/70 p-3 shadow-sm backdrop-blur">
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 place-items-center rounded-full bg-[hsl(var(--primary))]/8">
                            <Icon className="size-4 text-[hsl(var(--primary))]" />
                          </span>
                          <div className="text-sm font-semibold leading-tight">{vertical.title}</div>
                        </div>
                        <p className="mt-2 hidden text-xs leading-snug text-muted-foreground lg:block">
                          {vertical.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button data-testid="button-hero-primary-fdd" size="lg" className="gap-2 bg-[hsl(var(--primary))] px-6 py-6 text-base shadow-xl shadow-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/92" asChild>
                    <a href="/contact">
                      Request Your Free FDD & Schedule a Call
                      <ArrowRight className="size-5" />
                    </a>
                  </Button>
                  <Button data-testid="button-hero-dylan-call" size="lg" variant="secondary" className="gap-2 px-6 py-6 text-base" asChild>
                    <a href="https://calendly.com/dylan-newdawnfranchising" target="_blank" rel="noopener noreferrer">
                      Schedule with Dylan
                      <CalendarCheck className="size-5" />
                    </a>
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <a data-testid="button-hero-attorney" href="/contact?type=attorney" className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--primary))] hover:underline">
                    Immigration attorney inquiry <ArrowRight className="size-3.5" />
                  </a>
                  <span className="hidden text-muted-foreground/40 sm:inline">•</span>
                  <Button
                    data-testid="button-hero-brochure"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-fit gap-2 p-0 text-muted-foreground hover:bg-transparent hover:text-[hsl(var(--primary))]"
                    asChild
                  >
                    <a href="/api/brochure" download>
                      <FileDown className="size-4" />
                      Download investor brochure
                    </a>
                  </Button>
                </div>

                <p data-testid="text-fdd-credibility" className="mt-3 text-xs text-muted-foreground/70">
                  Franchise Disclosure Document (FDD) available upon request. New Dawn Franchising is a registered franchisor.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
                className="relative order-first lg:order-none"
              >
                <HomepageVideoCard hero />
                <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-[hsl(var(--accent))]/15 via-transparent to-[hsl(var(--primary))]/15 blur-2xl" />

                <div className="mt-5 grid gap-0 overflow-hidden rounded-2xl border bg-white/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 md:grid-cols-3">
                  {[
                    {
                      id: "1",
                      label: "Your funds",
                      title: "Held in escrow until your E-2 visa is approved",
                    },
                    {
                      id: "2",
                      label: "Your business",
                      title: "Operational and earning before funds are released",
                    },
                    {
                      id: "3",
                      label: "If your visa isn't approved",
                      title: "Your investment is returned from escrow",
                    },
                  ].map((item) => (
                    <div key={item.id} className="border-b px-4 py-5 last:border-b-0 md:border-b-0 md:border-r md:px-5 md:last:border-r-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/8 text-[11px] font-bold text-[hsl(var(--primary))]">
                          {item.id}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {item.label}
                          </div>
                          <div data-testid={`text-hero-proof-${item.id}`} className="mt-1 text-sm font-semibold leading-snug">
                            {item.title}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground/70">
                  Structured investment with built-in investor protection. Full details provided in the Franchise Disclosure Document.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        <HomepageTeamRow />

        {/* ── Embassy Wait Time Checker ── */}
        <section data-testid="section-embassy" className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#0f2744] to-[#0a3d2e] pb-20 pt-10 md:pb-28 md:pt-20">
          {/* decorative grid */}
          <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
          {/* glow blobs */}
          <div className="pointer-events-none absolute -left-24 -top-24 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="nh-container relative">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-10 md:grid-cols-2 items-center">
                {/* Left — text */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mb-5">
                    <Globe2 className="w-3.5 h-3.5" />
                    Free Tool — No Sign-up Required
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                    Check Your Embassy's{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                      Waiting Time
                    </span>
                  </h2>
                  <p className="mt-4 text-white/65 text-base leading-relaxed max-w-md">
                    Find out how long it could take to get your E-2 visa appointment at your nearest US embassy or consulate — instantly, for free.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {[
                      { flag: "🇬🇧", country: "UK", time: "2–4 wks" },
                      { flag: "🇲🇽", country: "Mexico", time: "8–12 wks" },
                      { flag: "🇩🇪", country: "Germany", time: "3–6 wks" },
                      { flag: "🇯🇵", country: "Japan", time: "2–4 wks" },
                    ].map((ex) => (
                      <div key={ex.country} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <span className="text-lg">{ex.flag}</span>
                        <div className="text-xs">
                          <div className="text-white font-medium">{ex.country}</div>
                          <div className="text-white/50">{ex.time}</div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40">
                      +80 more…
                    </div>
                  </div>

                  <Button
                    data-testid="button-open-embassy-checker"
                    onClick={() => setEmbassyOpen(true)}
                    className="mt-8 gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 text-base px-6 py-5"
                    size="lg"
                  >
                    <Clock className="w-5 h-5" />
                    Check My Embassy's Wait Time
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <p className="mt-3 text-xs text-white/35">
                    Data sourced from US State Department · Always verify at travel.state.gov
                  </p>
                </div>

                {/* Right — visual */}
                <div className="hidden md:block">
                  <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-3">
                    <div className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Sample results</div>
                    {[
                      { flag: "🇬🇧", country: "United Kingdom", city: "London", time: "2–4 weeks", status: "Fast" },
                      { flag: "🇲🇽", country: "Mexico", city: "Mexico City", time: "8–12 weeks", status: "Moderate" },
                      { flag: "🇰🇷", country: "South Korea", city: "Seoul", time: "3–5 weeks", status: "Fast" },
                      { flag: "🇵🇰", country: "Pakistan", city: "Islamabad", time: "6–12 weeks", status: "Longer" },
                    ].map((r) => (
                      <div key={r.country} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{r.flag}</span>
                          <div>
                            <div className="text-sm font-semibold text-white">{r.country}</div>
                            <div className="text-xs text-white/45">US Embassy — {r.city}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-400">{r.time}</div>
                          <div className={`text-xs ${r.status === "Fast" ? "text-emerald-500/70" : r.status === "Moderate" ? "text-amber-400/70" : "text-orange-400/70"}`}>{r.status}</div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-center">
                      <button onClick={() => setEmbassyOpen(true)} className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline">
                        Check your country →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <EmbassyTechnologyBridge />

        <section data-testid="section-tech" className="border-b bg-[linear-gradient(180deg,#1d2d5c_0%,hsl(var(--primary))_46%,#102a46_100%)] pb-12 pt-14 md:pb-24 md:pt-24">
          <div className="nh-container">
            <div className="mx-auto max-w-3xl text-center text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent))]">Proprietary Technology. Built Exclusively for New Dawn Franchisees.</div>
              <h2 data-testid="text-tech-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
                Technology Built for Your Business
              </h2>
              <p data-testid="text-tech-body" className="mt-4 text-pretty text-base leading-relaxed text-white/75">
                Every New Dawn franchisee benefits from proprietary technology built exclusively for our multi-vertical system — from owner dashboards and client communications to marketing, reporting, and workflow automation. This isn't off-the-shelf software. It's infrastructure designed around E-2 investor oversight across Property Management, Telecom, and Insurance.
              </p>
              <p data-testid="text-tech-spanish" className="mt-4 text-pretty text-sm leading-relaxed text-white/55" lang="es">
                Cada franquiciado de New Dawn tiene acceso a herramientas desarrolladas exclusivamente para nuestro sistema — desde paneles de control y comunicaciones automatizadas hasta marketing e informes operativos. No es software genérico. Es infraestructura diseñada para inversionistas E-2 en administración de propiedades, telecomunicaciones y seguros.
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-3">
              {[
                { id: "client-comm", icon: <Users className="size-5 text-[hsl(var(--accent))]" />, text: "Automated client communication, follow-up, and service workflows" },
                { id: "marketing", icon: <CalendarCheck className="size-5 text-[hsl(var(--accent))]" />, text: "Technology-assisted marketing and franchise growth campaigns" },
                { id: "dashboards", icon: <Cpu className="size-5 text-[hsl(var(--accent))]" />, text: "Operational dashboards so you always know what's happening in your business" },
              ].map((item) => (
                <div key={item.id} data-testid={`card-tech-${item.id}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 text-left backdrop-blur">
                  <div className="mt-0.5 shrink-0">{item.icon}</div>
                  <div className="text-sm leading-relaxed text-white/80">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-testid="section-how" id="how-it-works" className="bg-[linear-gradient(180deg,#f6f9fb_0%,#ffffff_62%,#eef4fb_100%)] pb-8 pt-10 md:pb-14 md:pt-16">
          <div className="nh-container">
            <SectionHeading
              testId="heading-how"
              eyebrow="How it works"
              title="You control the business. We manage the operations."
              subtitle="A structure designed for investors who want full visibility and control, without handling daily manual work in Property Management, Telecom, or Insurance."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <FeatureCard
                testId="card-how-1"
                icon={<CheckCircle2 className="size-5 text-[hsl(var(--primary))]" />}
                title="You own the business"
                desc="You operate under your franchise entity and keep direct control over your bank account and key decisions."
              />
              <FeatureCard
                testId="card-how-2"
                icon={<ClipboardCheck className="size-5 text-[hsl(var(--primary))]" />}
                title="We set up local operations"
                desc="Experienced operating teams execute the manual work, service coordination, client communication, and reporting cadence."
              />
              <FeatureCard
                testId="card-how-3"
                icon={<Building2 className="size-5 text-[hsl(var(--primary))]" />}
                title="Three recurring-revenue lanes"
                desc="Select the franchise vertical that fits your strategy: Property Management, Telecom, or Insurance."
              />
            </div>
          </div>
        </section>

        <section data-testid="section-why" id="why-us" className="border-y bg-[linear-gradient(180deg,#ffffff_0%,#fbfdfc_34%,#edf6f0_100%)] pb-10 pt-8 md:pb-16 md:pt-14">
          <div className="nh-container">
            <SectionHeading
              testId="heading-why"
              eyebrow="Why New Dawn"
              title="A franchise built on trust, technology, and reliable operations"
              subtitle="A professional franchise model powered by proprietary technology built exclusively for New Dawn franchisees — focused on stability, transparency, and accountability at every level."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                testId="card-why-ai"
                icon={<Bot className="size-5 text-[hsl(var(--accent))]" />}
                title="Proprietary technology powers the engine"
                desc="Our proprietary technology supports lead generation, operations reporting, training, and owner dashboards across Property Management, Telecom, and Insurance."
              />
              <FeatureCard
                testId="card-why-1"
                icon={<Building2 className="size-5 text-[hsl(var(--accent))]" />}
                title="Three industries selected for E-2 fit"
                desc="Property Management, Telecom, and Insurance were chosen because they can support recurring revenue, supervisory control, documented operations, and long-term renewal readiness."
              />
              <FeatureCard
                testId="card-why-2"
                icon={<Wallet className="size-5 text-[hsl(var(--accent))]" />}
                title="Owner visibility and control"
                desc="You retain executive control of your franchise, bank accounts, and key decisions while local teams execute the day-to-day workflows."
              />
              <FeatureCard
                testId="card-why-live"
                icon={<Plane className="size-5 text-[hsl(var(--accent))]" />}
                title="Live anywhere in the USA"
                desc="The operating framework gives franchise owners domestic flexibility, with oversight systems designed so families can live where they choose in the United States."
              />
              <FeatureCard
                testId="card-why-buyback"
                icon={<RefreshCw className="size-5 text-[hsl(var(--accent))]" />}
                title="Escrow-first investor protection"
                desc="Investor capital is placed in escrow during setup, and New Dawn’s FDD explains the refund framework if a qualifying E-2 application is denied twice."
              />
              <FeatureCard
                testId="card-why-referral"
                icon={<Users className="size-5 text-[hsl(var(--accent))]" />}
                title="Lucrative referral program"
                desc="Know someone who's a great fit? Our referral program rewards you for introducing qualified investors. It's a meaningful way to grow your network and earn while helping others start their journey."
              />
              <FeatureCard
                testId="card-why-eb5"
                icon={<Landmark className="size-5 text-[hsl(var(--accent))]" />}
                title="E-2 to EB-5 pathway"
                desc="Your E-2 franchise can serve as a stepping stone to permanent residency. As your business grows, it can meet the requirements for an EB-5 green card — giving you a clear path forward on an accelerated timeline."
              />
            </div>
          </div>
        </section>

        <section data-testid="section-group" className="border-b bg-[linear-gradient(180deg,#f7fbf8_0%,#eef7f1_54%,#e8f1ee_100%)] pb-10 pt-8 md:pb-16 md:pt-14">
          <div className="nh-container">
            <SectionHeading
              testId="heading-group"
              eyebrow="Part of something bigger"
              title="The New Dawn Franchising Group of Companies™"
              subtitle="New Dawn Franchising is part of a larger corporate platform combining franchise operations, technology, real estate, finance, and legal experience to support three recurring-revenue industries."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                testId="card-group-re"
                icon={<Building className="size-5 text-[hsl(var(--primary))]" />}
                title="Star Spangled Banner Realty"
                desc="An established brokerage with dozens of experienced agents and over a decade of successful transactions across the El Paso market."
              />
              <FeatureCard
                testId="card-group-fin"
                icon={<Banknote className="size-5 text-[hsl(var(--primary))]" />}
                title="Financing — 10+ years"
                desc="A large financing department with over a decade of lending expertise, helping investors and buyers secure competitive terms and close with confidence."
              />
              <FeatureCard
                testId="card-group-law"
                icon={<Gavel className="size-5 text-[hsl(var(--primary))]" />}
                title="Legal — 10+ years"
                desc="Experienced legal professionals covering real estate law, franchise compliance, and business structuring to protect your investment at every step."
              />
              <FeatureCard
                testId="card-group-ai"
                icon={<Cpu className="size-5 text-[hsl(var(--primary))]" />}
                title="Proprietary AI technology"
                desc="AI agents power our marketing, operations, and franchise management systems. All built on proprietary software developed in-house for our franchise owners."
              />
            </div>

            <div className="mt-6 flex justify-center">
              <Button data-testid="button-group-team" variant="secondary" className="gap-2" asChild>
                <Link href="/team">
                  Meet our team & divisions
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Meet Dylan ── */}
        <section data-testid="section-meet-dylan" className="overflow-hidden border-b bg-[linear-gradient(180deg,#eaf1fb_0%,#f8fbff_44%,#ffffff_100%)] pb-8 pt-10 md:pb-16 md:pt-16">
          <div className="nh-container">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-12 md:grid-cols-[280px_1fr] md:gap-16 items-start">

                {/* ── Photo column ── */}
                <div className="relative mx-auto w-full max-w-[280px] md:max-w-none">
                  {/* Accent blobs */}
                  <div className="pointer-events-none absolute -left-6 -top-6 size-48 rounded-full bg-[hsl(var(--accent))] opacity-10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-6 -right-6 size-48 rounded-full bg-[hsl(var(--primary))] opacity-10 blur-2xl" />

                  {/* Portrait */}
                  <div className="relative overflow-hidden rounded-3xl shadow-2xl aspect-[4/5] bg-[hsl(var(--primary))]">
                    <img
                      src="/dylan-headshot.png"
                      alt="Dylan Delaney — Founding Member & Director of Franchise Development"
                      className="h-full w-full object-cover object-top"
                      loading="eager"
                    />
                    {/* gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="inline-block mb-1 rounded-full bg-[hsl(var(--accent))] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        Founding Member
                      </span>
                      <p className="text-sm font-semibold text-white">Dylan Delaney</p>
                      <p className="text-xs text-white/80">Director of Franchise Development</p>
                    </div>
                  </div>

                  {/* Floating availability card */}
                  <div className="mt-4 rounded-2xl border bg-white p-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                      </span>
                      <span className="text-sm font-medium text-foreground">Available this week</span>
                    </div>
                    <Button
                      data-testid="button-dylan-calendly"
                      className="w-full gap-2"
                      asChild
                    >
                      <a href="https://calendly.com/dylan-newdawnfranchising" target="_blank" rel="noopener noreferrer">
                        <CalendarCheck className="size-4" />
                        Meet with a founding member
                      </a>
                    </Button>
                  </div>
                </div>

                {/* ── Content column ── */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
                      Meet a Founding Member
                    </p>
                    <span className="rounded-full border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.08)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--accent))]">
                      New Dawn Franchising
                    </span>
                  </div>
                  <h2
                    data-testid="heading-meet-dylan"
                    className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl"
                  >
                    The person you'll work with — personally.
                  </h2>

                  {/* Pull quote */}
                  <div className="relative mt-8 rounded-2xl bg-[hsl(var(--primary))] px-6 py-5">
                    <Quote className="absolute right-5 top-4 size-8 text-white/15" />
                    <p className="text-base italic leading-relaxed text-white/90">
                      "Every investor I work with is making one of the most significant decisions of their life. That's not a transaction to me — it's a responsibility. I'm here from your first call all the way through your first day of operations."
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[hsl(var(--accent))]">— Dylan Delaney, Founding Member</p>
                  </div>

                  {/* Bio */}
                  <div className="mt-7 space-y-4 text-[15px] leading-relaxed text-foreground/70">
                    <p>
                      As a founding member of New Dawn Franchising, Dylan built this company from the ground up — selecting the franchise brands, building the investor pathway, and designing the experience that sets us apart. He created this specifically for international investors entering the U.S. market.
                    </p>
                    <p>
                      Dylan's background spans sales leadership, business development, and SMB operations across Texas — Houston, Austin, and now El Paso. He'll walk you through the franchise side of things: entity formation, territory selection, FDD review, and operational launch. Your immigration attorney handles the visa process — Dylan handles everything else and keeps it all moving. His relationships with the attorneys, territory partners, and operations team mean you get real answers quickly — not callbacks and uncertainty.
                    </p>
                    <p>
                      When you speak with Dylan, you're not talking to a salesperson. You're talking to one of the people who owns this company — and who has a personal stake in your success.
                    </p>
                  </div>

                  {/* Credential row */}
                  <div className="mt-8 grid grid-cols-3 gap-4 border-t pt-7">
                    {[
                      { stat: "Founder", label: "Built New Dawn Franchising from the ground up" },
                      { stat: "Texas", label: "Deep operational roots in El Paso's high-growth market" },
                      { stat: "Team", label: "Connected to immigration attorneys, territory partners, and operations experts" },
                    ].map(({ stat, label }) => (
                      <div key={stat}>
                        <div className="text-2xl font-bold text-foreground">{stat}</div>
                        <div className="mt-1 text-xs leading-snug text-foreground/50">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* CTAs */}
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button data-testid="button-dylan-cta-calendar" className="gap-2" asChild>
                      <a href="https://calendly.com/dylan-newdawnfranchising" target="_blank" rel="noopener noreferrer">
                        <CalendarCheck className="size-4" />
                        Schedule a call with Dylan
                      </a>
                    </Button>
                    <Button data-testid="button-dylan-linkedin" variant="outline" className="gap-2" asChild>
                      <a href="https://www.linkedin.com/in/dylanmdelaney" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                        View on LinkedIn
                      </a>
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        <section data-testid="section-quiz-cta" className="border-y bg-[linear-gradient(180deg,hsl(var(--primary))_0%,#1b2d5d_100%)] py-8 md:py-12">
          <div className="nh-container">
            <div className="mx-auto max-w-2xl text-center text-[hsl(var(--primary-foreground))]">
              <h2 className="text-balance text-2xl font-semibold md:text-3xl">
                Not sure if this franchise is right for you?
              </h2>
              <p className="mt-3 text-sm leading-relaxed opacity-90 md:text-base">
                Take our 2-minute Franchise Readiness Quiz to see how well you align with the New Dawn model.
              </p>
              <Button
                data-testid="button-quiz-cta"
                className="mt-6 gap-2 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))]/90"
                asChild
              >
                <Link href="/quiz">
                  Take the quiz
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section data-testid="section-investment" id="investment" className="border-b bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_48%,#eef3fa_100%)] pb-10 pt-8 md:pb-16 md:pt-16">
          <div className="nh-container">
            <SectionHeading
              testId="heading-investment"
              eyebrow="Investment"
              title="Franchise packages from $225,000"
              subtitle="A clear path to franchise ownership, a structured E-2 investor visa, and the freedom to live anywhere in the USA."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                testId="card-inv-price"
                icon={<DollarSign className="size-5 text-[hsl(var(--primary))]" />}
                title="Packages from $225,000"
                desc="Our franchise packages start at $225,000 — a structured investment designed to meet E-2 visa requirements while giving you a real, operating business in El Paso, Texas. Your funds are held in escrow during setup and released into the business once it is live and operational."
              />
              {/* Addition 2: escrow protection bullet */}
              <FeatureCard
                testId="card-inv-escrow"
                icon={<Shield className="size-5 text-[hsl(var(--primary))]" />}
                title="Investment held in escrow"
                desc="Investment held in escrow — released only once your visa is approved. Your business earns revenue throughout."
              />
              <FeatureCard
                testId="card-inv-financing"
                icon={<Banknote className="size-5 text-[hsl(var(--primary))]" />}
                title="Financing available"
                desc="Need financing? We can help. Speak with our team today to explore available financing options that work for your situation."
              />
              <FeatureCard
                testId="card-inv-spouse"
                icon={<Heart className="size-5 text-[hsl(var(--primary))]" />}
                title="Spouse visa strategy"
                desc="Structure your franchise so your spouse holds the E-2 visa while you continue your current employment or work situation in the USA. Your family gets the visa, and you keep earning."
              />
              <FeatureCard
                testId="card-inv-buyback"
                icon={<RotateCcw className="size-5 text-[hsl(var(--primary))]" />}
                title="In-house buy-back program"
                desc="Looking to exit in 4 years? Ask about our in-house buy-back program. Invest now, build your business, and when you're ready to move on, we have a program to help you recover your investment."
              />
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button data-testid="button-inv-cta" className="gap-2" asChild>
                <Link href="/contact">
                  Request franchise details
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button data-testid="button-inv-call" variant="secondary" className="gap-2" asChild>
                <a href={`tel:${COMPANY.phoneTel}`}>
                  Call us: {COMPANY.phone}
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── E-2 Visa Resources ── */}
        <section data-testid="section-e2-resources" id="e2-resources" className="border-b bg-[linear-gradient(180deg,#f7faf9_0%,#fbfdff_38%,#ffffff_100%)] pb-10 pt-8 md:pb-16 md:pt-14">
          <div className="nh-container">
            <SectionHeading
              testId="heading-e2-resources"
              eyebrow="E-2 Visa Resources"
              title="Everything you need to know about the E-2 visa"
              subtitle="The E-2 Investor Visa lets nationals of treaty countries invest in and manage a US business. Here's a complete overview of what's involved."
            />

            <div className="mx-auto mt-12 max-w-5xl space-y-10">

              {/* What is E-2 + Benefits row */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* What is E-2 */}
                <Card className="nh-surface border-card-border/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                      <Globe2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                    </div>
                    <h3 className="font-semibold text-gray-900">What is the E-2 Visa?</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    The E-2 Treaty Investor Visa allows nationals of countries that maintain a commercial treaty with the United States to enter and work in the US based on a <strong>substantial investment in a bona fide US enterprise</strong>. Key requirements include:
                  </p>
                  <ul className="mt-3 space-y-2">
                    {[
                      "Nationality of a treaty country",
                      "Substantial investment (generally $100K+)",
                      "50%+ ownership of the US business",
                      "Business must be real and operating",
                      "Investor must direct & develop the business",
                      "Investment must not be \"marginal\"",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Benefits */}
                <Card className="nh-surface border-card-border/80 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Key Benefits</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { icon: "🇺🇸", title: "Live & work in the USA", desc: "Legally live and work in the United States as the business director." },
                      { icon: "👨‍👩‍👧", title: "Bring your family", desc: "Spouse and unmarried children under 21 receive E-2 dependent status." },
                      { icon: "📋", title: "No annual lottery", desc: "Unlike H-1B, the E-2 is not subject to a lottery or numerical cap." },
                      { icon: "🔄", title: "Renewable indefinitely", desc: "Renewed every 2 years for as long as your business remains active." },
                      { icon: "🌍", title: "Live anywhere in the US", desc: "Your business operates in Texas — you can live anywhere in the country." },
                      { icon: "📈", title: "Path to EB-5", desc: "A growing E-2 business can serve as a stepping stone toward permanent residency." },
                    ].map((b) => (
                      <div key={b.title} className="flex items-start gap-2.5">
                        <span className="text-lg shrink-0">{b.icon}</span>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{b.title}</div>
                          <div className="text-xs text-gray-500 leading-relaxed">{b.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Step-by-Step E-2 Process</h3>
                <div className="relative">
                  {/* connecting line */}
                  <div className="hidden md:block absolute top-6 left-0 right-0 h-0.5 bg-gradient-to-r from-[hsl(var(--primary))]/20 via-emerald-400/40 to-[hsl(var(--primary))]/20" style={{ marginLeft: "10%", marginRight: "10%" }} />
                  <div className="grid gap-6 md:grid-cols-5">
                    {[
                      { step: "01", title: "Business Setup", time: "4–8 weeks", desc: "Entity formation, franchise agreement, escrow setup. Your business is established.", color: "bg-blue-500" },
                      { step: "02", title: "File Petition", time: "2–4 weeks", desc: "Immigration attorney prepares and files your E-2 visa application with the embassy.", color: "bg-indigo-500" },
                      { step: "03", title: "Embassy Interview", time: "Varies by country", desc: "Attend your embassy appointment. Wait times vary — use our checker above.", color: "bg-violet-500" },
                      { step: "04", title: "Approval & Entry", time: "1–2 weeks after", desc: "Visa stamped in your passport. Enter the US and begin directing operations.", color: "bg-emerald-500" },
                      { step: "05", title: "Renew Every 2 Years", time: "Ongoing", desc: "E-2 is renewable indefinitely. Keep your business active and compliant.", color: "bg-teal-500" },
                    ].map((s, i) => (
                      <div key={s.step} className="relative flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-full ${s.color} flex items-center justify-center text-white font-bold text-sm shadow-lg mb-3 relative z-10`}>
                          {s.step}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{s.title}</div>
                        <div className="text-xs text-[hsl(var(--primary))] font-medium mt-0.5">{s.time}</div>
                        <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Eligibility checklist + CTA row */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Eligibility checklist */}
                <Card className="nh-surface border-card-border/80 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Eligibility Checklist</h3>
                  <div className="space-y-3">
                    {[
                      { label: "From an E-2 treaty country", check: true },
                      { label: "Able to invest $100,000+ in a US business", check: true },
                      { label: "Will own 50%+ of the business", check: true },
                      { label: "Ready to direct & develop the business", check: true },
                      { label: "Business will create jobs for US workers", check: true },
                      { label: "Investment is at risk (not guaranteed return)", check: true },
                    ].map((item) => (
                      <label key={item.label} className="flex items-center gap-3 text-sm text-gray-700">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${item.check ? "border-emerald-400 bg-emerald-50" : "border-gray-200"}`}>
                          {item.check && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-4 leading-relaxed">This is a general overview only — not legal or immigration advice. Consult a qualified immigration attorney for your specific situation.</p>
                </Card>

                {/* FAQ accordion */}
                <Card className="nh-surface border-card-border/80 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Quick E-2 FAQ</h3>
                  <E2FaqAccordion />
                </Card>
              </div>

              {/* CTA bar */}
              <div className="rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-white">
                <div>
                  <div className="font-bold text-lg">Ready to explore your E-2 visa options?</div>
                  <div className="text-sm text-white/70 mt-1">Book a free consultation with our team. No obligation, no pressure.</div>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  <Button
                    className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-white"
                    onClick={() => setEmbassyOpen(true)}
                  >
                    <Clock className="w-4 h-4" />
                    Check Wait Time
                  </Button>
                  <Button variant="secondary" className="gap-2 bg-white text-[hsl(var(--primary))] hover:bg-white/90" asChild>
                    <a href="/contact">
                      Book Free Consultation
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section data-testid="section-faq" id="faq" className="bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_36%,#eef5f2_100%)] pb-10 pt-8 md:pb-16 md:pt-14">
          <div className="nh-container">
            <SectionHeading
              testId="heading-faq"
              eyebrow="FAQ"
              title="Common questions"
              subtitle="Clear expectations upfront. (This page is informational and not legal or immigration advice.)"
            />

            <div className="mx-auto mt-10 grid max-w-3xl gap-3">
              {[
                {
                  q: "Is this legal/immigration advice?",
                  a: "No. We can describe our franchise model and operations, but you should consult qualified legal and immigration professionals for visa guidance.",
                  id: "advice",
                },
                {
                  q: "What happens to my investment if my E-2 visa isn't approved?",
                  a: "Your funds are held in escrow throughout the setup process. Your business is established and begins operating while your visa application is in progress. If your E-2 visa application is not approved, your investment is released from escrow and returned to you. We built the process this way intentionally — so that you are never in a position where your money is gone and your visa is not. Full details of the escrow arrangement are outlined in the Franchise Disclosure Document, which is available upon request.",
                  id: "escrow-protection",
                },
                {
                  q: "Do I have to do the day-to-day work myself?",
                  a: "No. Each New Dawn vertical is structured so you are the business director and decision-maker. You maintain ownership control, bank-account oversight, and executive supervision while approved local teams manage daily execution.",
                  id: "hands-off",
                },
                {
                  q: "How do I choose between Property Management, Telecom, and Insurance?",
                  a: "The FDD and discovery process help you compare the three options. We look at your goals, market fit, investment preferences, operational comfort, and E-2 strategy, then walk you through which vertical is the strongest fit.",
                  id: "choose-vertical",
                },
                {
                  q: "Why were these three industries selected?",
                  a: "Property Management, Telecom, and Insurance all lend themselves to recurring revenue, documented operating systems, supervisory control, staffing, and renewal-ready reporting. Those traits are important for a credible E-2 business, although visa decisions are made only by the relevant government authorities.",
                  id: "vertical-selection",
                },
                {
                  q: "Do I have to live in Texas?",
                  a: "No. New Dawn is headquartered in El Paso, Texas, but the platform is designed for domestic geographic flexibility. Qualified E-2 owners can live elsewhere in the United States while maintaining executive oversight of the franchise.",
                  id: "live-anywhere",
                },
                {
                  q: "Do you offer a guarantee?",
                  a: "E-2 investments must be genuinely at risk, so this page cannot promise a visa or financial result. New Dawn does use an escrow-first setup structure, and the Franchise Disclosure Document explains the refund framework if a qualifying E-2 application is denied twice.",
                  id: "guarantee",
                },
                {
                  q: "Can I see financial projections before investing?",
                  a: "Yes. Our Franchise Disclosure Document (FDD) contains Item 19, which provides detailed financial projections including expected revenue and expenses. Request our FDD today and schedule a meeting with someone from our team to walk you through the numbers.",
                  id: "fdd",
                },
                {
                  q: "Can an E-2 lead to a green card?",
                  a: "Yes. While the E-2 itself doesn't directly provide a green card, your growing franchise business can serve as a pathway to an EB-5 immigrant investor visa, which leads to permanent residency. Many investors use the E-2 as a stepping stone to the EB-5.",
                  id: "eb5-path",
                },
                {
                  q: "What is the in-house buy-back program?",
                  a: "Looking to exit your franchise after a few years? Our in-house buy-back program gives you a path to recover your investment. Invest $225K, obtain your E-2 investor visa, live in the USA, build your business — and when you're ready (typically around 4 years), we can work with you on an exit. Contact us for full details.",
                  id: "buyback-program",
                },
                {
                  q: "Can my spouse hold the E-2 visa instead of me?",
                  a: "Yes. If structured properly, your spouse can be the primary E-2 visa holder while you continue your current employment or work situation in the USA. This gives your family the visa benefits while you maintain your career. Talk to our team about how to structure this.",
                  id: "spouse-visa",
                },
                {
                  q: "Why is a franchise better than buying a standalone business for E-2 purposes?",
                  a: "Investing in an established, proven franchise system generally strengthens an E-2 visa application compared to purchasing a standalone business and hiring someone to run it. A franchise provides a documented track record, proven operating systems, training programs, and ongoing franchisor support — all of which demonstrate to adjudicators that the business is real, active, and not marginal. While this is not immigration advice, franchise investments are widely regarded by immigration professionals as a stronger foundation for E-2 approval.",
                  id: "franchise-vs-standalone",
                },
                {
                  q: "How does New Dawn help a franchise owner keep growing?",
                  a: (
                    <div>
                      <p className="mb-4">
                        New Dawn gives franchise owners access to a proprietary growth portal, centralized campaign tools, reporting dashboards, and operator support across the selected vertical. The exact workflows vary by Property Management, Telecom, or Insurance, but the goal is the same: keep your pipeline, reporting, and operating cadence visible.
                      </p>
                      <div className="grid gap-3">
                        {[
                          {
                            icon: <Printer className="size-4 text-[hsl(var(--accent))]" />,
                            title: "Vertical-specific campaigns",
                            desc: "Campaigns are tailored to the franchise lane you select instead of forcing every owner into the same sales motion.",
                          },
                          {
                            icon: <Mail className="size-4 text-[hsl(var(--accent))]" />,
                            title: "Email and SMS workflows",
                            desc: "Approved outreach sequences help your operating team nurture prospects, referral sources, and client relationships.",
                          },
                          {
                            icon: <DollarSign className="size-4 text-[hsl(var(--accent))]" />,
                            title: "Performance marketing",
                            desc: "Paid campaigns can be launched and tracked from the same owner dashboard, with budget controls and performance reporting.",
                          },
                          {
                            icon: <Globe2 className="size-4 text-[hsl(var(--accent))]" />,
                            title: "Social Media Content",
                            desc: "Content workflows keep the franchise visible without making the owner manually manage daily posting.",
                          },
                          {
                            icon: <Users className="size-4 text-[hsl(var(--accent))]" />,
                            title: "Referral networks",
                            desc: "Partner and referral relationships can be tracked through the platform so the business develops beyond one marketing channel.",
                          },
                          {
                            icon: <Bot className="size-4 text-[hsl(var(--accent))]" />,
                            title: "AI Outreach Agent",
                            desc: "Our proprietary AI supports prospect discovery, follow-up suggestions, and reporting so the owner can supervise strategy instead of chasing admin tasks.",
                          },
                        ].map((ch) => (
                          <div key={ch.title} className="flex items-start gap-3 rounded-xl border bg-white/70 p-3">
                            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary)/0.08)]">
                              {ch.icon}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{ch.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{ch.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs text-muted-foreground">
                        The portal recommends next steps based on franchise activity, and the New Dawn team helps you plan growth in the selected industry.
                      </p>
                    </div>
                  ),
                  id: "growth-support",
                },
                {
                  q: "Can I expand beyond the first franchise lane?",
                  a: "Expansion depends on the FDD, territory availability, operational readiness, and your growth plan. The platform was intentionally built as a multi-vertical system, so qualified owners can discuss broader expansion with the New Dawn team after the initial franchise is operating.",
                  id: "expand-portfolio",
                },
                {
                  q: "Do you have a referral program?",
                  a: "Yes. We offer a lucrative referral program that rewards you for introducing qualified investors to the New Dawn franchise. Contact us for full details on referral compensation.",
                  id: "referral",
                },
                {
                  q: "Can I also sell real estate as a franchise owner?",
                  a: "Yes. As a New Dawn franchise owner, you have two options: become a licensed real estate agent through our established brokerage, or simply refer buyer and seller leads to us and earn a referral commission on every closed transaction. Our brokerage has over a decade of experience and dozens of experienced agents ready to support you.",
                  id: "real-estate-agent",
                },
                {
                  q: "Do I need a real estate license to earn referral commissions?",
                  a: "No. You do not need a license to refer leads. If someone in your network is looking to buy or sell a home in the El Paso area or surrounding markets, just send the lead to our brokerage. When the deal closes, you earn a referral commission. If you do want to become a licensed agent, we provide support and guidance through the licensing process.",
                  id: "re-license",
                },
                {
                  q: "How does the marketing academy help with real estate leads?",
                  a: "The portal is designed as a broader franchise growth system, not just a property-management dashboard. Depending on your vertical, it can support campaigns, referral tracking, lead follow-up, and performance reporting from one owner-facing system.",
                  id: "re-marketing-portal",
                },
                {
                  q: "Do you work with Spanish-speaking investors?",
                  a: "Yes. We work with investors from all over the world, including Latin America and Spain. Our team speaks Spanish and can guide you through the entire process in your preferred language. All documents, calls, and support are available in both English and Spanish.",
                  id: "spanish-support",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  data-testid={`faq-item-${item.id}`}
                  className="rounded-2xl border bg-white/60 p-5 shadow-sm"
                >
                  <div data-testid={`faq-question-${item.id}`} className="text-sm font-semibold">
                    {item.q}
                  </div>
                  <div
                    data-testid={`faq-answer-${item.id}`}
                    className="mt-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    {item.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section data-testid="section-contact" id="contact" className="border-t bg-[linear-gradient(180deg,#f9fbf8_0%,#f2f7f4_42%,#eaf3ef_100%)] pb-12 pt-8 md:pb-20 md:pt-14">
          <div className="nh-container">
            <div className="mx-auto max-w-3xl rounded-3xl border bg-white/60 p-8 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/60">Get started</div>
              <h2 data-testid="text-contact-title" className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
                Request our FDD & schedule a meeting
              </h2>
              <p data-testid="text-contact-subtitle" className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
                Our Franchise Disclosure Document (FDD) includes Item 19 — detailed financial projections showing your expected revenue and expenses. Request the FDD today and book a call with someone from our team to review the opportunity together.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button data-testid="button-contact-lead" className="gap-2" asChild>
                  <a href="/contact">
                    Request FDD & book a call
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button data-testid="button-contact-attorney" variant="secondary" className="gap-2" asChild>
                  <a href="/contact?type=attorney">
                    <Mail className="size-4" />
                    I'm an Immigration Attorney
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Embassy Wait Time Modal */}
      <EmbassyCheckerModal open={embassyOpen} onClose={() => setEmbassyOpen(false)} />
    </div>
  );
}

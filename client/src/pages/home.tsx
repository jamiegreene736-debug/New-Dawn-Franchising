import { useState } from "react";
import { Link } from "wouter";
import { EmbassyCheckerModal } from "@/components/embassy-checker";

const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";

const VERTICALS = [
  {
    href: "/property-management",
    name: "Property Management",
    line: "Long-term rental operations, local execution, and owner-level reporting.",
  },
  {
    href: "/telecom",
    name: "Telecom",
    line: "Recurring-service telecom operations with centralized systems and oversight.",
  },
  {
    href: "/insurance",
    name: "Insurance",
    line: "Insurance operations built around supervision, client service, and recurring revenue.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Intro call",
    text: "We talk through your goals, treaty-country status, and which of the three businesses fits.",
  },
  {
    n: "02",
    title: "Choose a business",
    text: "Property Management, Telecom, or Insurance. One franchise. A real operating company.",
  },
  {
    n: "03",
    title: "Review the FDD",
    text: "You get the Franchise Disclosure Document, including Item 19, before you decide.",
  },
  {
    n: "04",
    title: "Setup and escrow",
    text: "Entity, agreement, and escrow. Funds stay in escrow through setup.",
  },
  {
    n: "05",
    title: "Your attorney files",
    text: "Your immigration lawyer prepares the E-2 petition. We are not your law firm.",
  },
  {
    n: "06",
    title: "You direct it",
    text: "You own the decisions. New Dawn implements the day-to-day under your direction.",
  },
];

const PEOPLE = [
  {
    name: "Dylan Delaney",
    role: "Founding member",
    line: "The person you talk to from the first call through launch.",
    image: "/dylan-headshot.png",
    calendly: true,
  },
  {
    name: "Jeffrey Tung",
    role: "Founding member",
    line: "SMB operations, private equity, and multi-market execution.",
    image: "/jeffrey-tung-headshot.jpg",
  },
  {
    name: "Chris von Pohlot",
    role: "Managing director",
    line: "Alternative finance, real estate, and capital markets.",
    image: "/chris-von-pohlot-headshot.jpg",
  },
  {
    name: "Tom Meister",
    role: "Founding member",
    line: "Fintech, specialty finance, and legal strategy.",
    image: "/tom-meister-headshot.jpg",
  },
];

const FAQS = [
  {
    q: "What is New Dawn?",
    a: "A franchisor for people who want to own and direct a U.S. business in connection with an E-2 treaty investor visa. You choose Property Management, Telecom, or Insurance. You own the company and direct it. New Dawn implements the day-to-day operations under your direction.",
  },
  {
    q: "How much do I invest?",
    a: "Franchise packages start at $225,000. There is no fixed legal minimum for an E-2, but the investment has to be substantial relative to the business. The full fee structure is in the Franchise Disclosure Document.",
  },
  {
    q: "Who actually runs the business?",
    a: "You do, as owner and director. You control the bank account, make the payments, approve hiring and major decisions, and set strategy. New Dawn implements day-to-day work and reports to you. New Dawn does not own or direct your business.",
  },
  {
    q: "Do I have to live in Texas?",
    a: "No. The platform is built so a qualified owner can live elsewhere in the United States and keep executive oversight. New Dawn is based in El Paso, Texas.",
  },
  {
    q: "What if my visa is not approved?",
    a: "Funds are held in escrow through setup. The Franchise Disclosure Document explains the refund framework if a qualifying E-2 application is denied twice. A visa is decided only by the U.S. government, and it is never guaranteed.",
  },
  {
    q: "What can I expect to earn?",
    a: "Earnings figures live in Item 19 of the Franchise Disclosure Document. They are not a promise of future results. Request the FDD to read them in full.",
  },
  {
    q: "Is this legal or immigration advice?",
    a: "No. New Dawn is a franchisor, not a law firm. E-2 eligibility is decided by the Department of State and USCIS. Talk to your own immigration attorney before you invest or file.",
  },
];

function FaqList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="nd-faq divide-y" style={{ borderColor: "rgba(12,118,243,0.16)" }}>
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex items-center justify-between gap-6 py-5 text-[17px] font-medium tracking-[-0.02em] text-[#0c76f3]"
            >
              <span>{item.q}</span>
              <span className="text-xl font-normal leading-none text-[#0c76f3]/70">{isOpen ? "–" : "+"}</span>
            </button>
            {isOpen && <p className="max-w-3xl pb-5 text-[15px] leading-relaxed text-[#4d6490]">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [embassyOpen, setEmbassyOpen] = useState(false);

  return (
    <div data-testid="page-home" className="nd-home">
      <section data-testid="section-hero" className="border-b nd-rule">
        <div className="nh-container grid items-end gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-28">
          <div>
            <p className="nd-kicker">New Dawn Franchising</p>
            <h1
              data-testid="text-hero-title"
              className="nd-display mt-4 max-w-[11em] text-[clamp(2.75rem,4.8vw,4.35rem)]"
            >
              Fast and simple <span className="whitespace-nowrap">E-2</span> franchise ownership.
            </h1>
            <p data-testid="text-hero-subtitle" className="nd-sub mt-6 max-w-xl">
              Own and direct a real U.S. business. Live anywhere in the USA. New Dawn implements the day-to-day.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a data-testid="button-hero-investor" href="/contact" className="nd-btn">
                Get started
              </a>
              <Link href="/request-fdd" className="nd-btn-ghost">
                Request the FDD
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a data-testid="button-hero-attorney" href="/contact?type=attorney" className="nd-link">
                Immigration attorney inquiry
              </a>
              <button type="button" onClick={() => setEmbassyOpen(true)} className="nd-link">
                Check embassy wait time
              </button>
            </div>
            <p className="mt-8 max-w-xl text-xs leading-relaxed text-[#4d6490]/80">
              General information only. Not an offer to sell a franchise, and not legal, immigration, tax, or financial advice. A visa is never guaranteed.
            </p>
          </div>

          <aside className="nd-board" aria-label="How the model works">
            <p className="nd-kicker px-1 pb-2">How it works</p>
            <ol>
              <li>
                <span className="nd-step-index pt-0.5">01</span>
                <div>
                  <div className="text-[17px] font-medium tracking-[-0.02em] text-[#0c76f3]">You own it</div>
                  <p className="mt-1 text-sm leading-relaxed text-[#4d6490]">The company, the bank account, and the key decisions.</p>
                </div>
              </li>
              <li>
                <span className="nd-step-index pt-0.5">02</span>
                <div>
                  <div className="text-[17px] font-medium tracking-[-0.02em] text-[#0c76f3]">You direct it</div>
                  <p className="mt-1 text-sm leading-relaxed text-[#4d6490]">Strategy, payments, hiring, and oversight — from anywhere in the U.S.</p>
                </div>
              </li>
              <li>
                <span className="nd-step-index pt-0.5">03</span>
                <div>
                  <div className="text-[17px] font-medium tracking-[-0.02em] text-[#0c76f3]">We implement it</div>
                  <p className="mt-1 text-sm leading-relaxed text-[#4d6490]">Day-to-day operations, under your direction. Not instead of you.</p>
                </div>
              </li>
            </ol>
          </aside>
        </div>
      </section>

      <section data-testid="section-trust-strip" className="border-b nd-rule">
        <div className="nh-container grid gap-10 py-16 md:grid-cols-[0.7fr_1.3fr] md:py-24">
          <div>
            <p className="nd-kicker">Three businesses</p>
            <h2 className="nd-display mt-3 text-3xl md:text-4xl">Pick one franchise.</h2>
          </div>
          <ul className="divide-y" style={{ borderColor: "rgba(12,118,243,0.16)" }}>
            {VERTICALS.map((vertical) => (
              <li key={vertical.href} className="py-5">
                <Link href={vertical.href} className="group grid gap-1 md:grid-cols-[220px_1fr] md:items-baseline md:gap-8">
                  <span className="text-xl font-medium tracking-[-0.03em] text-[#0c76f3] group-hover:underline">{vertical.name}</span>
                  <span className="text-[15px] leading-relaxed text-[#4d6490]">{vertical.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b nd-rule bg-[#f4f7ff]">
        <div className="nh-container py-16 md:py-24">
          <p className="nd-kicker">The offer, in four lines</p>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="nd-stat-num">$225k</div>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6490]">Franchise packages start here. The full picture is in the FDD.</p>
            </div>
            <div>
              <div className="nd-stat-num">Escrow</div>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6490]">Funds stay in escrow through setup. The FDD explains the refund framework.</p>
            </div>
            <div>
              <div className="nd-stat-num">3</div>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6490]">Property Management, Telecom, or Insurance. Recurring-revenue operations.</p>
            </div>
            <div>
              <div className="nd-stat-num">USA</div>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6490]">Live anywhere in the country. The business is based in El Paso, Texas.</p>
            </div>
          </div>
        </div>
      </section>

      <section data-testid="section-how" id="how-it-works" className="border-b nd-rule">
        <div className="nh-container py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="nd-kicker">From first call to an operating business</p>
            <h2 className="nd-display mt-3 text-3xl md:text-[2.6rem]">A path you can see before you start.</h2>
          </div>
          <ol className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <div className="nd-step-index">{step.n}</div>
                <h3 className="mt-2 text-xl font-medium tracking-[-0.03em] text-[#0c76f3]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4d6490]">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link href="/process" className="nd-link">
              See the full process
            </Link>
          </div>
        </div>
      </section>

      <section data-testid="section-tech" className="border-b nd-rule bg-[#f4f7ff]">
        <div className="nh-container grid gap-10 py-16 md:grid-cols-[1fr_1fr] md:items-start md:py-24">
          <div>
            <p className="nd-kicker">Technology</p>
            <h2 data-testid="text-tech-title" className="nd-display mt-3 text-3xl md:text-[2.6rem]">
              An operating system for the franchise you direct.
            </h2>
            <p className="nd-sub mt-5 max-w-xl text-base">
              Reporting, communications, marketing, and workflow tools built for New Dawn franchisees — so you can see the business without doing the daily work.
            </p>
          </div>
          <ul className="divide-y border-y" style={{ borderColor: "rgba(12,118,243,0.16)" }}>
            {[
              ["Dashboards", "See what the business is doing, without chasing updates."],
              ["Communications", "Client follow-up and service workflows, already structured."],
              ["Growth tools", "Marketing and campaign systems scoped to your vertical."],
            ].map(([title, text]) => (
              <li key={title} className="py-5">
                <div className="text-[17px] font-medium tracking-[-0.02em] text-[#0c76f3]">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-[#4d6490]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section data-testid="section-meet-dylan" className="border-b nd-rule">
        <div className="nh-container py-16 md:py-24">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="nd-kicker">People</p>
              <h2 className="nd-display mt-3 text-3xl md:text-[2.6rem]">You work with the people who built it.</h2>
            </div>
            <Link href="/team" className="nd-link">
              Meet the full team
            </Link>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PEOPLE.map((person) => (
              <article key={person.name} className="nd-person">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[#f4f7ff]">
                  <img src={person.image} alt={person.name} className="h-full w-full object-cover object-top" />
                </div>
                <h3 className="mt-4 text-[17px] font-medium tracking-[-0.02em] text-[#0c76f3]">{person.name}</h3>
                <p className="mt-1 text-sm text-[#0c76f3]/70">{person.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#4d6490]">{person.line}</p>
                {person.calendly && (
                  <a
                    data-testid="button-dylan-calendly"
                    href={CALENDLY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nd-link mt-3 inline-block text-sm"
                  >
                    Schedule with Dylan
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-quiz-cta" className="border-b nd-rule bg-[#f4f7ff]">
        <div className="nh-container flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between md:py-16">
          <div className="max-w-xl">
            <h2 className="nd-display text-3xl">Not sure this fits?</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#4d6490]">
              A two-minute readiness quiz, or a look at embassy timing for your country.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link data-testid="button-quiz-cta" href="/quiz" className="nd-btn">
              Take the quiz
            </Link>
            <button type="button" onClick={() => setEmbassyOpen(true)} className="nd-btn-ghost">
              Embassy wait times
            </button>
          </div>
        </div>
      </section>

      <section id="faq" className="border-b nd-rule">
        <div className="nh-container grid gap-10 py-16 md:grid-cols-[0.7fr_1.3fr] md:py-24">
          <div>
            <p className="nd-kicker">Questions</p>
            <h2 className="nd-display mt-3 text-3xl md:text-4xl">Clear before you call.</h2>
          </div>
          <FaqList />
        </div>
      </section>

      <section className="bg-white">
        <div className="nh-container py-20 md:py-28">
          <h2 className="nd-display max-w-[14ch] text-[clamp(2.4rem,5vw,4rem)]">Get started today.</h2>
          <p className="nd-sub mt-5 max-w-lg">
            Tell us where you are. We’ll walk through the three businesses and send the FDD when you’re ready.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/contact" className="nd-btn">
              Get started
            </a>
            <Link href="/request-fdd" className="nd-btn-ghost">
              Request the FDD
            </Link>
          </div>
        </div>
      </section>

      <EmbassyCheckerModal open={embassyOpen} onClose={() => setEmbassyOpen(false)} />
    </div>
  );
}

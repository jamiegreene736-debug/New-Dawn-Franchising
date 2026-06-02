import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import photoChris from "@assets/ChrisVonPohlot_1774713209619.jpg";
import photoTom from "@assets/TomMeister_1774713209619.jpg";
import photoKamal from "@assets/KamalObbad_1774713209619.jpg";
import photoZach from "@assets/Zach_1774713209619.jpg";
import photoDylan from "@assets/Dylan_1774713209619.jpg";

const COMPANY = {
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
};

type TeamMember = {
  id: string;
  name: string;
  badge: string;
  org: string;
  initials: string;
  photo: string | null;
  linkedin: string | null;
  website: { label: string; url: string } | null;
  bio: string;
  tags: string[];
  featured?: boolean;
};

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

const LEADERSHIP: TeamMember[] = [
  {
    id: "chris",
    name: "Chris von Pohlot",
    badge: "Managing Director",
    org: "Obtuse Ventures · Altbanc",
    initials: "CP",
    photo: photoChris,
    linkedin: "https://www.linkedin.com/in/christoph-von-pohlot-7a328990",
    website: null,
    bio: "Chris is a Columbia University–educated fintech entrepreneur with deep roots in alternative financing, real estate acquisitions, and venture investment. As the founder of Altbanc, he built an alternative lending platform helping hundreds of small and medium-sized businesses refinance high-cost merchant cash advance debt — a model directly applicable to the capital-efficient franchise ecosystem New Dawn is building. His background spans acquisitions and asset management at The Bascom Group and financial analysis at Eastdil Secured, giving him a rare combination of real estate and capital markets expertise.",
    tags: ["Alternative Finance", "Venture Investment", "Real Estate", "Capital Markets", "SMB Lending"],
    featured: true,
  },
];

const ADVISORS: TeamMember[] = [
  {
    id: "tom",
    name: "Tom Meister",
    badge: "Founding Member",
    org: "Grizzly Peak Ventures · Brightpoint Law",
    initials: "TM",
    photo: photoTom,
    linkedin: "https://www.linkedin.com/in/eastbaytom/",
    website: { label: "Website", url: "https://www.grizzlypeakventures.com" },
    bio: "Tom is an entrepreneur, investor, and attorney operating at the intersection of capital markets and financial technology. After beginning his career at Wilson Sonsini and Goodwin Procter, he took on executive roles at three venture-backed online lenders — including Funding Circle, NepFin, and Zilch, two of which achieved unicorn status. Today he leads Grizzly Peak Ventures, a fintech and specialty finance venture studio, and co-founded Brightpoint Law, LLP. His skills in venture capital and strategic planning are invaluable for structuring investments and ensuring financial stability for the franchise network.",
    tags: ["Fintech", "Specialty Finance", "Venture Studio", "Corporate Law"],
  },
  {
    id: "kamal",
    name: "Kamal Obbad",
    badge: "Founding Member",
    org: "Nebula Genomics · Forbes 30 Under 30",
    initials: "KO",
    photo: photoKamal,
    linkedin: "https://www.linkedin.com/in/kamal-obbad-5757597784",
    website: null,
    bio: "Kamal is a Harvard graduate and Gates-Cambridge Scholar who co-founded Nebula Genomics, a genomic data platform backed by Khosla Ventures, Arch Venture Partners, and Mayfield. Previously a product manager at Google within Google Research and ChromeOS, he was recognized as a Forbes 30 Under 30 honoree in Healthcare. His track record of building and scaling data-driven technology ventures brings investor credibility and technological sophistication to New Dawn's operational infrastructure.",
    tags: ["Biotech & Data", "Google", "Forbes 30U30", "Venture-Backed Founder"],
  },
  {
    id: "zachary",
    name: "Zachary Bohlender",
    badge: "Founding Member",
    org: "Brightpoint Law · Charta Ventures",
    initials: "ZB",
    photo: photoZach,
    linkedin: "https://www.linkedin.com/in/zachary-bohlender/",
    website: { label: "Website", url: "https://www.brightpoint.law" },
    bio: "Zachary is a UC Berkeley–trained attorney and entrepreneur with a career spanning Wilson Sonsini Goodrich & Rosati (M&A for Twitter, Astex), entertainment law at King Holmes Paterno & Soriano, and the founding of two ventures — Charta Ventures, a legal-tech platform for creators, and Brightpoint Law, LLP. His dual expertise in transactional law and company formation gives New Dawn access to best-in-class legal structuring for franchise disclosure documents, franchise agreements, and multi-state compliance.",
    tags: ["Franchise Law", "M&A / Corporate", "IP & Compliance", "Legal Tech"],
  },
  {
    id: "dylan",
    name: "Dylan Delaney",
    badge: "Founding Member",
    org: "Investor · Texas Markets",
    initials: "DD",
    photo: photoDylan,
    linkedin: "https://www.linkedin.com/in/dylanmdelaney",
    website: null,
    bio: "Dylan brings boots-on-the-ground experience in Texas's high-growth business markets, with a career spanning Houston and Austin across sales, business development, and investment. His firsthand exposure to the Texas SMB landscape — one of New Dawn's primary target markets for E-2 Visa franchisee placement — gives him an operational lens that complements the financial and legal expertise of the broader investor group.",
    tags: ["Texas Markets", "Business Development", "SMB Operations"],
  },
  {
    id: "kevin",
    name: "Kevin Quinn",
    badge: "Technological Infrastructure",
    org: "Google · Nebula Genomics",
    initials: "KQ",
    photo: null,
    linkedin: null,
    website: null,
    bio: "Kevin leads technological infrastructure strategy for New Dawn. A University of Washington Master of Engineering graduate, former Product Manager at Google, and co-founder/CTO of Nebula Genomics, he brings senior product and systems architecture experience to the dashboards, automation, and operational tooling that support New Dawn franchise owners.",
    tags: ["Google", "Systems Architecture", "Product Leadership", "Nebula Genomics"],
  },
  {
    id: "jeffrey",
    name: "Jeffrey Tung",
    badge: "Founding Member",
    org: "SMB Operations · Private Equity",
    initials: "JT",
    photo: "/jeffrey-tung-profile.svg",
    linkedin: null,
    website: null,
    bio: "Jeffrey is a private equity operator and Co-Founder & Partner at CPS Capital, where he works with small and medium-sized businesses on growth, execution, and operating discipline. His background across private equity, board oversight, and management-team partnerships strengthens New Dawn's ability to standardize local execution while franchise owners maintain executive and supervisory control of their enterprise.",
    tags: ["SMB Operations", "Private Equity", "Board Oversight", "Operational Scale"],
  },
];

function MemberCard({ member, featured = false }: { member: TeamMember; featured?: boolean }) {
  return (
    <div
      data-testid={`card-team-${member.id}`}
      className={
        "group flex flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl " +
        (featured ? "md:col-span-2 md:flex-row" : "")
      }
    >
      <div
        className={
          "relative overflow-hidden bg-[hsl(var(--primary))] " +
          (featured ? "md:w-[260px] md:shrink-0 aspect-[4/3] md:aspect-auto" : "aspect-[4/3]")
        }
      >
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const sibling = target.nextElementSibling as HTMLElement;
              if (sibling) sibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-center text-[hsl(var(--accent))] opacity-40"
          style={{ display: member.photo ? "none" : "flex" }}
        >
          <span className="font-serif text-6xl font-semibold">{member.initials}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex-1 p-7">
          <span className="inline-block rounded-sm border border-[hsl(var(--accent))] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[hsl(var(--accent))]">
            {member.badge}
          </span>
          <div className="mt-3 font-serif text-2xl font-medium leading-tight text-[hsl(var(--primary))]">
            {member.name}
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {member.org}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground/70">{member.bio}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {member.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 bg-[hsl(var(--primary))]/5 px-3 py-1 text-[11px] text-foreground/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-black/[0.05] px-7 py-4">
          {member.website && (
            <a
              href={member.website.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium tracking-wide text-muted-foreground transition-colors hover:text-[hsl(var(--accent))]"
            >
              {member.website.label}
            </a>
          )}
          {member.linkedin && (
            <a
              href={member.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground transition-colors hover:text-[hsl(var(--accent))]"
            >
              <LinkedInIcon className="size-3.5" />
              LinkedIn
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <div data-testid="page-team" className="min-h-screen">
      <section
        data-testid="section-team-hero"
        className="relative overflow-hidden bg-[hsl(var(--primary))] px-6 py-10 text-center md:py-14"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 30% 60%, rgba(201,168,76,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 75% 30%, rgba(201,168,76,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
            New Dawn Franchising™
          </div>
          <h1 className="mt-3 font-serif text-4xl font-medium leading-[1.1] text-white md:text-5xl">
            The People Behind{" "}
            <em className="italic text-[hsl(var(--accent))]">New Dawn</em>
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-white/60 md:text-base">
            A multi-vertical franchise platform built for E-2 Treaty Investor Visa applicants, with operating models across Property Management, Telecom, and Insurance.
          </p>
          <div className="mx-auto mt-5 h-0.5 w-10 bg-[hsl(var(--accent))] opacity-70" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-8 mx-auto max-w-3xl rounded-2xl border bg-white/60 p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Our leadership team brings deep expertise in recurring-revenue operations, U.S. franchise law, technology infrastructure, capital markets, and E-2 visa business compliance. New Dawn was built for investors who need a real operating enterprise with clear executive oversight and professional day-to-day execution.
          </p>
        </div>
        <div className="mb-12 flex items-center gap-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--accent))]">
            Leadership &amp; Founding Partners
          </span>
          <div className="h-px flex-1 bg-[hsl(var(--accent))]/20" />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {LEADERSHIP.map((m) => (
            <MemberCard key={m.id} member={m} featured={m.featured} />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-12 flex items-center gap-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--accent))]">
            Strategic Investors &amp; Advisors
          </span>
          <div className="h-px flex-1 bg-[hsl(var(--accent))]/20" />
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {ADVISORS.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      </div>

      <section data-testid="section-team-cta" className="border-t py-8 md:py-20">
        <div className="mx-auto max-w-2xl px-6 rounded-3xl text-center">
          <h2 data-testid="team-cta-title" className="text-2xl font-semibold md:text-3xl">
            Ready to talk?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Our team is here to answer your questions and help you explore whether New Dawn is the right fit.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button data-testid="button-team-contact" className="gap-2" asChild>
              <Link href="/contact">
                Request info
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button data-testid="button-team-phone" variant="secondary" className="gap-2" asChild>
              <a href={`tel:${COMPANY.phoneTel}`}>
                <Phone className="size-4" />
                Call {COMPANY.phone}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

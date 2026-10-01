import type { BlogPost } from "@shared/schema";

/**
 * Centralized Schema.org / JSON-LD structured data builders.
 *
 * AI answer engines (ChatGPT/SearchGPT, Perplexity, Gemini, Claude) and Google's
 * AI Overviews lean heavily on structured data to understand and cite a site.
 * These nodes are emitted as a single `@graph` so the entities cross-reference
 * each other by `@id`.
 */

export const SITE_URL = "https://www.newdawnfranchising.com";
export const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
export const LOGO_URL = `${SITE_URL}/favicon.png`;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const SAME_AS = [
  "https://www.facebook.com/profile.php?id=61588637044169",
];

const ORG_DESCRIPTION =
  "New Dawn Franchising is a multi-vertical franchisor specializing in E-2 Treaty Investor Visa-qualifying franchises. " +
  "Investors choose from three recurring-revenue industries — Property Management, Telecom, or Insurance. " +
  "The franchisee owns, develops, and directs the business: they control the business bank account, make all payments, " +
  "approve hiring and major decisions, and set strategy. New Dawn implements the day-to-day operations under the franchisee's direction. " +
  "Franchise investment from $225,000. Headquartered in El Paso, Texas. FDD available upon request.";

/** Primary entity: the franchisor, typed as both Organization and LocalBusiness. */
export function organizationNode(): Record<string, unknown> {
  return {
    "@type": ["Organization", "LocalBusiness"],
    "@id": ORG_ID,
    name: "New Dawn Franchising LLC",
    alternateName: "New Dawn Franchising",
    legalName: "New Dawn Franchising LLC",
    slogan: "Three industries. One E-2 platform.",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: LOGO_URL },
    image: OG_IMAGE,
    description: ORG_DESCRIPTION,
    telephone: "+13465979994",
    email: "franchising@newdawnfranchising.com",
    priceRange: "$$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "2601 N Zaragoza Rd",
      addressLocality: "El Paso",
      addressRegion: "TX",
      postalCode: "79938",
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 31.8173,
      longitude: -106.3317,
    },
    openingHours: "Mo-Fr 09:00-18:00",
    areaServed: { "@type": "Country", name: "United States" },
    founder: { "@type": "Person", name: "Chris Von Pohlot" },
    knowsAbout: [
      "E-2 Treaty Investor Visa",
      "Franchising for international investors",
      "Property management franchising",
      "Telecom franchising",
      "Insurance franchising",
      "Recurring-revenue business ownership",
    ],
    sameAs: SAME_AS,
  };
}

/** The site itself, published by the organization. */
export function websiteNode(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: "New Dawn Franchising",
    description: ORG_DESCRIPTION,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };
}

/** The lead opportunity described on the homepage, without unverified package pricing. */
export function franchiseServiceNode(): Record<string, unknown> {
  return {
    "@type": "Service",
    "@id": `${SITE_URL}/#franchise-offer`,
    name: "Property Management Franchise",
    serviceType: "Property management franchise with operational support",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "United States" },
    url: `${SITE_URL}/`,
    description:
      "Own and actively direct a property management franchise while New Dawn supports the day-to-day work, " +
      "training, technology, and local operations. Review investment details in the current FDD. " +
      "E-2 eligibility requires individual legal assessment; franchise ownership does not guarantee visa approval.",
  };
}

export type FaqItem = { question: string; answer: string };

/** FAQPage — the highest-leverage schema for AI answer engines. */
export function faqNode(faqs: FaqItem[]): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

type TeamMember = { name: string; jobTitle: string; image?: string };

const TEAM: TeamMember[] = [
  { name: "Chris Von Pohlot", jobTitle: "Managing Director", image: `${SITE_URL}/chris-von-pohlot-headshot.jpg` },
  { name: "Tom Meister", jobTitle: "Advisor, Founding Member", image: `${SITE_URL}/tom-meister-headshot.jpg` },
  { name: "Kamal Obbad", jobTitle: "Advisor, Founding Member", image: `${SITE_URL}/kamal-obbad-headshot.jpg` },
  { name: "Zachary Bohlender", jobTitle: "Advisor, Founding Member", image: `${SITE_URL}/zachary-bohlender-headshot.jpg` },
  { name: "Dylan Delaney", jobTitle: "Advisor, Founding Member", image: `${SITE_URL}/dylan-headshot.png` },
  // Kevin Hatch intentionally omits an image — no matching headshot asset is present.
  { name: "Kevin Hatch", jobTitle: "Advisor, Founding Member" },
];

/** Person schema for each leadership team member. */
export function teamNodes(): Record<string, unknown>[] {
  return TEAM.map((m) => ({
    "@type": "Person",
    name: m.name,
    jobTitle: m.jobTitle,
    worksFor: { "@id": ORG_ID },
    ...(m.image ? { image: m.image } : {}),
  }));
}

/** BlogPosting/Article schema for an individual blog post. */
export function articleNode(post: BlogPost, url: string): Record<string, unknown> {
  const published = new Date(post.publishedAt).toISOString();
  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.excerpt,
    url,
    datePublished: published,
    dateModified: published,
    image: post.coverImageUrl ? absoluteUrl(post.coverImageUrl) : OG_IMAGE,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

export type Crumb = { name: string; url: string };

export function breadcrumbNode(items: Crumb[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Wrap a set of nodes into a JSON-LD document, safe to embed in <script>. */
export function renderJsonLd(graph: Record<string, unknown>[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    // Prevent a stray "</script>" inside content from breaking out of the tag.
    .replace(/</g, "\\u003c");
}

export function absoluteUrl(maybeRelative: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  return `${SITE_URL}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

import { type PageShell, getPageShell, defaultShell } from "./page-shells";

const SITE_URL = "https://newdawnfranchising.com";

const ORG_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "New Dawn Franchising LLC",
  alternateName: "New Dawn Franchising",
  description:
    "Property management franchise built specifically for E-2 visa investors. Franchise packages from $250,000. FDD available upon request.",
  url: SITE_URL,
  telephone: "+13465979994",
  email: "dylan@newdawnfranchising.com",
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
  priceRange: "$$$",
  openingHours: "Mo-Fr 09:00-18:00",
  sameAs: ["https://www.facebook.com/profile.php?id=61588637044169"],
});

export function injectShell(html: string, pathname: string): string {
  const shell: PageShell = getPageShell(pathname) ?? defaultShell;
  const canonicalUrl = `${SITE_URL}${pathname === "/" ? "" : pathname}`;

  // Update <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${shell.title}</title>`);

  // Update meta description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(shell.description)}" />`
  );

  // Update og:title
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeAttr(shell.title)}" />`
  );

  // Update og:description
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeAttr(shell.description)}" />`
  );

  // Update twitter:title
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeAttr(shell.title)}" />`
  );

  // Update twitter:description
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeAttr(shell.description)}" />`
  );

  // Add canonical URL and JSON-LD before </head>
  const headInsert = [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    pathname === "/" || pathname === "/about" || pathname === "/contact"
      ? `<script type="application/ld+json">${ORG_SCHEMA}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  html = html.replace("</head>", `    ${headInsert}\n  </head>`);

  // Inject HTML content into <div id="root"> — visually hidden for users,
  // readable by search crawlers. React clears this on mount.
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"><div data-seo-shell style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;" aria-hidden="true">${shell.html}</div></div>`
  );

  return html;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

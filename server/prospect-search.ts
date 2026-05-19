interface SerpApiResult {
  title?: string;
  link?: string;
  snippet?: string;
  phone?: string;
  address?: string;
}

interface SerpApiLocalResult {
  title?: string;
  link?: string;
  phone?: string;
  address?: string;
  website?: string;
  type?: string;
  rating?: number;
  reviews?: number;
}

interface ParsedProspect {
  name: string;
  company: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  source: string;
  sourceUrl: string | null;
  snippet?: string | null;
}

const SEARCH_CATEGORIES = [
  { id: "immigration_attorney", label: "Immigration Attorneys", query: "immigration attorney E-2 visa" },
  { id: "e2_visa_firm", label: "E-2 Visa Consulting Firms", query: "E-2 visa consulting firm investor visa" },
  { id: "business_broker", label: "Business Brokers (International)", query: "international business broker investor visa franchise" },
  { id: "immigration_consultant", label: "Immigration Consultants", query: "immigration consultant investor visa E2" },
  { id: "franchise_consultant", label: "Franchise Consultants", query: "franchise consultant international investors" },
  { id: "cpa_international", label: "CPAs (International Tax)", query: "CPA international tax investor visa business" },
  { id: "relocation_service", label: "Relocation Services", query: "international relocation service investor visa USA" },
];

export { SEARCH_CATEGORIES };

/**
 * Extract a phone number from a text snippet.
 * Handles US, international (E.164 +CC), and compact international formats.
 * Priority: international (starts with +) → US 10-digit → any 10-digit string.
 */
function extractPhone(text: string): string | null {
  // International E.164: +1-XXX-XXX-XXXX, +971-5X-XXX-XXXX, +91-9X-XXXX-XXXX …
  const intlRe = /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{1,4}[\s.\-]?\d{1,9}/g;
  const intlMatches = text.match(intlRe) || [];
  const intl = intlMatches.find(m => m.replace(/\D/g, "").length >= 10);
  if (intl) return intl.trim();

  // US domestic: (area) prefix-line or NXX-NXX-XXXX
  const usRe = /(?:\(?\d{3}\)?[\s.\-])?\d{3}[\s.\-]\d{4}/g;
  const usMatches = text.match(usRe) || [];
  const us = usMatches.find(m => m.replace(/\D/g, "").length >= 10);
  return us ? us.trim() : null;
}

function extractEmail(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0] : null;
}

export async function searchByFreeQuery(query: string, maxResults = 10): Promise<ParsedProspect[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not configured");

  const prospects: ParsedProspect[] = [];

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: String(Math.min(maxResults, 20)),
  });

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (res.ok) {
      const data = await res.json();
      const organicResults: SerpApiResult[] = data.organic_results || [];
      for (const r of organicResults) {
        if (r.title && r.link) {
          prospects.push({
            name: r.title.replace(/ - .*$/, "").replace(/\|.*$/, "").trim(),
            company: r.title.replace(/ - .*$/, "").replace(/\|.*$/, "").trim(),
            phone: r.phone || (r.snippet ? extractPhone(r.snippet) : null),
            website: r.link,
            address: null,
            source: "Google Search",
            sourceUrl: r.link,
            snippet: r.snippet || null,
          });
        }
      }
    }
  } catch (err) {
    console.error("Free query search failed:", err);
  }

  return prospects;
}

export async function searchProspects(
  categoryId: string,
  location: string,
  startOffset: number = 0
): Promise<ParsedProspect[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY is not configured");
  }

  const category = SEARCH_CATEGORIES.find(c => c.id === categoryId);
  if (!category) {
    throw new Error(`Unknown category: ${categoryId}`);
  }

  const query = `${category.query} ${location}`;
  const prospects: ParsedProspect[] = [];

  const localParams = new URLSearchParams({
    engine: "google_maps",
    q: query,
    api_key: apiKey,
    type: "search",
    start: String(startOffset),
  });

  try {
    const localRes = await fetch(`https://serpapi.com/search.json?${localParams}`);
    if (localRes.ok) {
      const localData = await localRes.json();
      const localResults: SerpApiLocalResult[] = localData.local_results || [];
      for (const r of localResults) {
        if (r.title) {
          prospects.push({
            name: r.title,
            company: r.title,
            phone: r.phone || null,
            website: r.website || r.link || null,
            address: r.address || null,
            source: "Google Maps",
            sourceUrl: r.link || null,
          });
        }
      }
    }
  } catch (err) {
    console.error("Google Maps search failed, falling back to regular search:", err);
  }

  if (prospects.length < 5) {
    const webParams = new URLSearchParams({
      engine: "google",
      q: query,
      api_key: apiKey,
      num: "20",
      start: String(startOffset),
    });

    try {
      const webRes = await fetch(`https://serpapi.com/search.json?${webParams}`);
      if (webRes.ok) {
        const webData = await webRes.json();
        const organicResults: SerpApiResult[] = webData.organic_results || [];
        for (const r of organicResults) {
          if (r.title && r.link) {
            const existingUrls = new Set(prospects.map(p => p.website?.replace(/\/$/, '').toLowerCase()));
            const cleanLink = r.link.replace(/\/$/, '').toLowerCase();
            if (existingUrls.has(cleanLink)) continue;

            const phone = r.phone || (r.snippet ? extractPhone(r.snippet) : null);
            prospects.push({
              name: r.title.replace(/ - .*$/, '').replace(/\|.*$/, '').trim(),
              company: r.title.replace(/ - .*$/, '').replace(/\|.*$/, '').trim(),
              phone,
              website: r.link,
              address: null,
              source: "Google Search",
              sourceUrl: r.link,
              snippet: r.snippet || null,
            });
          }
        }
      }
    } catch (err) {
      console.error("Web search failed:", err);
    }
  }

  return prospects;
}

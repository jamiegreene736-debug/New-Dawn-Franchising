/**
 * Whitepages Pro v3.3 — Person Lookup Service
 *
 * Inputs (all optional except at least one name or email):
 *   first_name, last_name, email_address, address.city,
 *   address.state_code, address.postal_code, phone.phone_number
 *
 * API docs: https://pro.whitepages.com/developer/documentation/person-lookup-api/
 *
 * Best for: US-based individuals. Excellent for returning current phone numbers
 * and mailing addresses from public records + data-broker aggregations.
 * Email-guided lookups dramatically reduce false positives.
 */

const WP_BASE  = "https://proapi.whitepages.com/3.3/person";
const WP_PHONE = "https://proapi.whitepages.com/3.3/phone.json";

// ─── Response shapes ──────────────────────────────────────────────────────────

interface WPPhone {
  phone_number?: string;
  line_type?: string;   // "Mobile" | "Landline" | "NonFixedVOIP" | "FixedVOIP"
  is_valid?: boolean;
  is_prepaid?: boolean;
  contact_type?: string; // "Personal" | "Business"
}

interface WPAddress {
  street_line_1?: string;
  street_line_2?: string;
  city?: string;
  postal_city?: string;
  state_code?: string;
  postal_code?: string;
  country_code?: string;
  is_active?: boolean;
}

interface WPPerson {
  name?: { first_name?: string; middle_name?: string; last_name?: string };
  age_range?: string;
  gender?: string;
  phones?: WPPhone[];
  current_addresses?: WPAddress[];
  associated_people?: Array<{ name?: string; relation?: string }>;
}

interface WPResponse {
  persons?: WPPerson[];
  messages?: { person_lookup_result?: string };
  error?: { name?: string; message?: string; code?: string };
}

// ─── Public result shape ──────────────────────────────────────────────────────

export interface WhitepagesResult {
  found: boolean;
  matchQuality: "exact" | "partial" | "none";
  phone?: string;          // best mobile/personal phone
  allPhones?: string[];    // all valid numbers returned
  address?: string;        // formatted current address
  rawAddress?: WPAddress;  // full address fields
  ageRange?: string;
  gender?: string;
  source: "whitepages";
}

// ─── Lookup inputs ────────────────────────────────────────────────────────────

export interface WhitepagesLookupInput {
  firstName: string;
  lastName: string;
  email?: string;          // improves match precision significantly
  city?: string;
  stateCode?: string;      // 2-letter, e.g. "TX"
  postalCode?: string;
  phone?: string;          // provide if you have it — further pins the record
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickBestPhone(phones: WPPhone[]): string | null {
  const valid = phones.filter(p => p.is_valid !== false && p.phone_number);
  const all = valid.length ? valid : phones.filter(p => p.phone_number);
  const priority = ["Mobile", "NonFixedVOIP", "FixedVOIP", "Landline"];
  for (const lineType of priority) {
    const hit = all.find(p => p.line_type === lineType);
    if (hit?.phone_number) return hit.phone_number;
  }
  return all[0]?.phone_number ?? null;
}

function formatAddress(addr: WPAddress): string {
  const parts: string[] = [];
  if (addr.street_line_1) parts.push(addr.street_line_1);
  if (addr.street_line_2) parts.push(addr.street_line_2);
  const city = addr.city || addr.postal_city;
  const cityState: string[] = [];
  if (city) cityState.push(city);
  if (addr.state_code) cityState.push(addr.state_code);
  if (cityState.length) parts.push(cityState.join(", "));
  if (addr.postal_code) parts.push(addr.postal_code);
  return parts.join(", ");
}

// ─── Core lookup function ─────────────────────────────────────────────────────

/**
 * Look up a US person by name (+ optionally email, location, phone).
 * Returns the best available phone number and current mailing address.
 *
 * Uses 1 Whitepages API credit per call. Only call for US-based individuals.
 */
export async function whitePageslookup(
  input: WhitepagesLookupInput
): Promise<WhitepagesResult> {
  const apiKey = process.env.WHITEPAGES_API_KEY;
  if (!apiKey) {
    return { found: false, matchQuality: "none", source: "whitepages" };
  }

  const params = new URLSearchParams({ api_key: apiKey });
  if (input.firstName) params.set("first_name", input.firstName);
  if (input.lastName)  params.set("last_name", input.lastName);
  if (input.email)     params.set("email_address", input.email);
  if (input.city)      params.set("address.city", input.city);
  if (input.stateCode) params.set("address.state_code", input.stateCode);
  if (input.postalCode) params.set("address.postal_code", input.postalCode);
  if (input.phone) {
    const clean = input.phone.replace(/\D/g, "");
    params.set("phone.phone_number", clean);
  }

  try {
    const res = await fetch(`${WP_BASE}?${params}`, {
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      console.warn(`[Whitepages] HTTP ${res.status} for ${input.firstName} ${input.lastName}`);
      return { found: false, matchQuality: "none", source: "whitepages" };
    }

    const data = await res.json() as WPResponse;

    if (data.error) {
      console.warn(`[Whitepages] API error: ${data.error.name} — ${data.error.message}`);
      return { found: false, matchQuality: "none", source: "whitepages" };
    }

    const lookupResult = data.messages?.person_lookup_result;
    const matchQuality: WhitepagesResult["matchQuality"] =
      lookupResult === "match" ? "exact" :
      lookupResult === "partial_match" ? "partial" : "none";

    if (matchQuality === "none" || !data.persons?.length) {
      return { found: false, matchQuality: "none", source: "whitepages" };
    }

    const wp = data.persons[0];

    // Best phone
    const phone = wp.phones?.length ? pickBestPhone(wp.phones) ?? undefined : undefined;
    const allPhones = (wp.phones ?? [])
      .filter(p => p.phone_number && p.is_valid !== false)
      .map(p => p.phone_number as string);

    // Best address (prefer active)
    const addr = (wp.current_addresses ?? []).find(a => a.is_active !== false)
      ?? wp.current_addresses?.[0];
    const address = addr ? formatAddress(addr) : undefined;

    return {
      found: true,
      matchQuality,
      phone,
      allPhones: allPhones.length ? allPhones : undefined,
      address,
      rawAddress: addr,
      ageRange: wp.age_range,
      gender: wp.gender,
      source: "whitepages",
    };
  } catch (err: any) {
    console.warn(`[Whitepages] Lookup failed for ${input.firstName} ${input.lastName}: ${err.message}`);
    return { found: false, matchQuality: "none", source: "whitepages" };
  }
}

/**
 * Enrich an array of people in-place using Whitepages.
 * Only runs for people missing phone or address.
 * Passes email when available to improve match accuracy.
 * Capped at `maxLookups` (default 10) to control credit usage.
 */
export async function enrichPeopleFromWhitepages<
  T extends {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    country?: string | null;
    sources?: string[];
  }
>(people: T[], maxLookups = 10): Promise<void> {
  if (!process.env.WHITEPAGES_API_KEY) return;

  // Only US / unknown country
  const usOnly = people.filter(p => {
    const c = (p.country ?? "").toLowerCase();
    return !c || c.includes("united states") || c.includes("usa") || c === "us";
  });

  // Prioritize: missing phone AND address > missing phone only > missing address only
  const priority = [
    ...usOnly.filter(p => !p.phone && !p.address),
    ...usOnly.filter(p => !p.phone && p.address),
    ...usOnly.filter(p => p.phone && !p.address),
  ];

  const seen = new Set<string>();
  const queue: T[] = [];
  for (const p of priority) {
    const key = `${p.firstName}|${p.lastName}|${p.email ?? ""}`;
    if (!seen.has(key)) { seen.add(key); queue.push(p); }
    if (queue.length >= maxLookups) break;
  }

  if (!queue.length) return;
  console.log(`[Whitepages] Enriching ${queue.length} people (cap: ${maxLookups})`);

  await Promise.all(queue.map(async (person) => {
    const result = await whitePageslookup({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email ?? undefined,
    });

    if (!result.found) return;

    if (!person.phone && result.phone) {
      person.phone = result.phone;
      if (person.sources && !person.sources.includes("whitepages")) {
        person.sources.push("whitepages");
      }
    }
    if (!person.address && result.address) {
      person.address = result.address;
      if (person.sources && !person.sources.includes("whitepages")) {
        person.sources.push("whitepages");
      }
    }
  }));
}

// ─── Reverse phone lookup ─────────────────────────────────────────────────────

export interface PhoneVerificationResult {
  valid: boolean;
  lineType?: string;         // "Mobile" | "Landline" | "NonFixedVOIP" | "FixedVOIP"
  carrier?: string;
  isPrepaid?: boolean;
  subscriberName?: string;   // Name on the account — use to verify ownership
  subscriberAddress?: string;
  nameMatchScore?: number;   // 0–100 fuzzy match against the expected name
  nameMatches?: boolean;     // true if score >= 70
  canonicalNumber?: string;  // E.164 formatted
  source: "whitepages";
}

/**
 * Verify a phone number and optionally cross-check it against an expected owner.
 *
 * Uses Whitepages Pro /3.3/phone.json endpoint (1 credit per call).
 * Returns subscriber name, line type, carrier, and optional name match.
 *
 * @param rawPhone   - Any format phone number (10-digit US, E.164, etc.)
 * @param expectName - Optional "FirstName LastName" to cross-verify ownership
 */
export async function whitepagesVerifyPhone(
  rawPhone: string,
  expectName?: string
): Promise<PhoneVerificationResult> {
  const apiKey = process.env.WHITEPAGES_API_KEY;
  if (!apiKey) {
    return { valid: false, source: "whitepages" };
  }

  const digits = rawPhone.replace(/\D/g, "");
  if (!digits || digits.length < 10) {
    return { valid: false, source: "whitepages" };
  }

  const params = new URLSearchParams({ phone_number: digits, api_key: apiKey });

  try {
    const res = await fetch(`${WP_PHONE}?${params}`, {
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      console.warn(`[Whitepages Phone] HTTP ${res.status} for ${rawPhone}`);
      return { valid: false, source: "whitepages" };
    }

    const data = await res.json() as {
      phone_number?: string;
      is_valid?: boolean;
      line_type?: string;
      carrier?: { name?: string };
      is_prepaid?: boolean;
      belongs_to?: Array<{
        name?: { first_name?: string; last_name?: string; full_name?: string };
        confidence?: string;
        current_addresses?: WPAddress[];
      }>;
      error?: { name?: string; message?: string };
    };

    if (data.error) {
      console.warn(`[Whitepages Phone] API error: ${data.error.name} — ${data.error.message}`);
      return { valid: false, source: "whitepages" };
    }

    if (!data.is_valid) {
      return { valid: false, lineType: data.line_type, source: "whitepages" };
    }

    // Subscriber info from the top-confidence match
    const subscriber = data.belongs_to?.[0];
    const subscriberName = subscriber?.name?.full_name
      ?? (subscriber?.name?.first_name && subscriber?.name?.last_name
        ? `${subscriber.name.first_name} ${subscriber.name.last_name}`
        : undefined);

    const subAddr = subscriber?.current_addresses?.[0];
    const subscriberAddress = subAddr ? formatAddress(subAddr) : undefined;

    // Fuzzy name match against expected owner
    let nameMatchScore: number | undefined;
    let nameMatches: boolean | undefined;
    if (expectName && subscriberName) {
      nameMatchScore = fuzzyNameScore(expectName, subscriberName);
      nameMatches = nameMatchScore >= 70;
    }

    return {
      valid: true,
      lineType: data.line_type,
      carrier: data.carrier?.name,
      isPrepaid: data.is_prepaid,
      subscriberName,
      subscriberAddress,
      nameMatchScore,
      nameMatches,
      canonicalNumber: data.phone_number,
      source: "whitepages",
    };
  } catch (err: any) {
    console.warn(`[Whitepages Phone] Lookup failed for ${rawPhone}: ${err.message}`);
    return { valid: false, source: "whitepages" };
  }
}

/** Simple fuzzy name match: compares lower-cased tokens, returns 0–100 */
function fuzzyNameScore(a: string, b: string): number {
  const tokA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const tokB = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokA.length || !tokB.length) return 0;
  let matched = 0;
  for (const t of tokA) {
    if (tokB.some(s => s === t || s.startsWith(t) || t.startsWith(s))) matched++;
  }
  return Math.round((matched / Math.max(tokA.length, tokB.length)) * 100);
}

export type PhoneType = "mobile" | "landline" | "voip" | "unknown" | "unverified";

export interface PhoneLookupResult {
  phone: string;
  valid: boolean;
  type: PhoneType;
  carrier: string | null;
  nationalFormat: string | null;
  countryCode: string | null;
  configured: boolean;
  error?: string;
}

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

export function getTwilioLookupStatus() {
  return { configured: !!(TWILIO_SID && TWILIO_TOKEN) };
}

function formatPhoneNumber(raw: string): { e164: string; national: string | null; country: string | null } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { e164: raw, national: null, country: null };
  if (digits.length === 10) {
    return {
      e164: `+1${digits}`,
      national: `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`,
      country: "US",
    };
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return {
      e164: `+${digits}`,
      national: `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`,
      country: "US",
    };
  }
  return { e164: raw.startsWith("+") ? raw : `+${digits}`, national: raw, country: null };
}

/**
 * Live phone validation via the Twilio Lookup v2 API (Line Type Intelligence):
 * tells us whether the number is real/allocatable ("deliverable") and its line
 * type (mobile/landline/voip) + carrier. Costs ~$0.008 per lookup. Requires
 * TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN — returns configured:false otherwise.
 */
export async function lookupPhone(rawPhone: string): Promise<PhoneLookupResult> {
  const { e164, national, country } = formatPhoneNumber(rawPhone);
  const base: PhoneLookupResult = {
    phone: e164, valid: false, type: "unverified", carrier: null,
    nationalFormat: national, countryCode: country, configured: true,
  };
  if (!TWILIO_SID || !TWILIO_TOKEN) return { ...base, configured: false };
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(9000),
    });
    // Twilio 404 = the number isn't a valid/allocatable phone number.
    if (res.status === 404) return { ...base, valid: false, type: "unknown" };
    if (!res.ok) return { ...base, type: "unverified", error: `Twilio lookup HTTP ${res.status}` };
    const j: any = await res.json();
    const lt = j.line_type_intelligence || {};
    const rawType = String(lt.type || "").toLowerCase();
    const type: PhoneType =
      rawType.includes("mobile") ? "mobile"
      : rawType.includes("landline") || rawType.includes("fixed") ? "landline"
      : rawType.includes("voip") || rawType.includes("nonFixedVoip".toLowerCase()) ? "voip"
      : "unknown";
    return {
      phone: j.phone_number || e164,
      valid: j.valid !== false,
      type,
      carrier: lt.carrier_name || null,
      nationalFormat: j.national_format || national,
      countryCode: j.country_code || country,
      configured: true,
    };
  } catch (err: any) {
    return { ...base, type: "unverified", error: err?.message || "lookup failed" };
  }
}

export function validateAddressFormat(
  address: string | null
): "valid" | "partial" | "international" | "invalid" | "unknown" {
  if (!address || address.trim().length < 5) return "unknown";

  const a = address.trim();

  // Detect likely international (non-US) addresses
  const usStatePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;
  const zipPattern = /\b\d{5}(-\d{4})?\b/;
  const streetNumberPattern = /^\d+\s+/;
  const hasCommas = a.split(",").length >= 2;

  const hasState = usStatePattern.test(a);
  const hasZip = zipPattern.test(a);
  const hasStreetNum = streetNumberPattern.test(a);

  if (hasStreetNum && hasState && hasZip) return "valid";
  if (hasStreetNum && (hasState || hasZip)) return "partial";
  if (!hasState && !hasZip && hasCommas) return "international";
  if (hasCommas) return "partial";
  return "invalid";
}

export async function lookupPhoneBatch(
  phones: string[],
  concurrency = 3
): Promise<Map<string, PhoneLookupResult>> {
  const results = new Map<string, PhoneLookupResult>();
  if (!phones.length) return results;

  for (let i = 0; i < phones.length; i += concurrency) {
    const chunk = phones.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((p) => lookupPhone(p)));
    for (let j = 0; j < chunk.length; j++) {
      const s = settled[j];
      results.set(chunk[j], s.status === "fulfilled" ? s.value : {
        phone: chunk[j], valid: false, type: "unverified", carrier: null, nationalFormat: null, countryCode: null, configured: true,
      });
    }
  }
  return results;
}

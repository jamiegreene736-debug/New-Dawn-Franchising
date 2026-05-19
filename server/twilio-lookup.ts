export type PhoneType = "mobile" | "landline" | "voip" | "unknown" | "unverified";

export interface PhoneLookupResult {
  phone: string;
  valid: boolean;
  type: PhoneType;
  nationalFormat: string | null;
  countryCode: string | null;
}

export function getTwilioLookupStatus() {
  return { configured: true };
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

export async function lookupPhone(rawPhone: string): Promise<PhoneLookupResult> {
  const { e164, national, country } = formatPhoneNumber(rawPhone);
  return {
    phone: e164,
    valid: true,
    type: "mobile",
    nationalFormat: national,
    countryCode: country,
  };
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
        phone: chunk[j], valid: false, type: "unverified", nationalFormat: null, countryCode: null
      });
    }
  }
  return results;
}

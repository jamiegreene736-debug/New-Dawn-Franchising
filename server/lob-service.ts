/**
 * Lob API service — postcards and letters for broker outreach.
 * Gracefully degrades to demo mode when LOB_API_KEY is absent.
 */

const LOB_KEY = () => process.env.LOB_API_KEY ?? "";
const LOB_BASE = "https://api.lob.com/v1";
const APP_BASE = () => process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";

const DYLAN = {
  name: "Dylan Delaney",
  company: "New Dawn Franchising LLC",
  address_line1: "2601 N Zaragoza Rd",
  address_city: "El Paso",
  address_state: "TX",
  address_zip: "79938",
  address_country: "US",
};

function authHeader() {
  return "Basic " + Buffer.from(LOB_KEY() + ":").toString("base64");
}

function parseMailing(raw: string): {
  address_line1: string; address_line2?: string;
  address_city: string; address_state: string; address_zip: string; address_country: string;
} | null {
  if (!raw || raw.trim().length < 10) return null;
  const parts = raw.split(",").map(s => s.trim());
  if (parts.length < 3) return null;
  const [address_line1, address_city, rest] = parts;
  const stateZipMatch = rest?.match(/([A-Z]{2})\s+([\d-]+)/);
  const countryMatch = raw.match(/\b([A-Z]{2})\s*$/) || raw.match(/\b(USA|United States|Canada|UK)\b/i);
  return {
    address_line1,
    address_city,
    address_state: stateZipMatch?.[1] ?? "TX",
    address_zip: stateZipMatch?.[2] ?? "00000",
    address_country: "US",
  };
}

export interface LobResult {
  success: boolean;
  lobId?: string;
  error?: string;
  demoMode?: boolean;
}

/**
 * Send a Day-1 broker postcard via Lob.
 */
export async function sendBrokerPostcard(lead: {
  fullName: string; mailingAddress: string | null;
}): Promise<LobResult> {
  if (!LOB_KEY()) {
    console.log(`[Lob] Demo mode — postcard would be sent to ${lead.fullName}`);
    return { success: true, lobId: `demo-postcard-${Date.now()}`, demoMode: true };
  }
  const toAddr = parseMailing(lead.mailingAddress ?? "");
  if (!toAddr) return { success: false, error: "Could not parse mailing address" };

  const calLink = "https://calendly.com/dylan-newdawnfranchising";

  const front = `
<html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#fff;text-align:center">
  <h1 style="font-size:28px;font-weight:900;line-height:1.2;margin-bottom:20px">
    Your Client Wants to Move to the USA.<br/>We Can Make That Happen.
  </h1>
  <p style="font-size:14px;color:#94a3b8">New Dawn Franchising — E-2 Visa Franchise Investment</p>
</body></html>`.trim();

  const back = `
<html><body style="font-family:sans-serif;padding:40px">
  <h2 style="color:#0f172a;margin-bottom:16px">Why brokers partner with us:</h2>
  <ul style="list-style:none;padding:0;font-size:14px;line-height:2">
    <li>✅ Forbes 30 Under 30 — recognized leadership</li>
    <li>✅ Funds held in escrow — client gets full refund if visa denied</li>
    <li>✅ Established E-2 franchise model in El Paso, TX</li>
  </ul>
  <p style="margin-top:24px;font-size:13px;color:#64748b">
    Dylan Delaney · New Dawn Franchising LLC<br/>
    <strong>${calLink}</strong>
  </p>
  <p style="margin-top:20px;font-size:12px;color:#94a3b8">
    Scan to schedule a 20-min intro call →
  </p>
</body></html>`.trim();

  try {
    const res = await fetch(`${LOB_BASE}/postcards`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Broker postcard — ${lead.fullName}`,
        to: { name: lead.fullName, ...toAddr },
        from: { name: DYLAN.name, company: DYLAN.company, address_line1: DYLAN.address_line1, address_city: DYLAN.address_city, address_state: DYLAN.address_state, address_zip: DYLAN.address_zip, address_country: DYLAN.address_country },
        front,
        back,
        size: "4x6",
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message ?? `Lob ${res.status}` };
    return { success: true, lobId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Send a branded postcard for any CRM client (investor lead).
 */
export async function sendCrmPostcard(client: {
  fullName: string;
  address: string | null;
  companyName?: string | null;
  citizenship?: string | null;
}): Promise<LobResult> {
  if (!LOB_KEY()) {
    console.log(`[Lob] Demo mode — postcard would be sent to ${client.fullName}`);
    return { success: true, lobId: `demo-postcard-${Date.now()}`, demoMode: true };
  }
  const toAddr = parseMailing(client.address ?? "");
  if (!toAddr) return { success: false, error: "Could not parse mailing address. Format: 123 Main St, City, ST 00000" };

  const calLink = "https://calendly.com/dylan-newdawnfranchising";
  const firstName = client.fullName.split(" ")[0];

  const front = `
<html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#fff;text-align:center">
  <p style="font-size:12px;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;margin-bottom:12px">E-2 Visa Investment Opportunity</p>
  <h1 style="font-size:26px;font-weight:900;line-height:1.3;margin-bottom:20px">
    Own a U.S. Business.<br/>Secure Your E-2 Visa.
  </h1>
  <p style="font-size:13px;color:#94a3b8;margin-bottom:24px">A proven $225K franchise pathway in El Paso, Texas.</p>
  <div style="background:#1e293b;border-radius:8px;padding:16px;font-size:12px;color:#cbd5e1">
    New Dawn Franchising · newdawnfranchising.com
  </div>
</body></html>`.trim();

  const back = `
<html><body style="font-family:sans-serif;padding:40px">
  <p style="font-size:13px;color:#64748b;margin-bottom:12px">Dear ${firstName},</p>
  <p style="font-size:14px;color:#0f172a;margin-bottom:16px">New Dawn Franchising specializes in E-2 visa compliant property management franchises in Texas.</p>
  <p style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px">Why investors choose us:</p>
  <ul style="list-style:none;padding:0;font-size:13px;line-height:2;color:#334155">
    <li>✅ $225K minimum — fully E-2 compliant</li>
    <li>✅ Funds held in escrow — full refund if visa denied</li>
    <li>✅ Established operations in El Paso, TX</li>
    <li>✅ Forbes 30 Under 30 leadership</li>
  </ul>
  <p style="margin-top:20px;font-size:13px;color:#0f172a">
    Schedule a 20-min call:<br/>
    <strong style="color:#1d4ed8">${calLink}</strong>
  </p>
  <p style="margin-top:20px;font-size:12px;color:#94a3b8">
    Dylan Delaney · New Dawn Franchising LLC · El Paso, TX
  </p>
</body></html>`.trim();

  try {
    const res = await fetch(`${LOB_BASE}/postcards`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Investor postcard — ${client.fullName}`,
        to: {
          name: client.fullName,
          ...(client.companyName ? { company: client.companyName } : {}),
          ...toAddr,
        },
        from: {
          name: DYLAN.name, company: DYLAN.company,
          address_line1: DYLAN.address_line1, address_city: DYLAN.address_city,
          address_state: DYLAN.address_state, address_zip: DYLAN.address_zip,
          address_country: DYLAN.address_country,
        },
        front,
        back,
        size: "4x6",
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message ?? `Lob ${res.status}` };
    return { success: true, lobId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Send a Day-7 premium letter via Lob.
 */
export async function sendBrokerLetter(lead: {
  fullName: string; mailingAddress: string | null;
}): Promise<LobResult> {
  if (!LOB_KEY()) {
    console.log(`[Lob] Demo mode — letter would be sent to ${lead.fullName}`);
    return { success: true, lobId: `demo-letter-${Date.now()}`, demoMode: true };
  }
  const toAddr = parseMailing(lead.mailingAddress ?? "");
  if (!toAddr) return { success: false, error: "Could not parse mailing address" };

  const calLink = "https://calendly.com/dylan-newdawnfranchising";
  const firstName = lead.fullName.split(" ")[0];

  const html = `
<html><body style="font-family:Georgia,serif;padding:60px;max-width:600px;margin:auto;color:#1a1a1a;line-height:1.8">
  <p>Dear ${firstName},</p>
  <p>I wanted to reach out personally because I believe we may have a compelling opportunity for your clients who are considering a move to the United States.</p>
  <p>New Dawn Franchising has built a proven E-2 visa franchise model in El Paso, Texas. Our clients invest a minimum of $225,000 into an established franchise and use that investment as the basis for their E-2 visa application.</p>
  <p><strong>What this means for you as a referring broker:</strong></p>
  <ul>
    <li>12.5% referral fee on every investment — <strong>$28,125 per client referred</strong></li>
    <li>Zero risk: all funds are held in escrow and returned in full if the visa is denied</li>
    <li>Backed by Forbes 30 Under 30 recognition and a track record of successful visa approvals</li>
  </ul>
  <p>Even if you don't have a client right now who fits this profile — keep this letter. You will.</p>
  <p>I'd welcome the chance to speak with you for 20 minutes. Scan the QR code below or visit my Calendly link to pick a time that works for you.</p>
  <p><strong>${calLink}</strong></p>
  <p>Warm regards,</p>
  <p><em>Dylan Delaney</em><br/>New Dawn Franchising LLC<br/>El Paso, Texas</p>
  <p style="margin-top:40px;font-size:12px;color:#888">
    P.S. Even if you don't have a client right now — keep this. You will.
  </p>
</body></html>`.trim();

  try {
    const res = await fetch(`${LOB_BASE}/letters`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Broker letter — ${lead.fullName}`,
        to: { name: lead.fullName, ...toAddr },
        from: { name: DYLAN.name, company: DYLAN.company, address_line1: DYLAN.address_line1, address_city: DYLAN.address_city, address_state: DYLAN.address_state, address_zip: DYLAN.address_zip, address_country: DYLAN.address_country },
        file: html,
        color: false,
        double_sided: false,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message ?? `Lob ${res.status}` };
    return { success: true, lobId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Send a Day-4 partner outreach premium letter via Lob.
 * Tailored for professional partners (attorneys, wealth managers, advisors).
 */
export async function sendPartnerLetter(lead: {
  fullName: string; mailingAddress: string | null;
  company?: string | null; audienceType?: string | null;
}): Promise<LobResult> {
  if (!LOB_KEY()) {
    console.log(`[Lob] Demo mode — partner letter would be sent to ${lead.fullName}`);
    return { success: true, lobId: `demo-partner-letter-${Date.now()}`, demoMode: true };
  }
  const toAddr = parseMailing(lead.mailingAddress ?? "");
  if (!toAddr) return { success: false, error: "Could not parse mailing address" };

  const calLink = "https://calendly.com/dylan-newdawnfranchising";
  const firstName = lead.fullName.split(" ")[0];
  const type = lead.audienceType ?? "other";

  const audienceSwaps: Record<string, string> = {
    immigration_attorney: "your clients a legitimate, pre-structured U.S. business that satisfies USCIS on substantiality, at-risk capital, and the obligation to develop and direct.",
    wealth_manager: "your international clients a real U.S. operating business — structured to qualify for an E-2 visa and built around capital protection.",
    business_advisor: "your international entrepreneur clients a real U.S. operating business they can step into on day one — structured to support an E-2 visa from the ground up.",
    e2_consultant: "your clients a ready-made, E-2-specific franchise investment — saving you the sourcing work and giving them a defensible, FDD-registered business.",
    immigration_consultant: "your E-2-pathway clients a qualifying U.S. business investment — pre-structured, professionally run, and protected if the visa is not approved.",
    other: "your internationally-minded clients a real, structured U.S. business investment — one that comes with a clear visa pathway and a full refund if the E-2 visa is not approved.",
  };
  const audienceSwap = audienceSwaps[type] ?? audienceSwaps.other;

  const html = [
    "<html><body style=\"font-family:Georgia,serif;padding:60px;max-width:600px;margin:auto;color:#1a1a1a;line-height:1.8\">",
    `<p>${firstName},</p>`,
    "<p>I sent you a note by email earlier this week, but I wanted to follow up the old-fashioned way because I think what we built is worth a few minutes of your attention.</p>",
    `<p>New Dawn Franchising is the first franchise system built specifically for E-2 visa investors. We give ${audienceSwap}</p>`,
    "<p>What makes us different is how the investment is protected. The client's $225,000 sits in escrow — held by an attorney of their choosing — until their E-2 visa is approved. The business operates during that window, generating real activity and supporting a strong petition. If approved, escrow releases. If denied after the required application process, the client receives a full refund of their franchise investment.</p>",
    "<p>Enclosed is a one-page summary of how our structure maps to each E-2 requirement. I would welcome a short conversation — or I can send our FDD for your review.</p>",
    "<p>With appreciation,</p>",
    "<p><em>Dylan Delaney</em><br/>Founding Member and Franchise Development Manager<br/>New Dawn Franchising<br/>(346) 597-9994 | newdawnfranchising.com</p>",
    `<p style="margin-top:30px;font-size:13px;color:#555">Book a 20-min call: <strong>${calLink}</strong></p>`,
    "</body></html>",
  ].join("\n");

  try {
    const res = await fetch(`${LOB_BASE}/letters`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Partner letter — ${lead.fullName}${lead.company ? ` (${lead.company})` : ""}`,
        to: {
          name: lead.fullName,
          ...(lead.company ? { company: lead.company } : {}),
          ...toAddr,
        },
        from: {
          name: DYLAN.name, company: DYLAN.company,
          address_line1: DYLAN.address_line1, address_city: DYLAN.address_city,
          address_state: DYLAN.address_state, address_zip: DYLAN.address_zip,
          address_country: DYLAN.address_country,
        },
        file: html,
        color: false,
        double_sided: false,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: (data.error as any)?.message ?? `Lob ${res.status}` };
    return { success: true, lobId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

import type {
  DeskChannel,
  Eligibility,
  Permissions,
} from "@shared/outreach-desk";

export class DeskError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function normalizePhone(value: string | null): string | null {
  if (!value || /[a-z@]/i.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  // Require an explicit country code; do not infer nationality from a phone.
  return value.trim().startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)
    ? `+${digits}`
    : null;
}
export function validTimezone(value: string | null): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function inContactHours(
  timezone: string | null,
  now = new Date(),
): boolean {
  if (!validTimezone(timezone)) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone!,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return day !== "Sat" && day !== "Sun" && hour >= 9 && hour < 18;
}
export function nextContactHours(
  timezone: string | null,
  now = new Date(),
): Date | null {
  if (!validTimezone(timezone)) return null;
  for (let minutes = 15; minutes <= 4 * 24 * 60; minutes += 15) {
    const candidate = new Date(now.getTime() + minutes * 60_000);
    if (inContactHours(timezone, candidate)) return candidate;
  }
  return null;
}
export function safeLinkedin(value: string | null): string | null {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      ["linkedin.com", "www.linkedin.com"].includes(url.hostname) &&
      url.pathname.startsWith("/in/") &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export type PolicyContext = {
  phone: string | null;
  email: string | null;
  timezone: string | null;
  permissions: Permissions;
  suppressed: boolean;
  booked: boolean;
  status: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  linkedinUrl: string | null;
  whatsappInboundAt?: string | null;
};
export function channelEligibility(
  context: PolicyContext,
  channel: DeskChannel,
  now = new Date(),
): Eligibility {
  const held = (reason: string): Eligibility => ({ allowed: false, reason });
  if (context.suppressed || context.status === "dnc")
    return held("Do not contact: outreach is suppressed.");
  if (["not_interested", "booked"].includes(context.status) || context.booked)
    return held("Prospecting stopped: this relationship is already handled.");
  if (channel === "linkedin")
    return safeLinkedin(context.linkedinUrl)
      ? {
          allowed: true,
          reason: "Open the verified profile; the agent sends manually.",
        }
      : held("Add a verified LinkedIn profile.");
  if (channel === "email" && !context.email)
    return held("Email address needed.");
  if (channel !== "email" && !normalizePhone(context.phone))
    return held("An international phone number with +country code is needed.");
  const permission = context.permissions[channel];
  if (
    !permission?.allowed ||
    Date.parse(permission.expiresAt) <= now.getTime() ||
    !Number.isFinite(Date.parse(permission.expiresAt))
  ) {
    return held("Record current channel eligibility and supporting evidence.");
  }
  if (!validTimezone(context.timezone))
    return held("Confirm the contact’s timezone.");
  if (!inContactHours(context.timezone, now))
    return held(
      "Outside the contact’s calling/messaging hours (weekdays 9–6).",
    );
  if (channel === "call") {
    if (context.status === "wrong_number")
      return held("This number was reported incorrect.");
    if (context.attemptCount >= 3 && context.status !== "callback")
      return held("Attempt limit reached; review the relationship.");
    if (
      context.nextAttemptAt &&
      Date.parse(context.nextAttemptAt) > now.getTime()
    )
      return held("The next attempt is scheduled for later.");
  }
  if (channel === "whatsapp") {
    const inbound = Date.parse(context.whatsappInboundAt || "");
    if (
      !Number.isFinite(inbound) ||
      now.getTime() - inbound >= 24 * 3600_000 ||
      inbound > now.getTime()
    ) {
      return held(
        "WhatsApp service window is closed. Use an approved template in Campaigns.",
      );
    }
  }
  return {
    allowed: true,
    reason: "Recorded eligibility and local hours allow this action.",
  };
}
export function briefFor(person: {
  name: string;
  track: string;
  triggerType: string;
  status: string;
  emailSubject: string | null;
}): string {
  const signal =
    person.status === "callback"
      ? "Start with the callback they requested."
      : person.triggerType === "reply_no_meeting"
        ? "Read their reply first and respond to their question."
        : person.triggerType === "engaged_open"
          ? "Only email opens were observed; interest is unconfirmed."
          : "Review the campaign context and establish whether this is relevant to them.";
  return `${signal} ${person.track === "client" ? "Ask what they want to understand about business ownership." : "Ask about their clients’ needs and the referral process."} Offer a short introduction with Dylan if useful. Use approved materials for pricing, returns or immigration questions.`;
}
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

/**
 * Pure helpers for the Thailand setter call queue.
 * Keep side-effect-free so unit tests can cover priority, skip rules, and cadence.
 */

export const ENGAGED_OPEN_MIN = 3;
export const MAX_ATTEMPTS = 3;

export const TRIGGER_PRIORITY = {
  link_click: 1,
  reply_no_meeting: 2,
  engaged_open: 3,
} as const;

export type CallTriggerType = keyof typeof TRIGGER_PRIORITY;

export const TERMINAL_STATUSES = [
  "booked",
  "not_interested",
  "dnc",
  "wrong_number",
] as const;

export const ACTIVE_STATUSES = [
  "queued",
  "calling",
  "no_answer",
  "voicemail",
  "callback",
  "needs_phone",
] as const;

/** CRM statuses where Dylan is already working the person — do not requeue. */
export const BLOCKING_CRM_STATUSES = [
  "meeting_scheduled",
  "fdd_sent",
  "fdd_signed",
  "agreement_sent",
  "agreement_signed",
  "wire_received",
  "active",
  "declined",
] as const;

export function isTerminalStatus(status: string | null | undefined): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status || "");
}

export function isActiveStatus(status: string | null | undefined): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status || "");
}

export function isBlockingCrmStatus(status: string | null | undefined): boolean {
  return (BLOCKING_CRM_STATUSES as readonly string[]).includes(status || "");
}

export function priorityForTrigger(triggerType: string): number {
  return TRIGGER_PRIORITY[triggerType as CallTriggerType] ?? 9;
}

/** Single human-classified opens are too noisy (Apple Mail Privacy Protection). */
export function isQueueableOpenSignal(openCount: number): boolean {
  return openCount >= ENGAGED_OPEN_MIN;
}

export function inferTrack(
  campaignName?: string | null,
  audienceType?: string | null,
): "broker" | "client" {
  if ((audienceType || "").toLowerCase() === "client") return "client";
  const n = (campaignName || "").toLowerCase();
  if (n.includes("client") || n.includes("investor")) return "client";
  return "broker";
}

export function inferTimezone(
  location?: string | null,
  state?: string | null,
  country?: string | null,
): string {
  const blob = `${location || ""} ${state || ""} ${country || ""}`.toLowerCase();
  if (/hawaii|honolulu/.test(blob)) return "Pacific/Honolulu";
  if (/alaska/.test(blob)) return "America/Anchorage";
  if (
    /pacific|california|los angeles|san francisco|seattle|oregon|washington(?!\s*d\.?\s*c)|nevada|arizona/.test(
      blob,
    )
  ) {
    return /arizona/.test(blob) ? "America/Phoenix" : "America/Los_Angeles";
  }
  if (/mountain|colorado|utah|denver|idaho|montana|wyoming|new mexico/.test(blob)) {
    return "America/Denver";
  }
  if (
    /central|texas|\btx\b|chicago|illinois|wisconsin|minnesota|missouri|oklahoma|kansas|louisiana|alabama|mississippi|tennessee|arkansas|iowa|nebraska|el paso/.test(
      blob,
    )
  ) {
    return "America/Chicago";
  }
  return "America/New_York";
}

export function isGoodCallWindow(
  timezone: string,
  now = new Date(),
): { ok: boolean; label: string; localHour: number } {
  let localHour = now.getHours();
  let weekday = now.getDay();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/New_York",
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);
    localHour = Number(parts.find((p) => p.type === "hour")?.value ?? localHour);
    const wd = parts.find((p) => p.type === "weekday")?.value || "";
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    weekday = map[wd] ?? weekday;
  } catch {
    /* keep host-local */
  }
  const weekdayOk = weekday >= 1 && weekday <= 5;
  const hourOk = localHour >= 8 && localHour < 18;
  const ok = weekdayOk && hourOk;
  return {
    ok,
    localHour,
    label: ok ? "Good to call now" : weekdayOk ? "Outside their hours" : "Weekend in their TZ",
  };
}

export function nextAttemptAt(attemptCount: number, from = new Date()): Date | null {
  if (attemptCount >= MAX_ATTEMPTS) return null;
  const next = new Date(from.getTime());
  if (attemptCount <= 1) {
    next.setDate(next.getDate() + 1);
    next.setHours(from.getHours() + 4, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 2);
    next.setHours(from.getHours() - 3, 0, 0, 0);
  }
  return next;
}

export function phoneDigits(phone?: string | null): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

export function isUsablePhone(phone?: string | null): boolean {
  const value = (phone || "").trim();
  if (!value) return false;
  if (/[a-zA-Z@]/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function triggerLabel(triggerType: string, subject?: string | null): string {
  const sub = subject?.trim() ? `"${subject.trim()}"` : "an email";
  if (triggerType === "link_click") return `Clicked a link in ${sub}`;
  if (triggerType === "reply_no_meeting") return `Replied to ${sub} — no meeting yet`;
  if (triggerType === "engaged_open") return `Opened ${sub} 3+ times`;
  return `Engaged with ${sub}`;
}

export function shouldUpgradePriority(existing: number, incoming: number): boolean {
  return incoming < existing;
}

export function calendlySmsBody(name: string, track: "broker" | "client", link: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  if (track === "broker") {
    return `Hi ${first} — this is New Dawn Franchising. Here's Dylan's calendar for a 20-min referral walkthrough: ${link}`;
  }
  return `Hi ${first} — this is New Dawn Franchising. Here's Dylan's calendar for a 20-min call on the E-2 director model: ${link}`;
}

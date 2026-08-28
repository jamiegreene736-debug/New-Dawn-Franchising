/**
 * Smart Send Scheduler
 *
 * Research-backed optimal windows for SMS and email outreach:
 * - SMS:   Tue–Thu 10 AM–12 PM and 2–5 PM local; Mon/Fri 10 AM–4 PM ok
 *          Avoid: before 9 AM, after 7 PM, weekends
 *          Rate:  3–8 s random delay (organic, carrier-safe)
 *          Max:   ~50/hr to stay under carrier thresholds
 *
 * - Email: Mon–Fri 8 AM–5 PM local (full business day)
 *          Avoid: before 8 AM, after 5 PM, weekends
 *          Rate:  5–20 s random delay (avoids ISP bulk-sender flags)
 *          Max:   ~80/day total until Gmail login is healthy (override via env)
 */

export type SendMode = "now" | "smart";

const TZ = "America/Chicago"; // El Paso / Mountain Daylight Time

// ─── Window definitions ───────────────────────────────────────────────────────

interface TimeWindow { start: number; end: number } // 24-h hour values

const SMS_WINDOWS: Record<number, TimeWindow[]> = {
  0: [], // Sunday — avoid
  1: [{ start: 10, end: 16 }],   // Monday
  2: [{ start: 10, end: 12 }, { start: 14, end: 17 }], // Tuesday  ★ best
  3: [{ start: 10, end: 12 }, { start: 14, end: 17 }], // Wednesday ★ best
  4: [{ start: 10, end: 12 }, { start: 14, end: 17 }], // Thursday  ★ best
  5: [{ start: 10, end: 16 }],   // Friday
  6: [], // Saturday — avoid
};

// Full business day, Mon–Fri. The old "peak windows" (Tue–Thu 8–10 & 1–3 only)
// capped real throughput at ~4 sendable hours/day, which made every campaign a
// trickle — the volume target (hundreds of new contacts/week) needs the whole
// 8 AM–5 PM span. Peak-hour engagement bias is small next to not sending at all;
// the hourly cap + jitter still pace the day so it never bursts.
const EMAIL_WINDOWS: Record<number, TimeWindow[]> = {
  0: [], // Sunday
  1: [{ start: 8, end: 17 }],   // Monday
  2: [{ start: 8, end: 17 }],   // Tuesday
  3: [{ start: 8, end: 17 }],   // Wednesday
  4: [{ start: 8, end: 17 }],   // Thursday
  5: [{ start: 8, end: 17 }],   // Friday
  6: [], // Saturday
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

function nowInTZ(): { hour: number; minute: number; dayOfWeek: number; date: Date } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find(p => p.type === "minute")!.value, 10);
  const dayName = parts.find(p => p.type === "weekday")!.value;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour, minute, dayOfWeek: dayMap[dayName] ?? 1, date: now };
}

function inWindow(hour: number, minute: number, windows: TimeWindow[]): boolean {
  const timeDecimal = hour + minute / 60;
  return windows.some(w => timeDecimal >= w.start && timeDecimal < w.end);
}

/** Returns true if NOW is a good time to send SMS */
export function isOptimalSmsWindow(): boolean {
  const { hour, minute, dayOfWeek } = nowInTZ();
  const windows = SMS_WINDOWS[dayOfWeek] ?? [];
  return inWindow(hour, minute, windows);
}

/** Returns true if NOW is a good time to send email */
export function isOptimalEmailWindow(): boolean {
  const { hour, minute, dayOfWeek } = nowInTZ();
  const windows = EMAIL_WINDOWS[dayOfWeek] ?? [];
  return inWindow(hour, minute, windows);
}

/** Returns ms to wait until the next SMS send window opens */
export function msUntilNextSmsWindow(): number {
  const now = new Date();
  // Try up to 7 days ahead
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const candidate = new Date(now.getTime() + dayOffset * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    }).formatToParts(candidate);
    const hour = parseInt(parts.find(p => p.type === "hour")!.value, 10);
    const minute = parseInt(parts.find(p => p.type === "minute")!.value, 10);
    const dayName = parts.find(p => p.type === "weekday")!.value;
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dayMap[dayName] ?? 0;
    const windows = SMS_WINDOWS[dow] ?? [];
    for (const w of windows) {
      const windowStartDecimal = w.start;
      const currentDecimal = hour + minute / 60;
      if (dayOffset > 0 || currentDecimal < windowStartDecimal) {
        // Build the exact Date for window start on this day
        const target = new Date(candidate);
        target.setHours(0, 0, 0, 0);
        // Adjust for TZ offset: convert TZ-local hour to UTC
        const tzOffsetMs = target.getTime() - new Date(
          new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" })
            .format(target) + " " + `${w.start}:00:00`
        ).getTime();
        const windowStart = new Date(candidate);
        windowStart.setHours(0, 0, 0, 0);
        // Simpler: just add hours
        const hoursUntilWindow = dayOffset === 0
          ? (windowStartDecimal - currentDecimal) * 3600_000
          : ((windowStartDecimal - currentDecimal + 24 * dayOffset) * 3600_000);
        return Math.max(0, hoursUntilWindow);
      }
    }
  }
  return 24 * 3600_000; // fallback: try again in 24h
}

/** Returns a human-readable description of the next send window */
export function nextWindowDescription(type: "sms" | "email"): string {
  const { hour, minute, dayOfWeek } = nowInTZ();
  const windows = type === "sms" ? SMS_WINDOWS : EMAIL_WINDOWS;
  const dayWindows = windows[dayOfWeek] ?? [];

  const currentDecimal = hour + minute / 60;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Check if currently in a window
  if (inWindow(hour, minute, dayWindows)) {
    const window = dayWindows.find(w => currentDecimal >= w.start && currentDecimal < w.end)!;
    return `sending now (window closes at ${formatHour(window.end)})`;
  }

  // Find next window today
  const todayNext = dayWindows.find(w => w.start > currentDecimal);
  if (todayNext) {
    return `will begin today at ${formatHour(todayNext.start)}`;
  }

  // Find next window on a future day
  for (let d = 1; d <= 7; d++) {
    const nextDow = (dayOfWeek + d) % 7;
    const nextWindows = windows[nextDow] ?? [];
    if (nextWindows.length > 0) {
      return `will begin ${dayNames[nextDow]} at ${formatHour(nextWindows[0].start)}`;
    }
  }
  return "will begin Tuesday at 10:00 AM";
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:00 ${ampm}`;
}

// ─── Projected send-time helpers (drive the campaign schedule UI) ─────────────

/** Build a Date whose wall-clock time in TZ equals the given components. */
function makeZonedDate(year: number, month1to12: number, day: number, hour: number, minute: number): Date {
  const utcGuess = Date.UTC(year, month1to12 - 1, day, hour, minute, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = asUTC - utcGuess; // ms TZ is ahead of UTC at this instant
  return new Date(utcGuess - offset);
}

/** TZ-local calendar/time parts for a given instant. */
function zonedParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: +get("year"), month: +get("month"), day: +get("day"),
    hour: +get("hour"), minute: +get("minute"), dow: dayMap[get("weekday")] ?? 1,
  };
}

/**
 * The next instant at or after `from` that falls inside an email send window.
 * If `from` is already within a window, returns `from` unchanged. Used to project
 * when a drip email is actually "meant to go out" given the optimal-window gating.
 */
export function nextEmailWindowFrom(from: Date): Date {
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const candidate = new Date(from.getTime() + dayOffset * 86_400_000);
    const zp = zonedParts(candidate);
    const windows = (EMAIL_WINDOWS[zp.dow] ?? []).slice().sort((a, b) => a.start - b.start);
    const currentDecimal = zp.hour + zp.minute / 60;
    for (const w of windows) {
      if (dayOffset === 0) {
        if (currentDecimal >= w.start && currentDecimal < w.end) return from; // sendable now
        if (currentDecimal < w.start) return makeZonedDate(zp.year, zp.month, zp.day, w.start, 0);
        // else this window has passed today — fall through to the next one / next day
      } else {
        return makeZonedDate(zp.year, zp.month, zp.day, w.start, 0);
      }
    }
  }
  return from; // fallback — should not happen given weekday windows exist
}

/**
 * Project when a drip step is "meant to be sent" for an enrollment: the step
 * becomes eligible `delayDays` after enrollment, then sends in the next email
 * window. Returns an ISO string. (Hourly/daily caps may push the real send a
 * little later, but this is the scheduled intent.)
 */
export function projectStepSendTime(enrolledAt: Date, delayDays: number): string {
  const eligible = enrolledAt.getTime() + delayDays * 86_400_000;
  const from = new Date(Math.max(eligible, Date.now()));
  return nextEmailWindowFrom(from).toISOString();
}

/** Human-readable summary of the email send windows, for UI captions. */
export const EMAIL_WINDOW_SUMMARY =
  "Emails send Mon–Fri 8 AM–5 PM CT, paced with hourly caps, per-domain gaps, and organic jitter to protect deliverability.";


// ─── Delay / jitter calculations ─────────────────────────────────────────────

/** Random integer in [min, max] */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Smart SMS inter-send delay.
 * - Small lists (≤20):  3–5 s  (fast but organic)
 * - Medium (21–100):    4–8 s  (safer)
 * - Large (101+):       6–12 s (carrier-safe, spreads over 2–3 h)
 */
export function smartSmsDelay(listSize: number): number {
  if (listSize <= 20) return randInt(3000, 5000);
  if (listSize <= 100) return randInt(4000, 8000);
  return randInt(6000, 12000);
}

/**
 * Smart WhatsApp inter-send delay.
 * WA is more tolerant of bursts but Meta limits are similar to SMS.
 */
export function smartWhatsAppDelay(listSize: number): number {
  if (listSize <= 20) return randInt(2000, 4000);
  if (listSize <= 100) return randInt(3000, 7000);
  return randInt(5000, 10000);
}

/**
 * Smart email inter-send delay.
 * - Gmail SMTP: burst of ~20 before throttle, max ~500/day
 * - We cap at 100/day and use 5–20 s jitter between sends
 */
export function smartEmailDelay(index: number): number {
  // Every 10 emails, take a slightly longer breath
  if (index > 0 && index % 10 === 0) return randInt(15_000, 25_000);
  return randInt(5000, 18_000);
}

// ─── Daily / hourly email caps (spam-safety throttles) ────────────────────────

/** Parse a positive integer env var, falling back to a default. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Per-day TOTAL volume ceiling. Default 80 until Gmail login is healthy again
// (Aug 2026 fail spike was 57% SMTP 535/534). Raise EMAIL_DAILY_CAP or the
// Sending & Safety override after app passwords are re-authed. Previously
// scaled at 100/day per mailbox (up to 400), which the leftover 13-step
// sequences blew past via failed attempts that did not count toward the cap.
export const EMAIL_DAILY_CAP = envInt("EMAIL_DAILY_CAP", 80);

// Per-hour ceiling so the daily volume is spread across the business-hours
// window instead of bursting in a single cron run (a strong spam signal).
// 80/day ÷ ~6 sendable hours ≈ 13/hr; default 15 covers that with a little
// headroom. Override with EMAIL_HOURLY_CAP in Railway → Variables.
export const EMAIL_HOURLY_CAP = envInt("EMAIL_HOURLY_CAP", 15);

// Minimum spacing between two emails sent to the SAME recipient domain within a
// run. ISPs flag rapid bursts to one domain (e.g. many gmail.com in seconds),
// so we pace per-domain on top of the global jitter. Override with
// EMAIL_DOMAIN_GAP_SECONDS.
export const EMAIL_DOMAIN_GAP_MS = envInt("EMAIL_DOMAIN_GAP_SECONDS", 45) * 1000;

/** Lowercased domain of an email address, or "" if unparseable. */
export function emailDomain(email: string | null | undefined): string {
  const at = (email || "").lastIndexOf("@");
  return at >= 0 ? (email as string).slice(at + 1).trim().toLowerCase() : "";
}

// ─── In-memory daily counter (legacy preview/estimate path) ──────────────────
// NOTE: the drip processor itself uses DB-backed rolling-window counts
// (storage.countSentEmailsSince) so caps survive restarts. This in-memory
// counter only backs the synchronous estimateSend() UI preview.

/** In-memory daily email counter keyed by YYYY-MM-DD */
const dailyEmailCounts: Record<string, number> = {};

export function getDailyEmailCount(): number {
  const key = new Date().toISOString().slice(0, 10);
  return dailyEmailCounts[key] ?? 0;
}

export function incrementDailyEmailCount(): void {
  const key = new Date().toISOString().slice(0, 10);
  dailyEmailCounts[key] = (dailyEmailCounts[key] ?? 0) + 1;
}

export function isEmailDailyCapReached(): boolean {
  return getDailyEmailCount() >= EMAIL_DAILY_CAP;
}

// ─── Estimated send time preview ─────────────────────────────────────────────

export interface SendEstimate {
  windowStatus: "open" | "closed";
  windowDescription: string;
  estimatedMinutes: number;  // total duration of the send (not when it starts)
  recommendation: string;
}

export function estimateSend(type: "sms" | "whatsapp" | "email", listSize: number): SendEstimate {
  let avgDelay: number;
  let isOpen: boolean;
  let windowDesc: string;

  if (type === "sms") {
    avgDelay = smartSmsDelay(listSize); // representative sample
    isOpen = isOptimalSmsWindow();
    windowDesc = nextWindowDescription("sms");
  } else if (type === "whatsapp") {
    avgDelay = smartWhatsAppDelay(listSize);
    isOpen = isOptimalSmsWindow(); // same windows as SMS
    windowDesc = nextWindowDescription("sms");
  } else {
    avgDelay = 11_000; // midpoint of email jitter
    isOpen = isOptimalEmailWindow();
    windowDesc = nextWindowDescription("email");
    const remaining = EMAIL_DAILY_CAP - getDailyEmailCount();
    if (listSize > remaining) {
      return {
        windowStatus: isOpen ? "open" : "closed",
        windowDescription: windowDesc,
        estimatedMinutes: Math.ceil((Math.min(listSize, remaining) * avgDelay) / 60_000),
        recommendation: `Daily email cap: ${remaining} of ${EMAIL_DAILY_CAP} remaining today. ${listSize - remaining} will be deferred to tomorrow.`,
      };
    }
  }

  const totalMs = listSize * avgDelay;
  const estimatedMinutes = Math.ceil(totalMs / 60_000);

  return {
    windowStatus: isOpen ? "open" : "closed",
    windowDescription: windowDesc,
    estimatedMinutes,
    recommendation: isOpen
      ? `Smart Send will distribute ${listSize} messages over ~${estimatedMinutes} min with organic timing.`
      : `Not in optimal window. Smart Send ${windowDesc}. Use "Send Now" to override.`,
  };
}

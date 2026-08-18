import type { Request } from "express";

// ─────────────────────────────────────────────────────────────────────────────
// Bot / scanner filtering for the open-pixel + click-redirect endpoints.
//
// Why this exists: corporate mail gateways (Outlook SafeLinks, Proofpoint,
// Barracuda, Mimecast…) fetch every link and pixel in every inbound email,
// usually within seconds of delivery and often repeatedly. Before this filter,
// those hits were recorded as engagement — production data showed 97% of all
// "clicks" landing within 10 minutes of the send and single recipients with
// 200+ recorded clicks, which triggered bogus 🔥 hot-lead call tasks and made
// campaign stats unreadable. A hit classified as a bot is still counted (in
// the bot_* columns) so scanner activity stays visible — it just no longer
// masquerades as a human.
// ─────────────────────────────────────────────────────────────────────────────

// Substrings (lowercased) that identify known scanners, bots, and script
// clients. Deliberately NOT listed: GoogleImageProxy — Gmail proxies every
// image a real reader loads through it, so flagging it would erase all Gmail
// opens.
const BOT_UA_PATTERNS = [
  // security gateways / URL rewriters
  "barracuda",
  "proofpoint",
  "mimecast",
  "ironport",
  "fireeye",
  "forcepoint",
  "zscaler",
  "urldefense",
  "trendmicro",
  "sophos",
  "symantec",
  "bluecoat",
  "safelinks",
  "microsoft office existence discovery",
  "office 365 connectors",
  "microsoftpreview",
  "skypeuripreview",
  "google-safety",
  "googlesafebrowsing",
  // generic crawlers / preview fetchers
  "bot",
  "crawler",
  "spider",
  "preview",
  "facebookexternalhit",
  "whatsapp",
  "telegram",
  "slack",
  "discord",
  "embedly",
  "vkshare",
  // script clients — no human clicks a mail link with curl
  "curl/",
  "wget/",
  "python",
  "aiohttp",
  "go-http-client",
  "okhttp",
  "libwww",
  "httpclient",
  "java/",
  "node-fetch",
  "axios/",
  "headlesschrome",
  "phantomjs",
];

export function isBotUserAgent(ua: string | undefined): boolean {
  if (!ua || !ua.trim()) return true; // real mail clients always send a UA
  const lc = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lc.includes(p));
}

// Scanners hit links/pixels the moment the message is delivered. Nobody reads
// a cold email and clicks a link 45 seconds after the SMTP handshake — but a
// gateway does, every time. Production data: human clicks clustered >10 min
// after send; scanner clicks clustered <10 min with the bulk inside 1 minute.
// The windows below are deliberately tighter than 10 min so an unusually fast
// real reader is still counted.
export const CLICK_BOT_WINDOW_MS = 90_000; // clicks within 90s of send = scanner
export const OPEN_BOT_WINDOW_MS = 60_000; // pixel fetches within 60s of send = scanner

// A real person re-clicking links in one email tops out around a handful of
// clicks; the 200+-click rows in production were all gateway re-crawls. Once a
// send passes this many human-classified clicks, further hits count as bot.
export const MAX_HUMAN_CLICKS_PER_SEND = 10;

export type TrackingHitKind = "open" | "click";

export function classifyTrackingHit(
  req: Request,
  kind: TrackingHitKind,
  sentAt: Date | null | undefined,
  humanHitsSoFar = 0,
): "human" | "bot" {
  // Express routes GET handlers for HEAD too — link checkers probe with HEAD.
  if (req.method === "HEAD") return "bot";
  if (isBotUserAgent(req.headers["user-agent"])) return "bot";
  if (kind === "click" && humanHitsSoFar >= MAX_HUMAN_CLICKS_PER_SEND) return "bot";
  // A hit before we even recorded the send as sent can only be automated.
  if (!sentAt) return "bot";
  const elapsed = Date.now() - new Date(sentAt).getTime();
  const window = kind === "click" ? CLICK_BOT_WINDOW_MS : OPEN_BOT_WINDOW_MS;
  return elapsed < window ? "bot" : "human";
}

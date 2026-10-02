import type { AuthStatus } from "./deliverability-service";

// Local editorial heuristics, not Gmail's classifier or SpamAssassin.
// Legacy placement fields remain for API compatibility; consumers should use
// contentRisk and must not interpret score as an inbox probability.

export interface SpamAuthInput {
  spf: AuthStatus;
  dkim: AuthStatus;
  dmarc: AuthStatus;
}

export type Signal = "spam" | "promotions" | "inbox";
export type Severity = "critical" | "high" | "medium" | "low" | "unknown";

export interface SpamFinding {
  id: string;
  category: string;
  severity: Severity;
  message: string;
  points: number; // added to spamPoints (negative = improves score)
  signals: Signal;
}

export interface SpamReport {
  contentRisk: "lower" | "review" | "high";
  score: number; // 0–100, higher = cleaner
  spamScore: number; // Local heuristic points (not a provider score)
  promoPoints: number;
  placement: "inbox" | "promotions" | "spam";
  placementReason: string;
  findings: SpamFinding[];
  notEvaluated: { id: string; message: string }[];
  stats: {
    subjectLength: number;
    wordCount: number;
    visibleTextLength: number;
    linkCount: number;
    imageCount: number;
    hasUnsubscribe: boolean;
    htmlBytes: number;
  };
  auth: SpamAuthInput;
}

// ─── Spam-trigger word lists (categorized; case-insensitive) ─────────────────
const SPAM_TRIGGERS: Record<string, { weight: "high" | "med" | "low"; terms: string[] }> = {
  money_financial: {
    weight: "high",
    terms: ["free money", "earn cash", "make money", "double your money", "extra cash", "million dollars", "unclaimed money", "cash bonus", "money back", "pure profit", "fast cash", "get paid", "income from home", "be your own boss", "investment opportunity"],
  },
  urgency: {
    weight: "med",
    terms: ["act now", "urgent", "limited time", "expires", "apply now", "last chance", "while supplies last", "don't delay", "once in a lifetime", "time sensitive", "offer expires", "now only", "hurry"],
  },
  free_guarantee: {
    weight: "med",
    // NB: bare "guaranteed" is intentionally NOT here — legitimate B2B copy
    // ("refund guarantee", "buy-back guarantee") uses it. Only payment/satisfaction
    // pairings are spam-correlated.
    terms: ["100% free", "risk-free", "risk free", "no catch", "no obligation", "no cost", "no fees", "money-back guarantee", "satisfaction guaranteed", "free quote", "free gift", "free trial", "no credit check"],
  },
  overpromise: {
    weight: "low",
    terms: ["amazing", "incredible", "unbelievable", "best price", "lowest price", "why pay more", "cheap", "bargain"],
  },
  scam_phish: {
    weight: "high",
    terms: ["dear friend", "dear customer", "dear beneficiary", "you have been selected", "you are a winner", "guaranteed winner", "congratulations you won", "account suspended", "verify your account", "verify now", "confirm your identity", "security alert", "unusual activity", "this is not spam", "claim your prize", "wire transfer"],
  },
  health_pharma: {
    weight: "high",
    terms: ["miracle cure", "lose weight fast", "no prescription", "online pharmacy", "viagra", "cialis", "weight loss", "anti-aging", "clinically proven"],
  },
  cta_salesy: {
    weight: "low",
    terms: ["click here", "buy now", "order now", "call now", "click below", "subscribe now", "get started now", "shop now"],
  },
};
const HIGH_RISK_CATEGORIES = new Set(["money_financial", "scam_phish", "health_pharma"]);
const LINK_SHORTENERS = ["bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "rb.gy", "shorturl.at"];
const GTUBE = "XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X";

// ─── Parsing ──────────────────────────────────────────────────────────────────
interface ParsedLink { href: string; text: string; host: string; }
interface ParsedImg { src: string; hasAlt: boolean; }
interface EmailContext {
  subject: string;
  html: string;
  text: string; // visible text only
  words: number;
  links: ParsedLink[];
  imgs: ParsedImg[];
  hasLinkedImage: boolean;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    const m = url.match(/^https?:\/\/([^/?#]+)/i);
    return (m ? m[1] : "").toLowerCase().replace(/^www\./, "");
  }
}

function parseEmail(subject: string, html: string): EmailContext {
  const links: ParsedLink[] = [];
  const linkRe = /<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const href = m[1];
    if (/^(mailto:|tel:)/i.test(href)) continue;
    links.push({ href, text: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(), host: hostOf(href) });
  }
  const imgs: ParsedImg[] = [];
  const imgRe = /<img\b[^>]*>/gi;
  const imgMatches = html.match(imgRe) || [];
  for (const tag of imgMatches) {
    // tracking pixels (1x1, display:none) don't count as real images
    if (/width=["']?1\b/.test(tag) && /height=["']?1\b/.test(tag)) continue;
    if (/display:\s*none/i.test(tag)) continue;
    const src = (tag.match(/src=["']?([^"'\s>]+)/i) || [])[1] || "";
    imgs.push({ src, hasAlt: /alt=["'][^"']*["']/i.test(tag) && !/alt=["']\s*["']/i.test(tag) });
  }
  // Attribute-order-independent: is any <img> wrapped inside an <a>? (bounded
  // quantifier avoids catastrophic backtracking on large bodies.)
  const hasLinkedImage = /<a\b[^>]*>(?:(?!<\/a>)[\s\S]){0,3000}?<img\b/i.test(html);
  const text = decodeEntities(
    html
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\{\{[^}]*\}\}/g, "").replace(/\s+/g, " ").trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return { subject: subject || "", html, text, words, links, imgs, hasLinkedImage };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sev(points: number): Severity {
  const p = Math.abs(points);
  if (p >= 3) return "critical";
  if (p >= 1.5) return "high";
  if (p >= 0.5) return "medium";
  return "low";
}
function upperFraction(s: string): number {
  const letters = s.replace(/[^a-zA-Z]/g, "");
  if (!letters.length) return 0;
  const upper = (s.match(/[A-Z]/g) || []).length;
  return upper / letters.length;
}
function countEmoji(s: string): number {
  return (s.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu) || []).length;
}
function findTriggers(haystack: string): { category: string; weight: string; term: string }[] {
  const hits: { category: string; weight: string; term: string }[] = [];
  const lc = haystack.toLowerCase();
  for (const [category, { weight, terms }] of Object.entries(SPAM_TRIGGERS)) {
    for (const term of terms) {
      if (lc.includes(term)) hits.push({ category, weight, term });
    }
  }
  return hits;
}

// ─── Analyzer ─────────────────────────────────────────────────────────────────
export function analyzeEmail(
  subject: string,
  html: string,
  auth: SpamAuthInput,
  opts?: { hasListUnsubHeader?: boolean },
): SpamReport {
  const ctx = parseEmail(subject, html);
  const F: SpamFinding[] = [];
  const add = (id: string, category: string, points: number, message: string, signals: Signal) =>
    F.push({ id, category, severity: points === 0 ? "unknown" : sev(points), message, points, signals });

  // A. Authentication
  const authPts: Record<AuthStatus, number> = { pass: 0, warn: 2, fail: 4, info: 0 };
  if (auth.spf === "fail") add("auth.spf_fail", "Authentication", 4, "SPF fails — receiving servers can't verify your sending IP.", "spam");
  else if (auth.spf === "warn") add("auth.spf_warn", "Authentication", 2, "SPF DNS check needs review; ~all alone does not mean an authorized message fails SPF.", "spam");
  if (auth.dkim === "fail") add("auth.dkim_fail", "Authentication", 4, "DKIM is missing/invalid — your mail isn't cryptographically signed.", "spam");
  else if (auth.dkim === "warn") add("auth.dkim_warn", "Authentication", 2, "DKIM not confirmed at common selectors.", "spam");
  if (auth.dmarc === "fail") add("auth.dmarc_fail", "Authentication", 3, "DMARC fails or is broken (e.g. duplicate records) — no enforcement.", "spam");
  else if (auth.dmarc === "warn") add("auth.dmarc_warn", "Authentication", 0, "Review DMARC policy. A valid p=none policy meets Gmail’s minimum policy requirement and does not imply message authentication failure.", "inbox");
  if (auth.spf === "pass" && auth.dkim === "pass" && auth.dmarc === "pass")
    add("auth.all_pass_bonus", "Authentication", -2, "SPF, DKIM and DMARC DNS checks pass; received-message alignment still needs verification.", "inbox");
  const authHardFail = auth.spf === "fail" || auth.dkim === "fail" || auth.dmarc === "fail";

  // B. Content / spam words
  const subjHits = findTriggers(ctx.subject);
  if (subjHits.length) {
    const pts = Math.min(subjHits.length * 1.5, 3);
    add("content.spamword_subject", "Content", pts, `Subject wording worth reviewing (not a Gmail keyword rule): ${[...new Set(subjHits.map((h) => `"${h.term}"`))].slice(0, 4).join(", ")}.`, "spam");
  }
  const bodyHits = findTriggers(ctx.text);
  const highCats = new Set(bodyHits.filter((h) => HIGH_RISK_CATEGORIES.has(h.category)).map((h) => h.category));
  if (highCats.size) {
    const pts = Math.min(highCats.size * 2.5, 5);
    add("content.high_risk_phrase", "Content", pts, `Body uses high-risk language (${[...highCats].join(", ").replace(/_/g, " ")}) that deserves an editorial review; this does not establish why Gmail filtered a message.`, "spam");
  }
  const medLowHits = bodyHits.filter((h) => !HIGH_RISK_CATEGORIES.has(h.category));
  if (medLowHits.length) {
    const density = medLowHits.length / Math.max(ctx.words / 100, 1);
    let pts = 0.5 * Math.min(medLowHits.length, 6);
    if (density > 3) pts += 1.5;
    add("content.spamword_body_density", "Content", +pts.toFixed(2), `Body stacks ${medLowHits.length} salesy/urgency phrases${density > 3 ? " at high density" : ""}.`, "spam");
  }
  if (ctx.text.length < 15 && ctx.imgs.length === 0)
    add("content.empty_body", "Content", 2.3, "Almost no readable text — empty or near-empty bodies look like spam.", "spam");

  // C. Formatting
  if (upperFraction(ctx.subject) >= 0.7 && ctx.subject.replace(/[^a-zA-Z]/g, "").length >= 8)
    add("fmt.subj_all_caps", "Formatting", 1, "Subject is mostly UPPERCASE — reads as shouting/promotional.", "promotions");
  else if ((ctx.subject.match(/\b[A-Z]{3,}\b/g) || []).length >= 3)
    add("fmt.subj_caps_words", "Formatting", 0.5, "Several ALL-CAPS words in the subject.", "promotions");
  const bodyUpper = upperFraction(ctx.text);
  if (ctx.text.replace(/[^a-zA-Z]/g, "").length >= 200) {
    if (bodyUpper > 0.75) add("fmt.body_caps", "Formatting", 1.5, "Body is overwhelmingly UPPERCASE.", "spam");
    else if (bodyUpper > 0.5) add("fmt.body_caps", "Formatting", 0.8, "Body has a lot of UPPERCASE text.", "spam");
  }
  if (/(!{2,}|\?{2,}|!\?|\?!)/.test(ctx.subject) || (ctx.subject.match(/!/g) || []).length >= 3)
    add("fmt.excess_punct", "Formatting", 1, "Excessive punctuation in the subject (!!! / ?!).", "promotions");
  if (/\${3,}|€{2,}|(?:[$€£]\s*){2,}/.test(ctx.subject))
    add("fmt.money_symbols", "Formatting", 1, "Multiple/heavy currency symbols in the subject.", "spam");
  if (/\b(?:[a-zA-Z][\s.\-_]){3,}[a-zA-Z]\b/.test(ctx.subject + " " + ctx.text.slice(0, 400)))
    add("fmt.gappy_text", "Formatting", 1, "Spaced-out letters (e.g. F R E E) — a classic filter-evasion pattern.", "spam");
  if (countEmoji(ctx.subject) >= 4)
    add("fmt.emoji_stuffed", "Formatting", 0.5, "Many emoji in the subject — promotional signal.", "promotions");
  if (/^\s*(re|fwd):/i.test(ctx.subject))
    add("fmt.deceptive_reply", "Formatting", 2, "Subject starts with Re:/Fwd: on a first-touch send — looks deceptive.", "spam");
  if (!ctx.subject.trim()) add("fmt.subj_length", "Formatting", 1, "Empty subject line.", "promotions");
  else if (ctx.subject.length > 70) add("fmt.subj_length", "Formatting", 0.3, "Subject is long (>70 chars) and may be truncated.", "promotions");
  if (/(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(px)?|font-size\s*:\s*1px)/i.test(html))
    add("fmt.hidden_text", "Formatting", 2, "Hidden markup detected. Confirm it is a normal preview-text block or tracking pixel, not misleading content.", "spam");

  // D. Links & images
  const textLen = ctx.text.length;
  const imgCount = ctx.imgs.length;
  if (imgCount >= 1 && textLen < 100) add("img.image_only", "Links & images", 2.8, "Image-only (almost no text) — image-only emails very often land in spam.", "spam");
  else if (imgCount >= 1 && textLen >= 100 && textLen < 400) add("img.heavy_ratio", "Links & images", 1.5, "Image-heavy with little text — leans promotional.", "promotions");
  if (imgCount === 1 && textLen < 200 && ctx.hasLinkedImage) add("img.single_linked_image", "Links & images", 2.2, "A single clickable image with little text is a known spam pattern.", "spam");
  if (ctx.imgs.some((i) => !i.hasAlt)) add("img.no_alt", "Links & images", 0.3, "Some images lack alt text.", "promotions");
  const shortenerLinks = ctx.links.filter((l) => LINK_SHORTENERS.includes(l.host));
  if (shortenerLinks.length) add("link.shortener", "Links & images", Math.min(shortenerLinks.length * 1.5, 3), "Uses link shorteners (bit.ly etc.). Prefer a recognizable destination so recipients know where the link leads.", "spam");
  if (ctx.links.some((l) => /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/.test(l.href))) add("link.ip_literal", "Links & images", 2, "A link points to a raw IP address.", "spam");
  const mismatch = ctx.links.find((l) => {
    const t = l.text.match(/\b([a-z0-9-]+\.[a-z]{2,})\b/i);
    return t && l.host && !l.host.includes(t[1].toLowerCase()) && !t[1].toLowerCase().includes(l.host);
  });
  if (mismatch) add("link.href_text_mismatch", "Links & images", 2, "A link's visible text shows a different domain than where it actually goes.", "spam");
  if (ctx.links.length > 3 && ctx.words < 200) add("link.high_density", "Links & images", 0.8, "Many links relative to the amount of text.", "promotions");
  if (ctx.links.some((l) => /^(click here|click now|download now)$/i.test(l.text.trim()))) add("link.bare_click_here", "Links & images", 0.5, '"Click here"-style anchor text instead of descriptive links.', "spam");

  // E. Compliance
  const bodyUnsub = /unsubscribe|opt.?out|email preferences/i.test(ctx.text) || /mailto:[^"']*unsubscribe/i.test(html) || /href=["'][^"']*unsubscrib/i.test(html);
  const hasUnsub = bodyUnsub || !!opts?.hasListUnsubHeader;
  if (!hasUnsub) add("compliance.no_unsub_link", "Compliance", 1.5, "No unsubscribe mechanism detected in this input. Check the final visible opt-out link and one-click headers.", "promotions");
  else if (!bodyUnsub && opts?.hasListUnsubHeader) add("compliance.list_unsub_header", "Compliance", 0, "The sending path is configured to add one-click headers; verify the received headers and visible unsubscribe link.", "inbox");
  else add("compliance.unsub_present_bonus", "Compliance", -0.3, "Unsubscribe link present in the body.", "promotions");
  if (!/\b\d{1,5}\s+[A-Za-z0-9.\s]+,\s*[A-Za-z\s]+,?\s*[A-Z]{2}\b|\b[A-Z]{2}\s*\d{5}\b/.test(ctx.text))
    add("compliance.no_physical_address", "Compliance", 0.5, "No physical mailing address found in this input. Check the final commercial-email footer.", "promotions");
  if (html.includes(GTUBE)) add("compliance.gtube", "Compliance", 1000, "Contains a standard spam-filter test string; remove before outreach.", "spam");

  // ── Aggregate ──
  const spamPoints = +F.reduce((s, f) => s + f.points, 0).toFixed(2);
  const promoPoints = +F.filter((f) => f.signals === "promotions" && f.points > 0).reduce((s, f) => s + f.points, 0).toFixed(2);
  const score = Math.max(0, Math.min(100, Math.round(100 - spamPoints * 14)));
  const fired = new Set(F.map((f) => f.id));

  // ── Staged placement ──
  let placement: SpamReport["placement"];
  let placementReason: string;
  const gateFlags = ["fmt.hidden_text", "link.href_text_mismatch", "link.ip_literal", "img.image_only"].filter((id) => fired.has(id));
  if (authHardFail) {
    placement = "spam";
    placementReason = "Authentication checks are incomplete or failing. DNS alone cannot establish message alignment or inbox placement.";
  } else if (spamPoints >= 5) {
    placement = "spam";
    placementReason = "Multiple local content concerns need review; this is not a Gmail filtering threshold.";
  } else if (gateFlags.length) {
    placement = "spam";
    placementReason = "Markup or link patterns need review; their effect on Gmail placement is unknown.";
  } else if (promoPoints >= 2 || spamPoints >= 2.5) {
    placement = "promotions";
    placementReason = spamPoints >= 2.5 ? "Several local content concerns need review." : "Marketing-style markup detected. Promotions is an inbox category, not Spam.";
  } else {
    placement = "inbox";
    placementReason = "Fewer local concerns found. Inbox placement and reputation remain unverified.";
  }

  const notEvaluated = [
    { id: "rep.ip_rbl", message: "Sending IP / domain blocklist status (Spamhaus, SpamCop, Barracuda) — needs a live blocklist lookup." },
    { id: "rep.ptr", message: "Reverse-DNS / PTR of the sending IP — not visible from message content." },
    { id: "rep.uribl", message: "Whether your link domains are blocklisted (URIBL/SURBL) — needs a live DNS lookup." },
    { id: "rep.reputation", message: "Your sender reputation, complaint rate and warmup — needs Google Postmaster Tools / sending history." },
    { id: "rep.seed", message: "True per-provider inbox/spam/Promotions placement — needs a seed-mailbox network (GlockApps/MailReach). Local rules cannot predict Gmail placement." },
    { id: "hdr.list_unsub", message: "List-Unsubscribe header (one-click) lives in headers, not the body — this app now adds it on cold sends; verify in your ESP." },
  ];

  return {
    contentRisk: placement === "spam" ? "high" : placement === "promotions" ? "review" : "lower",
    score,
    spamScore: spamPoints,
    promoPoints,
    placement,
    placementReason,
    findings: F.sort((a, b) => b.points - a.points),
    notEvaluated,
    stats: {
      subjectLength: ctx.subject.length,
      wordCount: ctx.words,
      visibleTextLength: textLen,
      linkCount: ctx.links.length,
      imageCount: imgCount,
      hasUnsubscribe: hasUnsub,
      htmlBytes: Buffer.byteLength(html, "utf8"),
    },
    auth,
  };
}

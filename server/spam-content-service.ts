// ─────────────────────────────────────────────────────────────────────────────
// Spam-content checker — a deterministic, SpamAssassin-style linter that scores
// an email's subject + body for the signals mailbox providers (and content
// filters) penalise. Mirrors what Instantly/Smartlead surface in their content
// checker, but runs locally with no external dependency or per-check cost.
//
// Convention: each rule adds POSITIVE points when it fires (more points = more
// spammy), exactly like SpamAssassin. We then map the total to:
//   score  < 2.0  → "clean"   (green)
//   score  < 5.0  → "caution" (amber)
//   score >= 5.0  → "spammy"  (red)   ← SpamAssassin's classic threshold
// and a 0–100 "health" (100 = pristine) for the UI gauge.
// ─────────────────────────────────────────────────────────────────────────────

export type SpamVerdict = "clean" | "caution" | "spammy";

export interface SpamRuleHit {
  id: string;
  label: string;
  points: number;
  detail: string;
}

export interface SpamCheckResult {
  score: number; // total points (higher = worse)
  health: number; // 0–100 (higher = better)
  verdict: SpamVerdict;
  hits: SpamRuleHit[];
  stats: {
    subjectLength: number;
    bodyTextLength: number;
    linkCount: number;
    imageCount: number;
    wordCount: number;
    capsWordCount: number;
    exclamations: number;
  };
}

// ── Spam-trigger lexicon (categorised) ────────────────────────────────────────
// Curated from public SpamAssassin rule sets + the common cold-email trigger
// lists Instantly/Smartlead/Mailmeteor publish. Matched case-insensitively as
// whole phrases. Weighted: money/urgency/overpromise hit hardest.
const TRIGGER_GROUPS: { id: string; weight: number; phrases: string[] }[] = [
  {
    id: "money",
    weight: 0.9,
    phrases: [
      "100% free", "free money", "make money", "earn money", "earn $", "extra cash",
      "easy money", "double your", "cash bonus", "money back", "no cost", "no fees",
      "pure profit", "million dollars", "get paid", "$$$", "fast cash", "best price",
      "lowest price", "cheap", "discount", "save big", "save up to",
    ],
  },
  {
    id: "urgency",
    weight: 0.8,
    phrases: [
      "act now", "act immediately", "apply now", "buy now", "call now", "order now",
      "limited time", "limited offer", "offer expires", "expires today", "while supplies last",
      "urgent", "don't delete", "don't hesitate", "once in a lifetime", "now only", "hurry",
      "instant", "immediately", "this won't last", "final notice",
    ],
  },
  {
    id: "overpromise",
    weight: 0.9,
    phrases: [
      "guarantee", "guaranteed", "risk free", "risk-free", "no risk", "100% satisfied",
      "no questions asked", "no obligation", "no strings attached", "promise you",
      "amazing", "incredible deal", "miracle", "once in a lifetime", "you have been selected",
      "you're a winner", "congratulations you", "claim your", "free gift", "winner",
    ],
  },
  {
    id: "salesy",
    weight: 0.5,
    phrases: [
      "click here", "click below", "click this link", "open now", "this is not spam",
      "not spam", "dear friend", "dear valued", "increase sales", "increase traffic",
      "boost your", "unsubscribe to stop", "as seen on", "special promotion", "exclusive deal",
    ],
  },
  {
    id: "scammy",
    weight: 1.4,
    phrases: [
      "viagra", "cialis", "weight loss", "lose weight", "online pharmacy", "casino",
      "lottery", "nigerian prince", "wire transfer fee", "bitcoin doubler", "crypto giveaway",
      "work from home", "be your own boss", "investment opportunity of",
    ],
  },
];

const URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "t.co", "buff.ly", "is.gd", "cutt.ly",
  "rebrand.ly", "shorturl.at", "rb.gy", "tiny.cc",
];

function countMatches(haystack: string, needle: string): number {
  if (!needle) return 0;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (haystack.match(new RegExp(esc, "gi")) || []).length;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkSpamContent(subjectRaw: string, htmlRaw: string): SpamCheckResult {
  const subject = (subjectRaw || "").trim();
  const html = htmlRaw || "";
  const text = stripHtml(html);
  const lowerAll = `${subject}\n${text}`.toLowerCase();

  const hits: SpamRuleHit[] = [];
  const add = (id: string, label: string, points: number, detail: string) =>
    hits.push({ id, label, points: +points.toFixed(2), detail });

  // ── Subject rules ───────────────────────────────────────────────────────────
  const subjLetters = subject.replace(/[^a-zA-Z]/g, "");
  const subjUpper = subject.replace(/[^A-Z]/g, "");
  if (!subject) {
    add("subj-empty", "Empty subject line", 2.5, "Messages with no subject are a strong spam signal and hurt opens.");
  } else {
    if (subjLetters.length >= 6 && subjUpper.length / subjLetters.length > 0.7) {
      add("subj-caps", "Subject is mostly UPPERCASE", 2, "All-caps subjects read as shouting and are heavily penalised.");
    }
    if (subject.length > 70) {
      add("subj-long", "Subject is very long", 0.5, `${subject.length} chars — keep subjects under ~60 for inbox display and trust.`);
    }
    const subjBang = countMatches(subject, "!");
    if (subjBang >= 2) add("subj-bang", "Multiple exclamation marks in subject", 1.5, `${subjBang} "!" in the subject.`);
    if (/\?{2,}|!{2,}|\$|free|winner|urgent|congratulations/i.test(subject)) {
      add("subj-trigger", "Spam-trigger styling in subject", 1.2, "Subject contains $, repeated punctuation, or a high-risk word (free/winner/urgent/etc.).");
    }
  }

  // ── Trigger lexicon (subject weighted heavier) ───────────────────────────────
  for (const g of TRIGGER_GROUPS) {
    const found: string[] = [];
    let pts = 0;
    for (const p of g.phrases) {
      const inSubj = countMatches(subject, p);
      const inBody = countMatches(text, p);
      if (inSubj + inBody > 0) {
        found.push(p);
        pts += g.weight * (inSubj * 1.5 + inBody); // subject hits weighted 1.5×
      }
    }
    if (found.length) {
      add(
        `trigger-${g.id}`,
        `${g.id[0].toUpperCase()}${g.id.slice(1)} trigger phrases`,
        Math.min(pts, g.weight * 4), // cap so one category can't dominate
        `Matched: ${found.slice(0, 6).join(", ")}${found.length > 6 ? "…" : ""}`,
      );
    }
  }

  // ── Links ────────────────────────────────────────────────────────────────────
  const links = html.match(/href\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi) || [];
  const linkCount = links.length;
  if (linkCount > 10) add("links-many", "Too many links", 2.5, `${linkCount} links — keep cold email to 1–2.`);
  else if (linkCount > 4) add("links-some", "High link count", 1.2, `${linkCount} links — fewer is safer (ideally 1).`);

  const shortenerHit = URL_SHORTENERS.filter((s) => lowerAll.includes(s));
  if (shortenerHit.length) add("links-shortener", "URL shortener detected", 1.5, `Shorteners hide the destination and are filtered: ${shortenerHit.join(", ")}.`);

  if (/href\s*=\s*["']?https?:\/\/\d{1,3}(\.\d{1,3}){3}/i.test(html)) {
    add("links-ip", "Link points to a bare IP address", 2, "Raw-IP links are a classic phishing/spam signal.");
  }

  // ── Images vs text ratio ──────────────────────────────────────────────────────
  const images = html.match(/<img\b/gi) || [];
  const imageCount = images.length;
  if (imageCount > 0 && text.length < 200) {
    add("image-heavy", "Image-heavy with little text", 2, `${imageCount} image(s) but only ${text.length} chars of text — image-only mail is filtered.`);
  } else if (imageCount > 0 && text.length / imageCount < 120) {
    add("image-ratio", "Low text-to-image ratio", 1, `${imageCount} image(s) vs ${text.length} chars of text.`);
  }

  // ── Hidden / deceptive content ────────────────────────────────────────────────
  if (/font-size\s*:\s*0(px|pt|em)?|font-size\s*:\s*1px|color\s*:\s*#fff(fff)?\b|display\s*:\s*none|visibility\s*:\s*hidden/i.test(html)) {
    add("hidden-text", "Hidden or invisible text", 2, "Zero/tiny-font or white-on-white text is treated as cloaking.");
  }

  // ── Body styling ──────────────────────────────────────────────────────────────
  const exclamations = countMatches(text, "!");
  if (exclamations >= 4) add("body-bang", "Excessive exclamation marks", 1, `${exclamations} "!" in the body.`);

  const words = text.split(/\s+/).filter(Boolean);
  const capsWords = words.filter((w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (capsWords.length >= 5) add("body-caps", "Many ALL-CAPS words", 1, `${capsWords.length} all-caps words — looks like shouting.`);

  const dollarRuns = (text.match(/\$\s?\d/g) || []).length;
  if (dollarRuns >= 3) add("body-money", "Lots of dollar amounts", 0.8, `${dollarRuns} price/money mentions.`);

  if (text.length < 40 && imageCount === 0) {
    add("body-thin", "Very little body content", 0.8, "Extremely short bodies look templated/automated.");
  }

  // ── Compliance hints (not heavily scored — the app injects unsubscribe itself) ─
  if (!/unsubscribe|opt[- ]?out/i.test(lowerAll)) {
    add("no-unsub-text", "No visible unsubscribe language", 0.5, "Bulk mail should show an unsubscribe option (the platform injects a List-Unsubscribe header automatically, but a visible link helps).");
  }

  const score = +hits.reduce((s, h) => s + h.points, 0).toFixed(2);
  const verdict: SpamVerdict = score >= 5 ? "spammy" : score >= 2 ? "caution" : "clean";
  // Map score → health: 0 pts = 100, ~10 pts ≈ 0.
  const health = Math.max(0, Math.min(100, Math.round(100 - score * 10)));

  return {
    score,
    health,
    verdict,
    hits: hits.sort((a, b) => b.points - a.points),
    stats: {
      subjectLength: subject.length,
      bodyTextLength: text.length,
      linkCount,
      imageCount,
      wordCount: words.length,
      capsWordCount: capsWords.length,
      exclamations,
    },
  };
}

/**
 * One-sentence "why this firm" hook scraped from a homepage / about page.
 * Used only in the first email so it doesn't read like a blast.
 */

import * as cheerio from "cheerio";

const HOOK_RE =
  /\b(e-?2|treaty investor|investor visa|eb-?5|visa inversionista|franchise|immigration|inmigraci[oó]n|relocati|wealth|private client)\b/i;

function firstSentences(text: string, max = 180): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const cut = cleaned.slice(0, max);
  const stop = cut.search(/[.!?](\s|$)/);
  return (stop > 40 ? cut.slice(0, stop + 1) : cut).trim();
}

export async function fetchFirmHook(website: string | null | undefined): Promise<string | null> {
  const raw = (website || "").trim();
  if (!raw) return null;
  const url = raw.startsWith("http") ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "NewDawnFranchising/1.0 (+https://www.newdawnfranchising.com)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer").remove();
    const chunks = [
      $("meta[name='description']").attr("content") ?? "",
      $("h1").first().text(),
      $("p").slice(0, 8).text(),
    ];
    for (const chunk of chunks) {
      if (HOOK_RE.test(chunk)) {
        const sentence = firstSentences(chunk);
        if (sentence.length >= 40) return sentence;
      }
    }
    const fallback = firstSentences(chunks.filter(Boolean).join(" "));
    return fallback.length >= 40 ? fallback : null;
  } catch {
    return null;
  }
}

export function hookParagraph(hook: string | null | undefined, firmName?: string | null): string {
  const h = (hook || "").trim();
  if (h) return `I was looking at ${firmName ? `${firmName} — ` : ""}${h.replace(/\.$/, "")}. `;
  if (firmName) return `I came across ${firmName} while looking for advisors who already sit with E-2 clients. `;
  return "";
}

/**
 * IndexNow integration.
 *
 * IndexNow lets a site instantly notify participating search engines (Bing,
 * Yandex, Seznam, Naver) when content is added or changed — no account login
 * required. Ownership is proven by hosting a key file at
 * https://<host>/<key>.txt that returns the key. Bing's index also powers
 * ChatGPT search, so this directly helps AI-answer pickup.
 *
 * Note: Google does NOT participate in IndexNow — it still requires a one-time
 * sitemap submission in Google Search Console.
 */

const SITE_URL = "https://newdawnfranchising.com";
const HOST = "newdawnfranchising.com";

// Public-by-design key (it is exposed in the key file). Override via env if desired.
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "01579a0bb477569ba9028876bc4ba744";

/** Path of the verification key file, e.g. "/01579....txt". */
export const indexNowKeyFilePath = `/${INDEXNOW_KEY}.txt`;
/** Absolute URL of the verification key file. */
export const indexNowKeyLocation = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

export type IndexNowResult = {
  success: boolean;
  status?: number;
  message: string;
  submitted: number;
};

/** Notify IndexNow of one or more changed URLs (deduped, capped at 10,000 per request). */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const list = Array.from(new Set(urls.filter(Boolean))).slice(0, 10000);
  if (list.length === 0) {
    return { success: true, message: "No URLs to submit", submitted: 0 };
  }

  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: indexNowKeyLocation,
    urlList: list,
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    // 200 = received, 202 = accepted/validated asynchronously.
    const success = res.status === 200 || res.status === 202;
    const message = success
      ? `IndexNow accepted ${list.length} URL(s) (HTTP ${res.status})`
      : `IndexNow returned HTTP ${res.status}`;
    console.log(`[IndexNow] ${message}`);
    return { success, status: res.status, message, submitted: success ? list.length : 0 };
  } catch (err: any) {
    console.error("[IndexNow] submit failed:", err?.message);
    return { success: false, message: err?.message || "IndexNow request failed", submitted: 0 };
  }
}

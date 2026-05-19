const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const BASE_URL_APIFY = "https://api.apify.com/v2";

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

interface RedditPost {
  title: string;
  url: string;
  author: string;
  body: string;
  subreddit: string;
  score: number;
  createdAt?: string;
}

interface QuoraQuestion {
  title: string;
  url: string;
  body?: string;
  author?: string;
}

async function runActor(actorId: string, input: any, timeoutSecs = 120): Promise<any[]> {
  if (!APIFY_TOKEN) {
    console.warn("[Apify] No APIFY_API_TOKEN set — skipping");
    return [];
  }

  const runRes = await fetch(`${BASE_URL_APIFY}/acts/${actorId}/runs?token=${APIFY_TOKEN}&timeout=${timeoutSecs}&waitForFinish=${timeoutSecs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!runRes.ok) {
    console.error("[Apify] Failed to start actor:", actorId, await runRes.text());
    return [];
  }

  const runData = await runRes.json() as { data: ApifyRun };
  const run = runData.data;

  if (run.status !== "SUCCEEDED") {
    console.warn("[Apify] Actor did not succeed:", run.status);
    return [];
  }

  const dataRes = await fetch(
    `${BASE_URL_APIFY}/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=50`,
  );
  if (!dataRes.ok) return [];
  return dataRes.json() as Promise<any[]>;
}

// ─── Reddit monitoring ────────────────────────────────────────────────────────

const REDDIT_SUBREDDITS = [
  "franchising", "immigration", "investing", "entrepreneur",
  "personalfinance", "smallbusiness", "IWantOut", "expats",
  "EB5visa", "visas", "FranchisedBusinesses",
];

const FRANCHISE_KEYWORDS = [
  "E-2 visa franchise", "EB-5 franchise", "investor visa franchise",
  "best franchise investor visa", "buy franchise US visa",
  "franchise investment US green card", "New Dawn Franchising",
  "franchise consulting immigrants", "franchise for E2 visa",
];

export async function monitorReddit(): Promise<RedditPost[]> {
  if (!APIFY_TOKEN) return [];

  const results: RedditPost[] = [];

  for (const subreddit of REDDIT_SUBREDDITS.slice(0, 4)) {
    try {
      const items = await runActor("trudax~reddit-scraper-lite", {
        startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/new/` }],
        maxItems: 20,
        proxy: { useApifyProxy: true },
      }, 90);

      for (const item of items) {
        const title = (item.title || "").toLowerCase();
        const body = (item.body || item.text || "").toLowerCase();
        const combined = `${title} ${body}`;

        const isRelevant = FRANCHISE_KEYWORDS.some(kw => combined.includes(kw.toLowerCase())) ||
          combined.includes("franchise") && (combined.includes("visa") || combined.includes("invest") || combined.includes("immigration"));

        if (isRelevant) {
          results.push({
            title: item.title || "Untitled",
            url: item.url || `https://reddit.com/r/${subreddit}`,
            author: item.author || "unknown",
            body: (item.body || item.text || "").slice(0, 1000),
            subreddit,
            score: item.score || 0,
            createdAt: item.createdAt,
          });
        }
      }
    } catch (e) {
      console.error(`[Apify] Reddit scrape error for r/${subreddit}:`, e);
    }
  }

  return results;
}

// ─── Quora monitoring ─────────────────────────────────────────────────────────

const QUORA_QUERIES = [
  "E-2 visa franchise investment",
  "best franchise for investor visa",
  "buying US franchise from abroad",
  "EB-5 franchise investment",
  "franchise for US green card",
];

export async function monitorQuora(): Promise<QuoraQuestion[]> {
  if (!APIFY_TOKEN) return [];

  const results: QuoraQuestion[] = [];

  try {
    // Run all queries in a single actor call for efficiency
    const items = await runActor("alizarin_refrigerator-owner~quora-research", {
      queries: QUORA_QUERIES.slice(0, 3),
      maxQuestionsPerQuery: 8,
      proxy: { useApifyProxy: true },
    }, 120);

    for (const item of items) {
      if (item.url && item.title) {
        // Extract body from top answers if available
        const topAnswer = item.topAnswers?.[0];
        const body = (topAnswer?.content || topAnswer?.text || item.description || "").slice(0, 800);
        const author = topAnswer?.author || "Quora user";

        results.push({
          title: item.title,
          url: item.url,
          body,
          author,
        });
      }
    }
  } catch (e) {
    console.error("[Apify] Quora scrape error:", e);
  }

  return results;
}

export async function isApifyConfigured(): Promise<boolean> {
  return !!APIFY_TOKEN;
}

import { db } from "./db";
import { forumAccounts, agentForumPosts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sendAgentSms } from "./agent-sms-service";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt: string, maxTokens = 400): Promise<string> {
  if (!ANTHROPIC_KEY) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { content: { text: string }[] };
  return data.content[0]?.text ?? "";
}

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// Search phrases that indicate relevant discussions
const SCAN_QUERIES = [
  "E-2 visa franchise",
  "E2 visa franchise investment",
  "E-2 investor visa business",
  "E2 visa property management",
  "treaty investor visa franchise",
  "immigrant investor franchise USA",
  "e2 visa qualifying business",
  "immigration franchise investment",
];

// Maps forum names to a domain filter for SerpAPI
const FORUM_DOMAIN_MAP: Record<string, string | null> = {
  "Visa Journey Forums": "visajourney.com",
  "Reddit r/immigration": "reddit.com/r/immigration",
  "Reddit r/expats": "reddit.com/r/expats",
  "Reddit r/Entrepreneur": "reddit.com/r/Entrepreneur",
  "Expat Forum": "expatforum.com",
  "Expat Exchange": "expatexchange.com",
  "BiggerPockets Forums": "biggerpockets.com",
  "ImmiHelp E-2 Visa Forum": "immihelp.com",
  "Blue MauMau": "bluemaumau.org",
  "Quora — E-2 Visa Topics": "quora.com",
  "FranchiseChat.com": "franchisechat.com",
  "Boundless Immigration Blog": "boundless.com",
  "CitizenPath Blog": "citizenpath.com",
  "ImmigrationProf Blog": "lawprofessors.typepad.com",
  "Visa Law Group Blog": "visalawgroup.com",
};

interface SerpResult {
  title: string;
  link: string;
  snippet: string;
}

async function searchSerp(query: string, siteFilter?: string | null): Promise<SerpResult[]> {
  if (!SERPAPI_KEY) return [];
  const q = siteFilter ? `site:${siteFilter} ${query}` : query;
  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", q);
    url.searchParams.set("api_key", SERPAPI_KEY);
    url.searchParams.set("num", "5");
    url.searchParams.set("tbs", "qdr:w"); // last week
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json() as { organic_results?: { title: string; link: string; snippet: string }[] };
    return (data.organic_results ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

async function draftReply(
  postTitle: string,
  postSnippet: string,
  forumName: string,
  username: string | null
): Promise<string> {
  const prompt = `You are ${username || "a helpful community member"} posting on ${forumName}.

A forum post has been found that's relevant to New Dawn Franchising — a $250,000 property management franchise in El Paso, TX designed specifically for E-2 Treaty Investor Visa applicants.

POST TITLE: "${postTitle}"
POST SNIPPET: "${postSnippet}"

Write a genuine, helpful reply (150–250 words) that:
1. Directly addresses the question or discussion point first — be ACTUALLY helpful, not salesy
2. Naturally and briefly mentions New Dawn Franchising as ONE example/option (not the only one)
3. Keeps the tone conversational and human — NO buzzwords, NO hype
4. Ends with a soft invitation (e.g. "happy to answer questions" or "feel free to DM me")
5. Does NOT start with "Great question!" or generic openers
6. Does NOT sound like an ad

The mention of New Dawn should feel organic — like someone sharing a real recommendation, not a pitch. The reply should stand on its own as useful content even if you remove the New Dawn mention.

Reply only with the post content, no preamble.`;

  try {
    const reply = await callClaude(prompt, 400);
    return reply.trim();
  } catch (err) {
    console.error("[ForumScanner] Claude draft failed:", err);
    return "";
  }
}

export async function scanForumsForOpportunities(): Promise<number> {
  const accounts = await db.select().from(forumAccounts).where(eq(forumAccounts.autoScanEnabled, true));

  if (accounts.length === 0) {
    console.log("[ForumScanner] No forum accounts with auto-scan enabled — skipping");
    return 0;
  }

  let drafted = 0;

  for (const account of accounts) {
    const domain = FORUM_DOMAIN_MAP[account.forumName] ?? null;

    // Pick 2 random queries to avoid hammering SerpAPI
    const queries = SCAN_QUERIES.sort(() => Math.random() - 0.5).slice(0, 2);

    for (const query of queries) {
      const results = await searchSerp(query, domain);

      for (const result of results.slice(0, 2)) {
        // Check if we've already drafted a reply for this URL
        const existing = await db
          .select({ id: agentForumPosts.id })
          .from(agentForumPosts)
          .where(eq(agentForumPosts.postUrl, result.link))
          .limit(1);

        if (existing.length > 0) continue;

        const reply = await draftReply(
          result.title,
          result.snippet,
          account.forumName,
          account.username
        );
        if (!reply) continue;

        const approvalToken = randomUUID();
        const base = process.env.APP_BASE_URL ?? "https://newdawnfranchising.replit.app";
        const approvalUrl = `${base}/approve/forum/${approvalToken}`;

        await db.insert(agentForumPosts).values({
          platform: account.forumName,
          postUrl: result.link,
          postTitle: result.title,
          postBody: result.snippet,
          author: "SerpAPI",
          draftReply: reply,
          status: "awaiting_approval",
          approvalToken,
        });

        drafted++;
        console.log(`[ForumScanner] Drafted reply for "${result.title}" on ${account.forumName}`);

        // Send immediate SMS to Dylan — same flow as outreach
        try {
          const shortTitle = result.title.slice(0, 70);
          await sendAgentSms("outreach",
            `💬 Forum reply drafted for ${account.forumName}:\n"${shortTitle}"\n\nTap to approve:\n${approvalUrl}`
          );
        } catch (smsErr) {
          console.warn("[ForumScanner] SMS notify failed (non-fatal):", smsErr);
        }

        // Small delay between Claude calls
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Update lastScannedAt
    await db
      .update(forumAccounts)
      .set({ lastScannedAt: new Date(), updatedAt: new Date() })
      .where(eq(forumAccounts.id, account.id));
  }

  console.log(`[ForumScanner] Scan complete — ${drafted} new reply drafts created`);
  return drafted;
}

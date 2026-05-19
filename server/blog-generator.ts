import OpenAI from "openai";
import cron from "node-cron";
import { storage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const BLOG_TOPICS = [
  "Benefits of E-2 visa investment through property management franchises",
  "Why Fort Worth Texas is ideal for real estate investment",
  "How hands-off franchise ownership works for international investors",
  "Understanding the E-2 to EB-5 visa pathway through real estate",
  "Property management franchise vs starting from scratch",
  "What makes single-family rental management profitable in Texas",
  "Buy-back guarantee: How franchise investors protect their investment",
  "Living anywhere in the USA while owning a property management franchise",
  "How E-2 visa investors can build wealth through rental properties",
  "The referral program advantage in property management franchising",
  "Why long-term rentals outperform short-term vacation rentals",
  "Understanding territory rights in property management franchising",
  "How to qualify for an E-2 visa through franchise investment",
  "The role of a territory manager in a hands-off franchise model",
  "Fort Worth rental market trends and investment opportunities",
  "How New Dawn Franchising supports first-time franchise owners",
  "Building passive income through property management franchises",
  "Why international investors choose Texas for E-2 visa businesses",
  "The financial requirements for E-2 visa franchise investment",
  "How property management franchises create jobs for E-2 compliance",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function generateBlogPost(): Promise<void> {
  const existingPosts = await storage.getBlogPosts();
  const existingTitles = existingPosts.map((p) => p.title.toLowerCase());

  const availableTopics = BLOG_TOPICS.filter(
    (topic) => !existingTitles.some((t) => t.includes(topic.toLowerCase().slice(0, 30)))
  );

  const topic = availableTopics.length > 0
    ? availableTopics[Math.floor(Math.random() * availableTopics.length)]
    : BLOG_TOPICS[Math.floor(Math.random() * BLOG_TOPICS.length)];

  const prompt = `Write a professional blog post for New Dawn Franchising LLC, a property management franchise based in Fort Worth, Texas, targeting E-2 visa investors.

Topic: ${topic}

Key facts to incorporate naturally:
- New Dawn manages single-family long-term rentals in Fort Worth, Texas
- The franchise network has 300+ active contracts
- Investors can live anywhere in the USA while owning the franchise
- The franchise offers a buy-back guarantee
- There is a referral program for franchisees
- There is an E-2 to EB-5 visa pathway available
- Investors maintain financial control while a territory-approved manager handles day-to-day operations
- The CEO is Chris Von Pohlot

Format your response as JSON with these fields:
{
  "title": "SEO-optimized blog title (50-70 characters)",
  "excerpt": "Compelling summary for blog listing cards (150-200 characters)",
  "content": "Full blog post in Markdown format, 800-1200 words, with headers (##), bullet points, and a call to action at the end encouraging readers to contact New Dawn"
}

Write in a professional but approachable tone. Focus on providing genuine value to potential investors considering E-2 visa options.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    const parsed = JSON.parse(content);
    const slug = slugify(parsed.title) + "-" + Date.now().toString(36);

    await storage.createBlogPost({
      title: parsed.title,
      slug,
      excerpt: parsed.excerpt,
      content: parsed.content,
      generatedByAi: "true",
      publishedAt: new Date(),
    });

    console.log(`Blog post generated: "${parsed.title}"`);
  } catch (error) {
    console.error("Failed to generate blog post:", error);
  }
}

export function scheduleWeeklyBlogGeneration(): void {
  cron.schedule("0 12 * * 5", () => {
    console.log("Cron triggered: generating weekly blog post...");
    generateBlogPost();
  }, {
    timezone: "America/New_York",
  });
  console.log("Blog generation scheduled: Every Friday at 12:00 PM ET (America/New_York)");
}

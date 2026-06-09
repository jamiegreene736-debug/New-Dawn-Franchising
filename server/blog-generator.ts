import cron from "node-cron";
import { storage } from "./storage";
import { createLazyOpenAIClient } from "./openai-client";

const openai = createLazyOpenAIClient();

// Topics are phrased as the questions people actually type into AI assistants
// and search engines. This "answer engine optimization" framing makes the
// resulting posts easy for ChatGPT, Perplexity, and Google AI Overviews to quote.
const BLOG_TOPICS = [
  "What is the best franchise for an E-2 visa?",
  "How much do you need to invest for an E-2 visa franchise?",
  "Which industries work best for an E-2 visa franchise?",
  "What franchise options qualify for the E-2 visa?",
  "Is a property management franchise a good E-2 visa business?",
  "Is a telecom franchise a good E-2 visa business?",
  "Is an insurance franchise a good E-2 visa business?",
  "How do you choose the right E-2 visa franchise vertical?",
  "Why are recurring-revenue businesses good for the E-2 visa?",
  "Do you have to live in the US on an E-2 visa?",
  "How does a hands-off franchise work for E-2 visa investors?",
  "What is the difference between the E-2 and EB-5 visa?",
  "Can an E-2 visa lead to a green card?",
  "How long does it take to get an E-2 visa through a franchise?",
  "What countries are eligible for the E-2 visa?",
  "Can my family come with me on an E-2 visa?",
  "What are the requirements for an E-2 visa investment?",
  "Can you renew an E-2 visa indefinitely?",
  "What is a franchise buy-back program and how does it work?",
  "Why do international investors choose the USA for an E-2 business?",
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

  const prompt = `Write a professional blog post for New Dawn Franchising LLC, a multi-vertical franchisor specializing in E-2 Treaty Investor Visa-qualifying franchises, headquartered in El Paso, Texas.

Topic: ${topic}

This topic is phrased the way people ask AI assistants and search engines. Structure the post so AI answer engines (ChatGPT, Perplexity, Google AI Overviews) can quote it easily:
- If the topic is a question, use it (or a close variant) as the title and the opening H1.
- Open with a direct, self-contained 2-3 sentence answer to the question BEFORE expanding into detail.
- Use clear ## section headers phrased as the follow-up questions a reader would ask.
- Keep every claim specific and factual; avoid hype and vague superlatives.

Key facts to incorporate naturally:
- New Dawn is a multi-vertical franchisor for E-2 visa investors, not a single-industry franchise
- Investors choose from three recurring-revenue verticals: Property Management, Telecom, and Insurance
- These industries were selected for E-2 fit: recurring revenue, documented systems, supervisory control, staffing, and renewal-ready reporting
- Franchise investment starts at $225,000, structured to meet E-2 visa requirements
- Investors direct the business and control their bank accounts while approved local teams handle daily execution
- Investors can live anywhere in the USA while owning the franchise
- New Dawn offers an in-house buy-back program after approximately 4 years
- There is an E-2 to EB-5 visa pathway available
- The property management vertical operates single-family long-term rentals in El Paso, Texas, with 300+ active contracts
- Chris Von Pohlot is the Managing Director

Format your response as JSON with these fields:
{
  "title": "SEO-optimized blog title (50-70 characters); may be the question itself",
  "excerpt": "Compelling summary for blog listing cards (150-200 characters)",
  "content": "Full blog post in Markdown format, 800-1200 words, with an answer-first opening, ## headers, bullet points, and a call to action at the end encouraging readers to contact New Dawn and request the FDD"
}

Write in a professional but approachable tone. Focus on providing genuine, accurate value to potential investors considering E-2 visa options. Do not present this as legal or immigration advice; recommend consulting a qualified immigration attorney for individual cases.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 3000,
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

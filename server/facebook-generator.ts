import { storage } from "./storage";
import { createLazyOpenAIClient } from "./openai-client";

const openai = createLazyOpenAIClient();

const POST_THEMES = [
  "E-2 visa investment opportunity through property management",
  "Why El Paso Texas is a great market for rental property investment",
  "How director-led franchise ownership works for international investors: the franchisee directs, New Dawn implements the day-to-day",
  "Benefits of single-family long-term rental management",
  "Success story style post about franchise investor lifestyle",
  "Property management tips for rental property owners",
  "Why AI-powered property management is the future",
  "The E-2 to EB-5 visa pathway through real estate investment",
  "What makes New Dawn Franchising different from other franchises",
  "How our proprietary technology streamlines property management",
  "Referral program benefits for franchise owners",
  "El Paso real estate market update and investment insights",
  "A day in the life of a New Dawn franchise owner",
  "How international investors can build wealth in American real estate",
  "Territory rights and what they mean for franchise owners",
  "How our AI agents automate marketing and operations",
  "Star Spangled Banner Realty and real estate sales opportunities",
  "Why property management is a recession-resistant business model",
  "Buy-back guarantee and investor protection",
  "How to qualify for an E-2 visa through franchise investment",
];

export async function generateFacebookPost(): Promise<{ content: string; imagePrompt: string }> {
  const existingPosts = await storage.getFacebookPosts();
  const recentContent = existingPosts.slice(0, 10).map((p) => p.content.slice(0, 100));

  const theme = POST_THEMES[Math.floor(Math.random() * POST_THEMES.length)];

  const prompt = `Write an engaging Facebook post for New Dawn Franchising LLC, a property management franchise in El Paso, Texas, targeting E-2 visa investors.

Theme: ${theme}

Key facts to incorporate naturally (pick 2-3, don't force all):
- New Dawn manages single-family long-term rentals in El Paso, Texas
- The franchise network has 300+ active contracts
- Part of the New Dawn Franchising Group of Companies™
- AI-powered operations with proprietary technology
- Investors can live anywhere in the USA while owning the franchise
- Buy-back guarantee available
- Star Spangled Banner Realty is the real estate brokerage arm
- CEO is Chris Von Pohlot

Recent posts to avoid repeating (vary your approach):
${recentContent.map((c) => `- ${c}`).join("\n")}

Format your response as JSON:
{
  "content": "The Facebook post text. Keep it 100-250 words. Use an engaging hook, include relevant emojis naturally (2-4 max), add a clear call to action. Include 3-5 relevant hashtags at the end. Make it feel authentic and professional, not salesy.",
  "imagePrompt": "A short description (15-25 words) for an AI image that would complement this post. Focus on real estate, property, Texas, business themes."
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No content in AI response");

  const parsed = JSON.parse(raw);
  return {
    content: parsed.content,
    imagePrompt: parsed.imagePrompt || "",
  };
}

export async function generateAndSaveFacebookPost(): Promise<void> {
  try {
    const { content, imagePrompt } = await generateFacebookPost();
    await storage.createFacebookPost({
      content,
      imagePrompt,
      status: "draft",
    });
    console.log("Facebook post generated (draft)");
  } catch (error) {
    console.error("Failed to generate Facebook post:", error);
  }
}

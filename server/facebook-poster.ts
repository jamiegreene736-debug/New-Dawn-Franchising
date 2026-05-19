import cron from "node-cron";
import { storage } from "./storage";
import { generateFacebookPost } from "./facebook-generator";

const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v19.0";

async function publishToFacebook(content: string): Promise<{ id: string }> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new Error("Facebook Page ID or Access Token not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN environment variables.");
  }

  const response = await fetch(`${FACEBOOK_GRAPH_URL}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: content,
      access_token: accessToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Facebook API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return { id: data.id };
}

export async function postToFacebook(postId: string): Promise<void> {
  const post = await storage.getFacebookPost(postId);
  if (!post) throw new Error("Post not found");

  try {
    const result = await publishToFacebook(post.content);
    await storage.updateFacebookPost(postId, {
      status: "posted",
      postedAt: new Date(),
      facebookPostId: result.id,
      errorMessage: "",
    });
    console.log(`Facebook post published: ${result.id}`);
  } catch (error: any) {
    await storage.updateFacebookPost(postId, {
      status: "failed",
      errorMessage: error.message || "Unknown error",
    });
    console.error("Failed to post to Facebook:", error.message);
    throw error;
  }
}

let autoPostEnabled = false;

export function getAutoPostStatus(): boolean {
  return autoPostEnabled;
}

export function setAutoPostEnabled(enabled: boolean): void {
  autoPostEnabled = enabled;
  console.log(`Facebook auto-posting ${enabled ? "enabled" : "disabled"}`);
}

async function runDailyAutoPost(): Promise<void> {
  if (!autoPostEnabled) return;

  try {
    const scheduled = await storage.getScheduledFacebookPosts();
    if (scheduled.length > 0) {
      await postToFacebook(scheduled[0].id);
      return;
    }

    const { content, imagePrompt } = await generateFacebookPost();
    const post = await storage.createFacebookPost({
      content,
      imagePrompt,
      status: "scheduled",
    });
    await postToFacebook(post.id);
  } catch (error) {
    console.error("Daily Facebook auto-post failed:", error);
  }
}

export function scheduleDailyFacebookPosting(): void {
  cron.schedule("0 10 * * *", () => {
    console.log("Cron triggered: daily Facebook auto-post...");
    runDailyAutoPost();
  }, {
    timezone: "America/New_York",
  });
  console.log("Facebook auto-posting scheduled: Daily at 10:00 AM ET (America/New_York)");
}

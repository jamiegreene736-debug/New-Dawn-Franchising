// SLACK_WEBHOOK_URL can hold either:
//   • An Incoming Webhook URL  (starts with https://hooks.slack.com/...)
//   • A Slack OAuth/Bot token  (starts with xox...)
// The service detects which type and uses the appropriate API.

const SLACK_CRED = process.env.SLACK_WEBHOOK_URL;
const IS_WEBHOOK = SLACK_CRED?.startsWith("https://");
const IS_TOKEN   = SLACK_CRED?.startsWith("xox");

let _defaultChannel = "general";

export function setSlackChannel(channel: string) {
  _defaultChannel = channel.replace(/^#/, "");
}

export function isSlackConfigured(): boolean {
  return !!SLACK_CRED;
}

// Channel listing is only possible with OAuth tokens, not webhooks.
export async function listChannels(): Promise<Array<{ id: string; name: string; is_member: boolean }>> {
  if (!IS_TOKEN || !SLACK_CRED) return [];
  try {
    const res = await fetch("https://slack.com/api/conversations.list?limit=100&types=public_channel,private_channel", {
      headers: { Authorization: `Bearer ${SLACK_CRED}` },
    });
    const data = await res.json() as any;
    return (data.channels || []).map((c: any) => ({ id: c.id, name: c.name, is_member: c.is_member }));
  } catch {
    return [];
  }
}

// ─── Core send ────────────────────────────────────────────────────────────────

export async function sendSlackMessage(
  text: string,
  blocks?: any[],
  channel?: string,
): Promise<boolean> {
  if (!SLACK_CRED) {
    console.warn("[Slack] No credential configured — skipping notification");
    return false;
  }

  try {
    const payload: any = { text };
    if (blocks?.length) payload.blocks = blocks;

    if (IS_WEBHOOK) {
      // Incoming webhook — channel selection not supported, posts to pre-configured channel
      const res = await fetch(SLACK_CRED, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseText = await res.text();
      if (!res.ok && responseText !== "ok") {
        console.error(`[Slack] Webhook error: ${responseText}`);
        return false;
      }
      return true;
    } else if (IS_TOKEN) {
      // OAuth token — can target specific channels
      payload.channel = (channel || _defaultChannel).replace(/^#/, "");
      payload.unfurl_links = false;
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${SLACK_CRED}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as any;
      if (!data.ok) {
        console.error(`[Slack] chat.postMessage error:`, data.error);
        return false;
      }
      return true;
    } else {
      console.error("[Slack] Unrecognised credential format");
      return false;
    }
  } catch (e) {
    console.error("[Slack] sendSlackMessage error:", e);
    return false;
  }
}

// ─── Pre-built notification templates ────────────────────────────────────────

export async function notifyDailyBriefSent(opts: {
  date: string;
  staged: number;
  discovered: number;
  forumPosts: number;
  approveUrl: string;
  portalUrl: string;
}): Promise<boolean> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📬 NDF Agent Daily Brief Sent", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Date:*\n${opts.date}` },
        { type: "mrkdwn", text: `*Leads Staged:*\n${opts.staged}` },
        { type: "mrkdwn", text: `*New Leads Found:*\n${opts.discovered}` },
        { type: "mrkdwn", text: `*Forum Posts:*\n${opts.forumPosts}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: "Daily brief has been emailed. Reply YES to execute or visit the portal to approve." },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Agent Portal", emoji: true },
          url: opts.portalUrl,
          style: "primary",
        },
      ],
    },
  ];
  return sendSlackMessage(`📬 NDF Agent daily brief sent — ${opts.staged} leads staged for ${opts.date}`, blocks);
}

export async function notifyBatchExecuted(opts: {
  date: string;
  sent: number;
  failed: number;
  approvedBy: string;
  portalUrl: string;
}): Promise<boolean> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "✅ Outreach Batch Executed", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Date:*\n${opts.date}` },
        { type: "mrkdwn", text: `*Emails Sent:*\n${opts.sent}` },
        { type: "mrkdwn", text: `*Failed:*\n${opts.failed}` },
        { type: "mrkdwn", text: `*Approved By:*\n${opts.approvedBy}` },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Results", emoji: true },
          url: opts.portalUrl,
        },
      ],
    },
  ];
  return sendSlackMessage(`✅ Batch executed — ${opts.sent} emails sent (${opts.failed} failed) — approved by ${opts.approvedBy}`, blocks);
}

export async function notifyApprovalDeadline(opts: {
  date: string;
  staged: number;
  portalUrl: string;
}): Promise<boolean> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "⏰ Batch Auto-Held at 2 PM Deadline", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `The daily batch for *${opts.date}* was not approved before 2 PM Central. ${opts.staged} leads have been held and will roll over tomorrow.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Portal", emoji: true },
          url: opts.portalUrl,
          style: "danger",
        },
      ],
    },
  ];
  return sendSlackMessage(`⏰ Batch auto-held — no approval before 2 PM deadline`, blocks);
}

export async function notifyNewLeadReply(opts: {
  leadName: string;
  company: string;
  replySnippet: string;
  portalUrl: string;
}): Promise<boolean> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "💬 Lead Replied to Outreach", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Lead:*\n${opts.leadName}` },
        { type: "mrkdwn", text: `*Company:*\n${opts.company || "—"}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `_"${opts.replySnippet.slice(0, 280)}…"_` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Lead", emoji: true },
          url: opts.portalUrl,
          style: "primary",
        },
      ],
    },
  ];
  return sendSlackMessage(`💬 ${opts.leadName} replied to outreach`, blocks);
}

export async function notifyPreparationComplete(opts: {
  date: string;
  discovered: number;
  scored: number;
  staged: number;
  forumPosts: number;
}): Promise<boolean> {
  return sendSlackMessage(
    `🤖 Agent prep complete for ${opts.date}: ${opts.discovered} leads found · ${opts.scored} scored · ${opts.staged} staged · ${opts.forumPosts} forum posts`,
  );
}

export async function sendSlackTest(_channel?: string): Promise<boolean> {
  return sendSlackMessage(
    "✅ NDF Agent Slack connection test successful! Notifications are working.",
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *New Dawn Franchising AI Agent* is now connected to Slack.\n\nYou'll receive notifications for:\n• Daily brief sent\n• Batch executed\n• 2 PM auto-hold\n• Lead replies",
        },
      },
    ],
  );
}

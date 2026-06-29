/**
 * Public approval routes — no auth required, secured by token.
 * GET  /api/approve/seo/:token       → preview SEO draft
 * POST /api/approve/seo/:token       → approve | reject
 * GET  /api/approve/outreach/:token  → preview outreach touch
 * POST /api/approve/outreach/:token  → approve | reject (+ auto-send on approve)
 * GET  /api/approve/forum/:token     → preview forum reply draft
 * POST /api/approve/forum/:token     → approve | reject
 * GET  /api/approve/linkedin/:token  → preview LinkedIn queue item
 * POST /api/approve/linkedin/:token  → mark as sent | skip
 * GET  /api/approve/pending          → all pending items (for morning digest)
 * POST /api/approve/morning-digest   → manually trigger the morning digest SMS
 */

import { Router } from "express";
import { db } from "./db";
import {
  seoContentDrafts, outreachTouches, outreachLeads, seoCampaigns, outreachDailyPlans,
  agentForumPosts, forumAccounts, agentSmsMessages, linkedinQueue, seoCampaignBlockers,
} from "@shared/schema";
import { eq, and, gte, isNotNull, ne } from "drizzle-orm";
import { sendAgentSms } from "./agent-sms-service";
import { approveAndSendTouch } from "./outreach-agent-service";
import { executeApprovedPlan } from "./outreach-intelligence-service";

const router = Router();

const APP_BASE_URL = () => process.env.APP_BASE_URL ?? "https://www.newdawnfranchising.com";

// ── SEO Draft: preview ────────────────────────────────────────────────────────
router.get("/seo/:token", async (req, res) => {
  const [draft] = await db.select().from(seoContentDrafts)
    .where(eq(seoContentDrafts.approvalToken, req.params.token));
  if (!draft) return res.status(404).json({ error: "Draft not found or link expired" });

  const [campaign] = await db.select({ targetKeyword: seoCampaigns.targetKeyword, targetUrl: seoCampaigns.targetUrl })
    .from(seoCampaigns).where(eq(seoCampaigns.id, draft.campaignId));

  res.json({
    id: draft.id,
    type: "seo",
    status: draft.status,
    title: draft.title,
    body: draft.bodyMarkdown,
    metaDescription: draft.metaDescription,
    targetKeyword: draft.targetKeyword,
    contentType: draft.contentType,
    wordCount: draft.wordCount,
    campaign: campaign ?? null,
    createdAt: draft.createdAt,
    metadata: draft.metadata,
  });
});

// ── SEO Draft: approve/reject ─────────────────────────────────────────────────
router.post("/seo/:token", async (req, res) => {
  const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

  const [draft] = await db.select().from(seoContentDrafts)
    .where(eq(seoContentDrafts.approvalToken, req.params.token));
  if (!draft) return res.status(404).json({ error: "Draft not found or link expired" });
  if (draft.status !== "awaiting_approval") {
    return res.json({ ok: true, alreadyProcessed: true, status: draft.status });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  await db.update(seoContentDrafts).set({
    status: newStatus,
    reviewNotes: notes ?? null,
    updatedAt: new Date(),
  }).where(eq(seoContentDrafts.approvalToken, req.params.token));

  // Close any open content_review blockers for this campaign so the agent stops re-notifying
  try {
    await db.update(seoCampaignBlockers).set({ status: "resolved", resolvedAt: new Date() })
      .where(and(
        eq(seoCampaignBlockers.campaignId, draft.campaignId),
        eq(seoCampaignBlockers.service, "content_review"),
        eq(seoCampaignBlockers.status, "open"),
      ));
  } catch { /* silent */ }

  // Notify via SMS
  try {
    const emoji = action === "approve" ? "✅" : "❌";
    await sendAgentSms("seo",
      `${emoji} SEO draft "${draft.title}" has been ${newStatus}.${notes ? `\nNotes: ${notes}` : ""}`);
  } catch { /* silent */ }

  res.json({ ok: true, status: newStatus });
});

// ── Outreach Touch: preview ────────────────────────────────────────────────────
router.get("/outreach/:token", async (req, res) => {
  const [touch] = await db.select().from(outreachTouches)
    .where(eq(outreachTouches.approvalToken, req.params.token));
  if (!touch) return res.status(404).json({ error: "Draft not found or link expired" });

  const [lead] = await db.select({
    fullName: outreachLeads.fullName,
    email: outreachLeads.email,
    company: outreachLeads.company,
    title: outreachLeads.title,
  }).from(outreachLeads).where(eq(outreachLeads.id, touch.contactId));

  res.json({
    id: touch.id,
    type: "outreach",
    status: touch.status,
    channel: touch.channel,
    stepNumber: touch.stepNumber,
    subject: touch.subject,
    body: touch.body,
    personalizationHook: touch.personalizationHook,
    confidenceScore: touch.confidenceScore,
    lead: lead ?? null,
    createdAt: touch.createdAt,
  });
});

// ── Outreach Touch: approve/reject ─────────────────────────────────────────────
router.post("/outreach/:token", async (req, res) => {
  const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

  const [touch] = await db.select().from(outreachTouches)
    .where(eq(outreachTouches.approvalToken, req.params.token));
  if (!touch) return res.status(404).json({ error: "Draft not found or link expired" });
  if (touch.status !== "awaiting_approval") {
    return res.json({ ok: true, alreadyProcessed: true, status: touch.status });
  }

  if (action === "reject") {
    await db.update(outreachTouches).set({ status: "rejected", updatedAt: new Date() })
      .where(eq(outreachTouches.approvalToken, req.params.token));
    try {
      await sendAgentSms("outreach", `❌ Outreach message to ${touch.subject ? `"${touch.subject}"` : "lead"} rejected.${notes ? `\nNotes: ${notes}` : ""}`);
    } catch { /* silent */ }
    return res.json({ ok: true, status: "rejected" });
  }

  // Mark as approved first (prevents race-condition double-sends)
  await db.update(outreachTouches).set({ status: "approved", updatedAt: new Date() })
    .where(eq(outreachTouches.approvalToken, req.params.token));

  try {
    const result = await approveAndSendTouch(touch.id);
    try {
      await sendAgentSms("outreach", `✅ Outreach message approved and sent via ${result.channel}.${touch.subject ? `\nSubject: "${touch.subject}"` : ""}`);
    } catch { /* silent */ }
    res.json({ ok: true, status: "sent", channel: result.channel });
  } catch (sendErr) {
    res.status(500).json({ error: "Approved but send failed: " + (sendErr as Error).message });
  }
});

// ── Outreach Daily Plan: preview ──────────────────────────────────────────────
router.get("/plan/:token", async (req, res) => {
  const [plan] = await db.select().from(outreachDailyPlans)
    .where(eq(outreachDailyPlans.approvalToken, req.params.token));
  if (!plan) return res.status(404).json({ error: "Plan not found or link expired" });
  res.json({ ...plan, type: "outreach_plan" });
});

// ── Outreach Daily Plan: approve/reject ────────────────────────────────────────
router.post("/plan/:token", async (req, res) => {
  const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

  const [plan] = await db.select().from(outreachDailyPlans)
    .where(eq(outreachDailyPlans.approvalToken, req.params.token));
  if (!plan) return res.status(404).json({ error: "Plan not found or link expired" });
  if (plan.status !== "awaiting_approval") {
    return res.json({ ok: true, alreadyProcessed: true, status: plan.status });
  }

  if (action === "reject") {
    await db.update(outreachDailyPlans).set({ status: "rejected", reviewNotes: notes ?? null, updatedAt: new Date() })
      .where(eq(outreachDailyPlans.approvalToken, req.params.token));
    try { await sendAgentSms("outreach", `❌ Today's lead plan was rejected.${notes ? `\nNotes: ${notes}` : ""}`); } catch { }
    return res.json({ ok: true, status: "rejected" });
  }

  // Approve → mark then execute in background
  await db.update(outreachDailyPlans).set({ status: "approved", reviewNotes: notes ?? null, updatedAt: new Date() })
    .where(eq(outreachDailyPlans.approvalToken, req.params.token));

  res.json({ ok: true, status: "approved", message: "Plan approved — lead discovery is running in the background." });

  // Execute async (don't block the response)
  executeApprovedPlan(plan.id).catch(async (e) => {
    console.error("[OutreachIntel] Execution failed:", e.message);
    await db.update(outreachDailyPlans).set({ status: "failed", updatedAt: new Date() })
      .where(eq(outreachDailyPlans.id, plan.id));
    await sendAgentSms("outreach", `❌ Lead plan execution failed.\n\nError: ${e.message.slice(0, 200)}`).catch(() => {});
  });
});

// ── Forum Reply Draft: preview ────────────────────────────────────────────────
router.get("/forum/:token", async (req, res) => {
  const [draft] = await db.select().from(agentForumPosts)
    .where(eq(agentForumPosts.approvalToken, req.params.token));
  if (!draft) return res.status(404).json({ error: "Draft not found or link expired" });
  res.json({
    id: draft.id,
    type: "forum",
    status: draft.status,
    platform: draft.platform,
    postUrl: draft.postUrl,
    postTitle: draft.postTitle,
    postBody: draft.postBody,
    draftReply: draft.draftReply,
    createdAt: draft.createdAt,
  });
});

// ── Forum Reply Draft: approve/reject ─────────────────────────────────────────
router.post("/forum/:token", async (req, res) => {
  const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

  const [draft] = await db.select().from(agentForumPosts)
    .where(eq(agentForumPosts.approvalToken, req.params.token));
  if (!draft) return res.status(404).json({ error: "Draft not found or link expired" });
  if (draft.status !== "awaiting_approval") {
    return res.json({ ok: true, alreadyProcessed: true, status: draft.status });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  await db.update(agentForumPosts).set({
    status: newStatus,
    reviewNotes: notes ?? null,
    approvedAt: action === "approve" ? new Date() : null,
    rejectedAt: action === "reject" ? new Date() : null,
  }).where(eq(agentForumPosts.approvalToken, req.params.token));

  // Update postsCount on the forum account
  if (action === "approve") {
    try {
      const [acct] = await db.select({ id: forumAccounts.id, postsCount: forumAccounts.postsCount })
        .from(forumAccounts).where(eq(forumAccounts.forumName, draft.platform));
      if (acct) {
        await db.update(forumAccounts).set({
          postsCount: (acct.postsCount ?? 0) + 1,
          lastPostedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(forumAccounts.id, acct.id));
      }
    } catch { /* non-fatal */ }
  }

  try {
    const emoji = action === "approve" ? "✅" : "❌";
    const shortTitle = draft.postTitle.slice(0, 60);
    await sendAgentSms("outreach",
      `${emoji} Forum reply on ${draft.platform} "${shortTitle}" has been ${newStatus}.${notes ? `\nNotes: ${notes}` : ""}`
    );
  } catch { /* silent */ }

  res.json({ ok: true, status: newStatus });
});

// ── LinkedIn Queue: preview ────────────────────────────────────────────────────
router.get("/linkedin/:token", async (req, res) => {
  const [item] = await db.select().from(linkedinQueue)
    .where(eq(linkedinQueue.approvalToken, req.params.token));
  if (!item) return res.status(404).json({ error: "LinkedIn action not found or link expired" });
  res.json({
    id: item.id,
    type: item.type,
    status: item.status,
    leadName: item.leadName,
    leadLinkedinUrl: item.leadLinkedinUrl,
    leadCompany: item.leadCompany,
    leadTitle: item.leadTitle,
    message: item.message,
    createdAt: item.createdAt,
  });
});

// ── LinkedIn Queue: mark as sent / skip ───────────────────────────────────────
router.post("/linkedin/:token", async (req, res) => {
  const { action, notes } = req.body as { action: "sent" | "skip"; notes?: string };
  if (!["sent", "skip"].includes(action)) return res.status(400).json({ error: "action must be sent or skip" });

  const [item] = await db.select().from(linkedinQueue)
    .where(eq(linkedinQueue.approvalToken, req.params.token));
  if (!item) return res.status(404).json({ error: "LinkedIn action not found or link expired" });
  if (item.status !== "pending") {
    return res.json({ ok: true, alreadyProcessed: true, status: item.status });
  }

  const newStatus = action === "sent" ? "sent" : "skipped";
  await db.update(linkedinQueue).set({
    status: newStatus,
    sentAt: action === "sent" ? new Date() : null,
    notes: notes ?? null,
  }).where(eq(linkedinQueue.approvalToken, req.params.token));

  // If connection request marked as sent → update lead's linkedinConnected flag
  if (action === "sent" && item.type === "connection_request") {
    await db.update(outreachLeads)
      .set({ linkedinConnected: true })
      .where(eq(outreachLeads.id, item.leadId));
  }

  // Notify via SMS
  const emoji = action === "sent" ? "✅" : "⏭️";
  const label = item.type === "connection_request" ? "connection request" : "DM";
  await sendAgentSms("outreach",
    `${emoji} LinkedIn ${label} for ${item.leadName} marked as ${newStatus}.${notes ? `\nNotes: ${notes}` : ""}`
  ).catch(() => {});

  res.json({ ok: true, status: newStatus });
});

// ── LinkedIn Queue: list all (admin) ──────────────────────────────────────────
router.get("/linkedin-queue", async (_req, res) => {
  const items = await db.select().from(linkedinQueue)
    .orderBy(linkedinQueue.createdAt);
  const base = APP_BASE_URL();
  res.json(items.map(i => ({
    ...i,
    approvalUrl: i.approvalToken ? `${base}/approve/linkedin/${i.approvalToken}` : null,
  })));
});

// ── All pending approvals ──────────────────────────────────────────────────────
router.get("/pending", async (_req, res) => {
  const [seoDrafts, outreachDrafts, dailyPlans, forumDrafts, linkedinItems] = await Promise.all([
    db.select({
      id: seoContentDrafts.id,
      title: seoContentDrafts.title,
      targetKeyword: seoContentDrafts.targetKeyword,
      contentType: seoContentDrafts.contentType,
      approvalToken: seoContentDrafts.approvalToken,
      createdAt: seoContentDrafts.createdAt,
    }).from(seoContentDrafts).where(eq(seoContentDrafts.status, "awaiting_approval")),
    db.select({
      id: outreachTouches.id,
      channel: outreachTouches.channel,
      subject: outreachTouches.subject,
      approvalToken: outreachTouches.approvalToken,
      createdAt: outreachTouches.createdAt,
    }).from(outreachTouches).where(eq(outreachTouches.status, "awaiting_approval")),
    db.select({
      id: outreachDailyPlans.id,
      planDate: outreachDailyPlans.planDate,
      planSummary: outreachDailyPlans.planSummary,
      estimatedLeads: outreachDailyPlans.estimatedLeads,
      approvalToken: outreachDailyPlans.approvalToken,
      createdAt: outreachDailyPlans.createdAt,
    }).from(outreachDailyPlans).where(eq(outreachDailyPlans.status, "awaiting_approval")),
    db.select({
      id: agentForumPosts.id,
      platform: agentForumPosts.platform,
      postTitle: agentForumPosts.postTitle,
      postUrl: agentForumPosts.postUrl,
      approvalToken: agentForumPosts.approvalToken,
      createdAt: agentForumPosts.createdAt,
    }).from(agentForumPosts).where(
      and(
        eq(agentForumPosts.status, "awaiting_approval"),
        isNotNull(agentForumPosts.draftReply),
        ne(agentForumPosts.draftReply, "")
      )
    ),
    db.select({
      id: linkedinQueue.id,
      type: linkedinQueue.type,
      leadName: linkedinQueue.leadName,
      leadLinkedinUrl: linkedinQueue.leadLinkedinUrl,
      approvalToken: linkedinQueue.approvalToken,
      createdAt: linkedinQueue.createdAt,
    }).from(linkedinQueue).where(eq(linkedinQueue.status, "pending")),
  ]);

  const base = APP_BASE_URL();
  res.json({
    seo: seoDrafts.map(d => ({
      ...d,
      approvalUrl: d.approvalToken ? `${base}/approve/seo/${d.approvalToken}` : null,
    })),
    outreach: outreachDrafts.map(t => ({
      ...t,
      approvalUrl: t.approvalToken ? `${base}/approve/outreach/${t.approvalToken}` : null,
    })),
    plans: dailyPlans.map(p => ({
      ...p,
      approvalUrl: p.approvalToken ? `${base}/approve/outreach-plan/${p.approvalToken}` : null,
    })),
    forums: forumDrafts.map(f => ({
      ...f,
      approvalUrl: f.approvalToken ? `${base}/approve/forum/${f.approvalToken}` : null,
    })),
    linkedin: linkedinItems.map(i => ({
      ...i,
      approvalUrl: i.approvalToken ? `${base}/approve/linkedin/${i.approvalToken}` : null,
    })),
  });
});

// ── Morning Digest: send SMS summary of all pending items ────────────────────
router.post("/morning-digest", async (_req, res) => {
  try {
    await sendMorningDigest();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export async function sendMorningDigest(): Promise<void> {
  // Idempotency: only send once per calendar day regardless of server restarts
  const startOfDayET = new Date(
    new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }) + " 00:00:00"
  );
  const alreadySent = await db.select({ id: agentSmsMessages.id })
    .from(agentSmsMessages)
    .where(and(
      eq(agentSmsMessages.triggerType, "morning_digest"),
      gte(agentSmsMessages.createdAt, startOfDayET)
    ))
    .limit(1);
  if (alreadySent.length > 0) {
    console.log("[Morning Digest] Already sent today — skipping duplicate");
    return;
  }

  const [seoDrafts, outreachDrafts, dailyPlans, forumDrafts, linkedinItems] = await Promise.all([
    db.select({
      id: seoContentDrafts.id,
      title: seoContentDrafts.title,
      approvalToken: seoContentDrafts.approvalToken,
    }).from(seoContentDrafts).where(eq(seoContentDrafts.status, "awaiting_approval")),
    db.select({
      id: outreachTouches.id,
      channel: outreachTouches.channel,
      subject: outreachTouches.subject,
      approvalToken: outreachTouches.approvalToken,
    }).from(outreachTouches).where(eq(outreachTouches.status, "awaiting_approval")),
    db.select({
      id: outreachDailyPlans.id,
      planDate: outreachDailyPlans.planDate,
      planSummary: outreachDailyPlans.planSummary,
      estimatedLeads: outreachDailyPlans.estimatedLeads,
      approvalToken: outreachDailyPlans.approvalToken,
    }).from(outreachDailyPlans).where(eq(outreachDailyPlans.status, "awaiting_approval")),
    db.select({
      id: agentForumPosts.id,
      platform: agentForumPosts.platform,
      postTitle: agentForumPosts.postTitle,
      approvalToken: agentForumPosts.approvalToken,
    }).from(agentForumPosts).where(
      and(
        eq(agentForumPosts.status, "awaiting_approval"),
        isNotNull(agentForumPosts.draftReply),
        ne(agentForumPosts.draftReply, "")
      )
    ),
    db.select({
      id: linkedinQueue.id,
      type: linkedinQueue.type,
      leadName: linkedinQueue.leadName,
      approvalToken: linkedinQueue.approvalToken,
    }).from(linkedinQueue).where(eq(linkedinQueue.status, "pending")),
  ]);

  const base = APP_BASE_URL();
  const sends: Promise<any>[] = [];

  // ── SEO message — always send, even if no drafts pending ─────────────────
  {
    const lines: string[] = [];
    if (seoDrafts.length > 0) {
      lines.push(`📝 SEO Agent: ${seoDrafts.length} draft${seoDrafts.length !== 1 ? "s" : ""} still awaiting your approval:\n`);
      for (const d of seoDrafts.slice(0, 5)) {
        const url = d.approvalToken ? `${base}/approve/seo/${d.approvalToken}` : `${base}/seo`;
        const title = (d.title ?? "Untitled").slice(0, 60);
        lines.push(`📝 "${title}"\n   ${url}`);
      }
      if (seoDrafts.length > 5) lines.push(`\n+ ${seoDrafts.length - 5} more at ${base}/seo`);
    } else {
      lines.push(`✅ SEO Agent: No drafts pending this morning.\nFull status was sent at 7AM. Reply with any SEO questions or tasks.`);
    }
    sends.push(sendAgentSms("seo", lines.join("\n"), { triggerType: "morning_digest" }).catch(() => {}));
  }

  if (outreachDrafts.length === 0 && dailyPlans.length === 0 && forumDrafts.length === 0 && linkedinItems.length === 0) {
    await Promise.all(sends);
    return;
  }

  // ── Outreach message — includes touches, daily plan, forum reply drafts, AND LinkedIn queue ─
  if (outreachDrafts.length > 0 || dailyPlans.length > 0 || forumDrafts.length > 0 || linkedinItems.length > 0) {
    const lines: string[] = [];

    // Daily plans come first (highest priority)
    if (dailyPlans.length > 0) {
      const plan = dailyPlans[0];
      const url = plan.approvalToken ? `${base}/approve/outreach-plan/${plan.approvalToken}` : `${base}/agent`;
      lines.push(`Good morning! Today's lead plan is ready 🎯`);
      lines.push(`~${plan.estimatedLeads} leads estimated — tap to approve & execute:\n${url}`);
      if (dailyPlans.length > 1) lines.push(`(+ ${dailyPlans.length - 1} more plans pending)`);
    } else {
      const totalPending = outreachDrafts.length + forumDrafts.length;
      lines.push(`Good morning! ${totalPending} message${totalPending !== 1 ? "s" : ""} need your approval:\n`);
    }

    if (outreachDrafts.length > 0) {
      if (dailyPlans.length > 0) lines.push(`\n📨 ${outreachDrafts.length} outreach message${outreachDrafts.length !== 1 ? "s" : ""}:`);
      for (const t of outreachDrafts.slice(0, 3)) {
        const label = (t.subject ?? `${t.channel} message`).slice(0, 60);
        const url = t.approvalToken ? `${base}/approve/outreach/${t.approvalToken}` : `${base}/agent`;
        lines.push(`📨 "${label}"\n   ${url}`);
      }
      if (outreachDrafts.length > 3) lines.push(`+ ${outreachDrafts.length - 3} more outreach at ${base}/agent?s=approval-inbox`);
    }

    if (forumDrafts.length > 0) {
      lines.push(`\n💬 ${forumDrafts.length} forum reply draft${forumDrafts.length !== 1 ? "s" : ""}:`);
      for (const f of forumDrafts.slice(0, 3)) {
        const title = f.postTitle.slice(0, 60);
        const url = f.approvalToken ? `${base}/approve/forum/${f.approvalToken}` : `${base}/agent?s=approval-inbox`;
        lines.push(`💬 ${f.platform}: "${title}"\n   ${url}`);
      }
      if (forumDrafts.length > 3) lines.push(`+ ${forumDrafts.length - 3} more forum drafts at ${base}/agent?s=approval-inbox`);
    }

    if (linkedinItems.length > 0) {
      lines.push(`\n🔗 ${linkedinItems.length} LinkedIn action${linkedinItems.length !== 1 ? "s" : ""} need your confirmation:`);
      for (const li of linkedinItems.slice(0, 3)) {
        const label = li.type === "connection_request" ? "Connect" : "DM";
        const url = li.approvalToken ? `${base}/approve/linkedin/${li.approvalToken}` : `${base}/agent`;
        lines.push(`🔗 ${label}: ${li.leadName}\n   ${url}`);
      }
      if (linkedinItems.length > 3) lines.push(`+ ${linkedinItems.length - 3} more LinkedIn actions`);
    }

    sends.push(sendAgentSms("outreach", lines.join("\n"), { triggerType: "morning_digest" }).catch(() => {}));
  }

  await Promise.all(sends);
}

export default router;

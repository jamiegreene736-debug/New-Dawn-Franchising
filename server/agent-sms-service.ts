/**
 * Agent SMS Service
 * Two-way SMS notifications for the SEO and Outreach agents via QUO (OpenPhone).
 *
 * Number assignments:
 *   SEO agent      → 808-460-6509  (Quo id: PNRyMRwwud)
 *   Outreach agent → 808-460-6509  (Quo id: PNRyMRwwud)  ← same number per Dylan's request
 *   Dylan's phone  → 863-360-7768  (the only recipient)
 */

import { db } from "./db";
import { agentSmsMessages } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const QUO_API_KEY = process.env.QUO_API_KEY || "";
const QUO_API_BASE = "https://api.openphone.com/v1";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const DYLAN_PHONE = "+18633607768";

export const AGENT_NUMBERS: Record<string, string> = {
  seo: "+18084606509",      // 808-460-6509 (Quo: PNRyMRwwud)
  outreach: "+18084606509", // 808-460-6509 (Quo: PNRyMRwwud) — same number per Dylan's request
};

// Cache: raw number → QUO phoneNumberId
const phoneIdCache: Record<string, string> = {};

// ─── Phone ID Resolution ──────────────────────────────────────────────────────

async function resolvePhoneNumberId(rawNumber: string): Promise<string | null> {
  if (phoneIdCache[rawNumber]) return phoneIdCache[rawNumber];
  if (!QUO_API_KEY) return null;

  try {
    const res = await fetch(`${QUO_API_BASE}/phone-numbers`, {
      headers: { Authorization: QUO_API_KEY },
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: Array<{ id: string; formattedNumber: string; rawNumber?: string }> };
    for (const pn of json.data ?? []) {
      const digits = pn.formattedNumber.replace(/\D/g, "");
      if (digits.length === 10) {
        // US 10-digit number — index with and without country code
        phoneIdCache[`+1${digits}`] = pn.id;
        phoneIdCache[`+${digits}`] = pn.id;
        phoneIdCache[digits] = pn.id;
      } else if (digits.length === 11 && digits.startsWith("1")) {
        // E.164 already has country code
        phoneIdCache[`+${digits}`] = pn.id;
        phoneIdCache[`+1${digits.slice(1)}`] = pn.id;
        phoneIdCache[digits.slice(1)] = pn.id;
      } else {
        phoneIdCache[`+${digits}`] = pn.id;
      }
    }
    console.log(`[AgentSMS] Resolved phone IDs: ${Object.keys(phoneIdCache).join(", ")}`);
    return phoneIdCache[rawNumber] ?? null;
  } catch {
    return null;
  }
}

// ─── Send Agent SMS ───────────────────────────────────────────────────────────

export async function sendAgentSms(
  agentType: "seo" | "outreach",
  body: string,
  opts?: {
    triggerType?: string;
    contextJson?: Record<string, unknown>;
  },
): Promise<{ success: boolean; id?: string; error?: string }> {
  const fromNumber = AGENT_NUMBERS[agentType];
  if (!fromNumber) return { success: false, error: `Unknown agent type: ${agentType}` };

  // Resolve the phoneNumberId; fall back to env var then raw number — never block the send
  const resolvedId = await resolvePhoneNumberId(fromNumber);
  const fromId: string = resolvedId
    ?? (process.env.QUO_PHONE_NUMBER_ID || fromNumber);
  if (!resolvedId) {
    console.warn(`[AgentSMS] phoneNumberId not cached for ${fromNumber} — using ${process.env.QUO_PHONE_NUMBER_ID ? "env fallback" : "raw number"}`);
  }

  // Truncate body to 1600 chars (SMS limit)
  const truncated = body.length > 1590 ? body.slice(0, 1590) + "…" : body;

  // Log to DB first regardless of send success
  const [record] = await db.insert(agentSmsMessages).values({
    agentType,
    direction: "outbound",
    fromNumber,
    toNumber: DYLAN_PHONE,
    body: truncated,
    triggerType: opts?.triggerType ?? "manual",
    contextJson: opts?.contextJson ?? null,
    status: "pending",
  }).returning();

  if (!QUO_API_KEY) {
    await db.update(agentSmsMessages)
      .set({ status: "failed", quoMessageId: "no-api-key" })
      .where(eq(agentSmsMessages.id, record.id));
    return { success: false, error: "QUO_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${QUO_API_BASE}/messages`, {
      method: "POST",
      headers: {
        Authorization: QUO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: truncated,
        from: fromId,
        to: [DYLAN_PHONE],
      }),
    });

    const json = await res.json() as { data?: { id?: string }; message?: string; error?: string };

    if (!res.ok) {
      const errMsg = json.message || json.error || `QUO API error ${res.status}`;
      await db.update(agentSmsMessages)
        .set({ status: "failed" })
        .where(eq(agentSmsMessages.id, record.id));
      return { success: false, error: errMsg };
    }

    await db.update(agentSmsMessages)
      .set({ status: "sent", quoMessageId: json.data?.id })
      .where(eq(agentSmsMessages.id, record.id));

    console.log(`[AgentSMS] ${agentType.toUpperCase()} → ${DYLAN_PHONE}: sent (${json.data?.id})`);
    return { success: true, id: json.data?.id };
  } catch (err) {
    await db.update(agentSmsMessages)
      .set({ status: "failed" })
      .where(eq(agentSmsMessages.id, record.id));
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ─── Inbound Reply Handler ────────────────────────────────────────────────────

export async function handleInboundAgentSms(
  toNumber: string,       // QUO number that received the message (the agent's number)
  fromNumber: string,     // Dylan's number
  body: string,
  quoMessageId?: string,
): Promise<{ agentType: string | null; handled: boolean }> {
  // Normalize numbers
  const normalize = (n: string) => "+" + n.replace(/\D/g, "");
  const toNorm = normalize(toNumber);

  // Identify which agent this reply is for
  let agentType: "seo" | "outreach" | null = null;
  for (const [type, num] of Object.entries(AGENT_NUMBERS)) {
    if (normalize(num) === toNorm) {
      agentType = type as "seo" | "outreach";
      break;
    }
  }

  // Log the inbound message
  await db.insert(agentSmsMessages).values({
    agentType: agentType ?? "unknown",
    direction: "inbound",
    fromNumber: normalize(fromNumber),
    toNumber: toNorm,
    body,
    quoMessageId: quoMessageId ?? null,
    triggerType: "reply",
    status: "received",
  });

  if (!agentType) {
    console.warn(`[AgentSMS] Inbound to unrecognized number ${toNorm} — ignored`);
    return { agentType: null, handled: false };
  }

  console.log(`[AgentSMS] Inbound to ${agentType} agent from ${fromNumber}: "${body.slice(0, 80)}"`);
  return { agentType, handled: true };
}

// ─── Formatted notification helpers ──────────────────────────────────────────

export async function notifyDraftPending(
  agentType: "seo" | "outreach",
  draftTitle: string,
  previewUrl: string,
  previewText?: string,
) {
  const agentLabel = agentType === "seo" ? "SEO Agent" : "Outreach Agent";
  const preview = previewText ? `\n\nPreview: "${previewText.slice(0, 120)}..."` : "";
  const body = `${agentLabel}: Draft ready for your approval.\n\n📄 "${draftTitle}"${preview}\n\nView & approve: ${previewUrl}\n\nReply APPROVE, REJECT, or with edits.`;
  return sendAgentSms(agentType, body, { triggerType: "draft_pending" });
}

export async function notifyBlocker(
  agentType: "seo" | "outreach",
  blockerTitle: string,
  detail: string,
) {
  const agentLabel = agentType === "seo" ? "SEO Agent" : "Outreach Agent";
  const body = `${agentLabel}: Blocked and needs your help.\n\n⚠️ ${blockerTitle}\n\n${detail.slice(0, 300)}\n\nReply with instructions to unblock.`;
  return sendAgentSms(agentType, body, { triggerType: "blocker" });
}

export async function notifyError(
  agentType: "seo" | "outreach",
  errorSummary: string,
) {
  const agentLabel = agentType === "seo" ? "SEO Agent" : "Outreach Agent";
  const body = `${agentLabel}: Encountered an error.\n\n❌ ${errorSummary.slice(0, 400)}\n\nReply with instructions or reply RETRY.`;
  return sendAgentSms(agentType, body, { triggerType: "error" });
}

// ─── Message history query ────────────────────────────────────────────────────

export async function getAgentSmsHistory(
  agentType: "seo" | "outreach",
  limit = 100,
) {
  return db.select().from(agentSmsMessages)
    .where(eq(agentSmsMessages.agentType, agentType))
    .orderBy(desc(agentSmsMessages.createdAt))
    .limit(limit);
}

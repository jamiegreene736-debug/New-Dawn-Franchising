import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  callQueue,
  callQueueAttempts,
  contactActivities,
  contacts,
  crmClientActivities,
  crmClients,
  dripSends,
  meetings,
  phoneCalls,
  type CallQueueItem,
  type DripSend,
} from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";
import { isOnDnc, addToDnc } from "./agent-service";
import { sendSmsViaQuo, toSmsE164, phoneLast10 } from "./quo-service";
import { handleMeetingBooked } from "./meetings";
import { emailQueue } from "./core/email-queue";
import { notifications } from "./core/notifications";
import { CALENDLY } from "@shared/campaign-tracks";
import {
  ACTIVE_STATUSES,
  MAX_ATTEMPTS,
  calendlySmsBody,
  inferTimezone,
  inferTrack,
  isActiveStatus,
  isBlockingCrmStatus,
  isQueueableOpenSignal,
  isTerminalStatus,
  isUsablePhone,
  nextAttemptAt,
  phoneDigits,
  priorityForTrigger,
  shouldUpgradePriority,
  triggerLabel,
  type CallTriggerType,
} from "./call-queue-helpers";

const DYLAN_EMAIL = "dylan@newdawnfranchising.com";
const FROM_EMAIL = "franchising@newdawnfranchising.com";

export type EnqueueInput = {
  triggerType: CallTriggerType;
  triggerAt?: Date;
  dripSendId?: string;
  emailSubject?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  timezone?: string | null;
  track?: "broker" | "client";
  prospectId?: string | null;
  crmClientId?: string | null;
  contactId?: string | null;
  location?: string | null;
  state?: string | null;
  country?: string | null;
};

export type EnqueueResult =
  | { ok: true; item: CallQueueItem; action: "created" | "updated" }
  | { ok: false; reason: string };

let schemaReady: Promise<void> | null = null;

export async function ensureCallQueueSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS call_queue (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          prospect_id varchar,
          crm_client_id varchar,
          contact_id varchar,
          name text NOT NULL,
          email text,
          phone text,
          company text,
          timezone text,
          track text NOT NULL DEFAULT 'client',
          trigger_type text NOT NULL,
          trigger_at timestamp NOT NULL,
          trigger_label text,
          drip_send_id varchar,
          email_subject text,
          priority integer NOT NULL DEFAULT 2,
          assigned_to text NOT NULL DEFAULT 'thailand',
          status text NOT NULL DEFAULT 'queued',
          attempt_count integer NOT NULL DEFAULT 0,
          last_attempt_at timestamp,
          next_attempt_at timestamp,
          phone_call_id text,
          outcome_notes text,
          interest_level text,
          meeting_id varchar,
          calendly_url_sent_at timestamp,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS call_queue_status_idx ON call_queue (status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS call_queue_email_idx ON call_queue (email)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS call_queue_phone_idx ON call_queue (phone)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS call_queue_attempts (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          queue_id varchar NOT NULL REFERENCES call_queue(id) ON DELETE CASCADE,
          attempted_at timestamp NOT NULL DEFAULT now(),
          outcome text NOT NULL,
          notes text,
          phone_call_id text,
          duration_seconds integer
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function existingOpenRow(email?: string | null, phone?: string | null): Promise<CallQueueItem | undefined> {
  const clauses = [];
  if (email) clauses.push(sql`lower(${callQueue.email}) = ${email.trim().toLowerCase()}`);
  if (phone && phoneDigits(phone)) {
    clauses.push(sql`right(regexp_replace(coalesce(${callQueue.phone}, ''), '\\D', '', 'g'), 10) = ${phoneDigits(phone)}`);
  }
  if (clauses.length === 0) return undefined;
  const rows = await db
    .select()
    .from(callQueue)
    .where(or(...clauses))
    .orderBy(desc(callQueue.updatedAt))
    .limit(8);
  return rows.find((r) => isActiveStatus(r.status) || isTerminalStatus(r.status) || r.status === "exhausted");
}

async function hasConfirmedMeeting(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const rows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      and(
        sql`lower(${meetings.inviteeEmail}) = ${email.trim().toLowerCase()}`,
        eq(meetings.status, "confirmed"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function enqueueCall(input: EnqueueInput): Promise<EnqueueResult> {
  await ensureCallQueueSchema();

  const email = (input.email || "").trim() || null;
  const phone = (input.phone || "").trim() || null;
  const name = (input.name || "").trim() || email || "Unknown";
  const track = input.track || "client";
  const triggerAt = input.triggerAt || new Date();
  const priority = priorityForTrigger(input.triggerType);
  const label = triggerLabel(input.triggerType, input.emailSubject);
  const timezone = input.timezone || inferTimezone(input.location, input.state, input.country);

  if (email && (await isOnDnc(email, phone))) {
    return { ok: false, reason: "dnc" };
  }
  if (phone && (await isOnDnc(null, phone))) {
    return { ok: false, reason: "dnc" };
  }

  if (input.crmClientId) {
    const client = await storage.getCrmClient(input.crmClientId);
    if (client && isBlockingCrmStatus(client.status)) {
      return { ok: false, reason: `crm_status_${client.status}` };
    }
  } else if (email) {
    const client = await storage.getCrmClientByEmail(email);
    if (client && isBlockingCrmStatus(client.status)) {
      return { ok: false, reason: `crm_status_${client.status}` };
    }
  }

  if (await hasConfirmedMeeting(email)) {
    return { ok: false, reason: "already_booked" };
  }

  const existing = await existingOpenRow(email, phone);
  if (existing) {
    if (existing.status === "booked" || existing.status === "dnc" || existing.status === "not_interested") {
      return { ok: false, reason: `already_${existing.status}` };
    }
    if (existing.status === "wrong_number") {
      return { ok: false, reason: "already_wrong_number" };
    }
    if (isActiveStatus(existing.status) || existing.status === "exhausted") {
      const patch: Partial<CallQueueItem> = { updatedAt: new Date() };
      if (shouldUpgradePriority(existing.priority, priority)) {
        patch.priority = priority;
        patch.triggerType = input.triggerType;
        patch.triggerAt = triggerAt;
        patch.triggerLabel = label;
        patch.emailSubject = input.emailSubject || existing.emailSubject;
        patch.dripSendId = input.dripSendId || existing.dripSendId;
      }
      if (existing.status === "exhausted" && input.triggerType === "link_click") {
        patch.status = "queued";
        patch.nextAttemptAt = new Date();
      }
      if (phone && !existing.phone) patch.phone = phone;
      const [updated] = await db.update(callQueue).set(patch).where(eq(callQueue.id, existing.id)).returning();
      return { ok: true, item: updated, action: "updated" };
    }
  }

  const status = isUsablePhone(phone) ? "queued" : "needs_phone";
  const [created] = await db
    .insert(callQueue)
    .values({
      prospectId: input.prospectId || null,
      crmClientId: input.crmClientId || null,
      contactId: input.contactId || null,
      name,
      email,
      phone,
      company: input.company || null,
      timezone,
      track,
      triggerType: input.triggerType,
      triggerAt,
      triggerLabel: label,
      dripSendId: input.dripSendId || null,
      emailSubject: input.emailSubject || null,
      priority,
      assignedTo: "thailand",
      status,
      nextAttemptAt: new Date(),
    })
    .returning();

  return { ok: true, item: created, action: "created" };
}

export async function enqueueFromDripSend(
  send: DripSend | any,
  triggerType: CallTriggerType,
): Promise<EnqueueResult> {
  try {
    if (triggerType === "engaged_open" && !isQueueableOpenSignal(send.openCount ?? 0)) {
      return { ok: false, reason: "single_open_ignored" };
    }

    const enrollment = send.enrollmentId ? await storage.getDripEnrollment(send.enrollmentId) : null;
    const prospect = enrollment?.prospectId ? await storage.getProspect(enrollment.prospectId) : null;
    const campaign = enrollment?.campaignId ? await storage.getDripCampaign(enrollment.campaignId) : null;

    const email = send.recipientEmail || enrollment?.prospectEmail || prospect?.email || null;
    let phone = prospect?.phone || null;
    let crmClientId: string | null = null;
    let contactId: string | null = null;
    let company = prospect?.company || null;
    let location = prospect?.location || null;
    let state: string | null = null;
    let country: string | null = null;

    if (email) {
      const client = await storage.getCrmClientByEmail(email);
      if (client) {
        crmClientId = client.id;
        phone = phone || client.phone || client.phone2 || null;
        company = company || client.companyName || null;
        location = location || client.contactCity || client.country || null;
        state = client.contactState || null;
        country = client.country || null;
      }
      const [contact] = await db
        .select()
        .from(contacts)
        .where(sql`lower(${contacts.email}) = ${email.trim().toLowerCase()}`)
        .limit(1);
      if (contact) {
        contactId = contact.id;
        phone = phone || contact.phone || null;
        company = company || contact.firmName || null;
        country = country || contact.country || null;
      }
    }

    return enqueueCall({
      triggerType,
      triggerAt: triggerType === "link_click" ? send.clickedAt || new Date() : send.openedAt || new Date(),
      dripSendId: send.id,
      emailSubject: send.subject,
      name: send.recipientName || enrollment?.prospectName || prospect?.name || email || "Unknown",
      email,
      phone,
      company,
      track: inferTrack(campaign?.name, (campaign as any)?.audienceType),
      prospectId: enrollment?.prospectId || prospect?.id || null,
      crmClientId,
      contactId,
      location,
      state,
      country,
    });
  } catch (err: any) {
    console.error("[CallQueue] enqueueFromDripSend failed:", err?.message || err);
    return { ok: false, reason: err?.message || "enqueue_failed" };
  }
}

export async function listCallQueue(opts?: {
  view?: "today" | "history";
  status?: string;
  triggerType?: string;
  assignedTo?: string;
}): Promise<CallQueueItem[]> {
  await ensureCallQueueSchema();
  const view = opts?.view || "today";
  const clauses = [];
  if (opts?.assignedTo) clauses.push(eq(callQueue.assignedTo, opts.assignedTo));
  if (opts?.triggerType) clauses.push(eq(callQueue.triggerType, opts.triggerType));
  if (opts?.status) {
    clauses.push(eq(callQueue.status, opts.status));
  } else if (view === "today") {
    clauses.push(inArray(callQueue.status, [...ACTIVE_STATUSES]));
  }

  const rows = await db
    .select()
    .from(callQueue)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(callQueue.priority, desc(callQueue.triggerAt));

  if (view !== "today") return rows;

  const now = Date.now();
  return rows.filter((r) => {
    if (r.status === "needs_phone") return true;
    if (r.attemptCount >= MAX_ATTEMPTS && r.status !== "callback") return false;
    if (r.nextAttemptAt && new Date(r.nextAttemptAt).getTime() > now && r.status !== "queued" && r.status !== "calling" && r.status !== "callback") {
      return false;
    }
    return true;
  });
}

export async function getCallQueueItem(id: string): Promise<(CallQueueItem & { attempts: any[]; linkedCall: any | null }) | undefined> {
  await ensureCallQueueSchema();
  const [item] = await db.select().from(callQueue).where(eq(callQueue.id, id));
  if (!item) return undefined;
  const attempts = await db
    .select()
    .from(callQueueAttempts)
    .where(eq(callQueueAttempts.queueId, id))
    .orderBy(desc(callQueueAttempts.attemptedAt));
  let linkedCall = null;
  if (item.phoneCallId) {
    const [call] = await db.select().from(phoneCalls).where(eq(phoneCalls.id, item.phoneCallId));
    linkedCall = call || null;
  }
  return { ...item, attempts, linkedCall };
}

export async function getCallQueueStats(since?: Date) {
  await ensureCallQueueSchema();
  const start = since || new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const rows = await db.select().from(callQueue);
  const attempts = await db
    .select()
    .from(callQueueAttempts)
    .where(gte(callQueueAttempts.attemptedAt, start));

  const todayItems = rows.filter((r) => r.lastAttemptAt && new Date(r.lastAttemptAt) >= start);
  const dials = attempts.length;
  const connects = attempts.filter((a) => (a.durationSeconds || 0) >= 60 || ["booked", "callback", "not_interested"].includes(a.outcome)).length;
  const booked = rows.filter((r) => r.status === "booked" && r.updatedAt && new Date(r.updatedAt) >= start).length;
  const notInterested = rows.filter((r) => r.status === "not_interested" && r.updatedAt && new Date(r.updatedAt) >= start).length;
  const voicemail = attempts.filter((a) => a.outcome === "voicemail").length;
  const noAnswer = attempts.filter((a) => a.outcome === "no_answer").length;
  const waiting = rows.filter((r) => isActiveStatus(r.status)).length;

  return {
    waiting,
    dials,
    connects,
    booked,
    notInterested,
    voicemail,
    noAnswer,
    calledToday: todayItems.length,
    connectRate: dials ? Math.round((connects / dials) * 100) : 0,
    bookRate: connects ? Math.round((booked / connects) * 100) : 0,
  };
}

export async function markDialing(id: string): Promise<CallQueueItem | undefined> {
  await ensureCallQueueSchema();
  const [row] = await db
    .update(callQueue)
    .set({ status: "calling", lastAttemptAt: new Date(), updatedAt: new Date() })
    .where(eq(callQueue.id, id))
    .returning();
  return row;
}

export async function recordCallOutcome(
  id: string,
  body: {
    status: string;
    notes?: string;
    interestLevel?: string;
    scheduledAt?: string | Date | null;
    durationSeconds?: number | null;
    phoneCallId?: string | null;
  },
): Promise<CallQueueItem | undefined> {
  await ensureCallQueueSchema();
  const [item] = await db.select().from(callQueue).where(eq(callQueue.id, id));
  if (!item) return undefined;

  const status = body.status;
  const now = new Date();
  const attemptCount = (item.attemptCount || 0) + 1;
  let next = nextAttemptAt(attemptCount, now);
  let finalStatus = status;

  if (status === "no_answer" || status === "voicemail") {
    if (attemptCount >= MAX_ATTEMPTS) {
      finalStatus = "exhausted";
      next = null;
    }
  } else if (status === "callback") {
    next = body.scheduledAt ? new Date(body.scheduledAt) : nextAttemptAt(1, now);
  } else {
    next = null;
  }

  await db.insert(callQueueAttempts).values({
    queueId: id,
    attemptedAt: now,
    outcome: status,
    notes: body.notes || null,
    phoneCallId: body.phoneCallId || item.phoneCallId || null,
    durationSeconds: body.durationSeconds ?? null,
  });

  const patch: Partial<CallQueueItem> = {
    status: finalStatus,
    attemptCount,
    lastAttemptAt: now,
    nextAttemptAt: next,
    outcomeNotes: body.notes ?? item.outcomeNotes,
    interestLevel: body.interestLevel ?? item.interestLevel,
    phoneCallId: body.phoneCallId || item.phoneCallId,
    updatedAt: now,
  };

  if (status === "dnc") {
    await addToDnc(item.email || undefined, item.phone || undefined, undefined, "Thailand agent marked DNC");
  }

  if (status === "booked") {
    const meetingId = await bookDylanMeeting(item, body.notes, body.scheduledAt);
    patch.meetingId = meetingId;
    if (item.crmClientId) {
      await storage.updateCrmClient(item.crmClientId, {
        status: "meeting_scheduled",
        lastContactedAt: now,
        lastContactMethod: "phone",
      } as any).catch(() => {});
    }
  }

  const [updated] = await db.update(callQueue).set(patch).where(eq(callQueue.id, id)).returning();
  return updated;
}

async function bookDylanMeeting(
  item: CallQueueItem,
  notes?: string,
  scheduledAt?: string | Date | null,
): Promise<string> {
  const when = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const meetingNotes = [
    `Booked by Thailand calling agent.`,
    item.triggerLabel ? `Signal: ${item.triggerLabel}` : "",
    notes || "",
  ]
    .filter(Boolean)
    .join("\n");

  const meetingId = await handleMeetingBooked({
    calendlyEventId: `thailand-agent-${item.id}-${Date.now()}`,
    inviteeName: item.name,
    inviteeEmail: item.email || "",
    scheduledAt: when,
  });

  if (meetingNotes) {
    await db.update(meetings).set({ notes: meetingNotes }).where(eq(meetings.id, meetingId));
  }

  const whenStr = when.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });
  emailQueue.add({
    to: DYLAN_EMAIL,
    from: FROM_EMAIL,
    subject: `Thailand agent booked Dylan: ${item.name}`,
    html: `
      <p>The Thailand calling agent booked a meeting with <strong>${item.name}</strong>.</p>
      <p><strong>Email:</strong> ${item.email || "—"}<br/>
      <strong>Phone:</strong> ${item.phone || "—"}<br/>
      <strong>Track:</strong> ${item.track}<br/>
      <strong>Why we called:</strong> ${item.triggerLabel || item.triggerType}<br/>
      <strong>When:</strong> ${whenStr}</p>
      ${notes ? `<p><strong>Agent notes:</strong> ${notes}</p>` : ""}
      <p><a href="https://www.newdawnfranchising.com/agent?section=meetings">Open meetings →</a></p>
    `,
    priority: "CRITICAL",
  });
  await notifications.create({
    type: "meeting_booked",
    system: "call_queue",
    title: "Thailand agent booked Dylan",
    message: `${item.name} — ${item.triggerLabel || item.triggerType}`,
    actionUrl: "/crm?tab=call-queue",
  });

  return meetingId;
}

export async function sendCalendlyLink(id: string): Promise<{ success: boolean; error?: string }> {
  await ensureCallQueueSchema();
  const [item] = await db.select().from(callQueue).where(eq(callQueue.id, id));
  if (!item) return { success: false, error: "Not found" };
  if (!item.phone) return { success: false, error: "No phone number" };

  const e164 = toSmsE164(item.phone);
  if (!e164.ok) return { success: false, error: e164.error };

  const fromId = process.env.QUO_THAILAND_PHONE_NUMBER_ID || undefined;
  const body = calendlySmsBody(item.name, (item.track as "broker" | "client") || "client", CALENDLY);
  const result = await sendSmsViaQuo(e164.e164, body, fromId);
  if (result.success) {
    await db
      .update(callQueue)
      .set({ calendlyUrlSentAt: new Date(), updatedAt: new Date() })
      .where(eq(callQueue.id, id));
  }
  return result;
}

export async function attachQuoCall(opts: {
  callId: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status?: string;
  durationSeconds?: number | null;
}): Promise<CallQueueItem | undefined> {
  await ensureCallQueueSchema();
  const prospectNumber = opts.direction === "outbound" ? opts.toNumber : opts.fromNumber;
  const digits = phoneLast10(prospectNumber);
  if (!digits) return undefined;

  const rows = await db
    .select()
    .from(callQueue)
    .where(sql`right(regexp_replace(coalesce(${callQueue.phone}, ''), '\\D', '', 'g'), 10) = ${digits}`)
    .orderBy(desc(callQueue.updatedAt))
    .limit(6);

  const match =
    rows.find((r) => r.status === "calling") ||
    rows.find((r) => isActiveStatus(r.status) && r.lastAttemptAt && Date.now() - new Date(r.lastAttemptAt).getTime() < 2 * 60 * 60 * 1000) ||
    rows.find((r) => isActiveStatus(r.status));

  if (!match) return undefined;

  const [updated] = await db
    .update(callQueue)
    .set({ phoneCallId: opts.callId, updatedAt: new Date() })
    .where(eq(callQueue.id, match.id))
    .returning();
  return updated;
}

export async function markQueueBookedByEmail(email: string, meetingId: string): Promise<void> {
  if (!email) return;
  await ensureCallQueueSchema();
  await db
    .update(callQueue)
    .set({
      status: "booked",
      meetingId,
      updatedAt: new Date(),
      nextAttemptAt: null,
    })
    .where(
      and(
        sql`lower(${callQueue.email}) = ${email.trim().toLowerCase()}`,
        inArray(callQueue.status, [...ACTIVE_STATUSES, "calling", "exhausted"]),
      ),
    );
}

export async function scanEngagedOpens(limit = 200): Promise<{ scanned: number; enqueued: number }> {
  await ensureCallQueueSchema();
  const sends = await db
    .select()
    .from(dripSends)
    .where(and(sql`${dripSends.openCount} >= 3`, sql`${dripSends.openedAt} is not null`))
    .orderBy(desc(dripSends.openedAt))
    .limit(limit);

  let enqueued = 0;
  for (const send of sends) {
    const result = await enqueueFromDripSend(send, "engaged_open");
    if (result.ok && result.action === "created") enqueued++;
  }
  return { scanned: sends.length, enqueued };
}

export async function scanRepliesWithoutMeetings(limit = 150): Promise<{ scanned: number; enqueued: number }> {
  await ensureCallQueueSchema();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const replyTypes = ["email_received", "email_reply", "sms_received", "whatsapp_received"];

  const contactReplies = await db
    .select({
      email: contacts.email,
      name: sql<string>`trim(coalesce(${contacts.firstName}, '') || ' ' || coalesce(${contacts.lastName}, ''))`,
      phone: contacts.phone,
      company: contacts.firmName,
      country: contacts.country,
      contactId: contacts.id,
      createdAt: contactActivities.createdAt,
    })
    .from(contactActivities)
    .innerJoin(contacts, eq(contactActivities.contactId, contacts.id))
    .where(and(inArray(contactActivities.activityType, replyTypes), gte(contactActivities.createdAt, since)))
    .orderBy(desc(contactActivities.createdAt))
    .limit(limit);

  const clientReplies = await db
    .select({
      email: crmClients.email,
      name: crmClients.fullName,
      phone: crmClients.phone,
      company: crmClients.companyName,
      country: crmClients.country,
      crmClientId: crmClients.id,
      createdAt: crmClientActivities.createdAt,
      status: crmClients.status,
    })
    .from(crmClientActivities)
    .innerJoin(crmClients, eq(crmClientActivities.clientId, crmClients.id))
    .where(and(inArray(crmClientActivities.activityType, replyTypes), gte(crmClientActivities.createdAt, since)))
    .orderBy(desc(crmClientActivities.createdAt))
    .limit(limit);

  const seen = new Set<string>();
  let enqueued = 0;
  let scanned = 0;

  const rows: Array<{
    email: string | null;
    name: string | null;
    phone: string | null;
    company: string | null;
    country: string | null;
    contactId?: string;
    crmClientId?: string;
    createdAt: Date;
    status?: string;
  }> = [
    ...contactReplies.map((r) => ({ ...r, name: r.name || r.email })),
    ...clientReplies,
  ];

  for (const row of rows) {
    const key = (row.email || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    scanned++;
    if (row.status && isBlockingCrmStatus(row.status)) continue;

    const result = await enqueueCall({
      triggerType: "reply_no_meeting",
      triggerAt: row.createdAt,
      name: row.name || key,
      email: row.email,
      phone: row.phone,
      company: row.company,
      country: row.country,
      track: "broker",
      contactId: row.contactId,
      crmClientId: row.crmClientId,
    });
    if (result.ok && result.action === "created") enqueued++;
  }

  return { scanned, enqueued };
}

export async function backfillCallQueue(): Promise<{ clicks: number; opens: number; replies: number }> {
  await ensureCallQueueSchema();
  const clicked = await db
    .select()
    .from(dripSends)
    .where(sql`${dripSends.clickCount} >= 1 AND ${dripSends.clickedAt} is not null`)
    .orderBy(desc(dripSends.clickedAt))
    .limit(300);

  let clicks = 0;
  for (const send of clicked) {
    const result = await enqueueFromDripSend(send, "link_click");
    if (result.ok && result.action === "created") clicks++;
  }

  const opens = await scanEngagedOpens();
  const replies = await scanRepliesWithoutMeetings();
  return { clicks, opens: opens.enqueued, replies: replies.enqueued };
}

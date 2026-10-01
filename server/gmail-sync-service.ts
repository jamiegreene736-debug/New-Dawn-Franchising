import { authoredReply, classifyReply, REPLY_POLICY_VERSION } from "./outreach-signals";
import { suppressReplyOutreach } from "./call-queue-service";
// ─── Gmail Inbox Sync (Dylan plus historical sender inboxes) ───────────────────
// Two-way Gmail connection: outbound is handled by email-service.ts; this module
// pulls the sender INBOX over IMAP and lands client replies on the matching
// CRM record so conversations stay in one place.
//
// Modeled on the IMAP reply listener in agent-service.ts (pollForApprovalReply).
// Connects with the same Gmail App Password pattern, locks INBOX, fetches recent
// messages, matches the sender to a CRM client (or attorney contact), and stores
// the reply as an inbound crm_direct_emails row + an activity. Deduped by Message-ID.

import { simpleParser } from "mailparser";
import { findReplySend } from "./campaign-replies";
import { ImapFlow } from "imapflow";
import cron from "node-cron";
import { storage } from "./storage";
import { addToDnc, isOnDnc } from "./agent-service";
import { isAutomatedOrBulkEmail } from "./crm-email-filter";
import { sendEmail, ALL_SENDER_PROFILES, getSenderPassword, DEFAULT_SENDER } from "./email-service";
import { getDeliverabilitySettings } from "./deliverability-settings-service";

const PRIMARY_EMAIL = DEFAULT_SENDER;

function getAppPassword(): string | undefined {
  // Strip whitespace (Gmail app passwords are 16 contiguous chars; pasted env
  // values often carry a trailing newline/space that would break IMAP auth).
  const profile = ALL_SENDER_PROFILES.find(p => p.email === DEFAULT_SENDER)!;
  return getSenderPassword(profile);
}

export function getGmailSyncStatus() {
  const pass = (getAppPassword() || "").replace(/\s/g, "");
  return {
    email: PRIMARY_EMAIL,
    configured: !!pass,
    appPasswordValid: pass.length === 16,
  };
}

interface SyncResult {
  scanned: number;
  matched: number;
  stored: number;
  bounced: number;
  error: string | null;
  lastRunAt: Date | null;
}

let lastResult: SyncResult = { scanned: 0, matched: 0, stored: 0, bounced: 0, error: null, lastRunAt: null };
export function getGmailSyncLastResult(): SyncResult {
  return lastResult;
}

// In-memory guard so a busy inbox isn't re-walked every cycle. Inbound client
// replies are also deduped at the DB layer by Message-ID, so this is just an
// efficiency cache that may reset on restart.
const processedMessageIds = new Set<string>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A bounce/non-delivery report (NDR) from the mail system rather than a person.
// Checks the sender, subject, and (as a fallback) the top of the raw source.
function isBounceNotification(fromAddr: string, subject: string, rawHead = ""): boolean {
  if (/mailer-daemon|postmaster|mail.?delivery/i.test(fromAddr)) return true;
  if (/delivery status notification|delivery (has )?failed|undeliverable|mail delivery (failed|subsystem)|address not found|failure notice|returned mail|delivery incomplete|delivery has failed/i.test(subject)) return true;
  // Some relays send NDRs from odd addresses — detect the report content type.
  return /content-type:\s*multipart\/report;\s*report-type=delivery-status|^x-failed-recipients:/im.test(rawHead);
}

// Pull every plausible failed-recipient address out of an NDR. We try the
// reliable structured signals first, then fall back to scanning ALL addresses
// in the raw source (which includes the quoted original message). The caller
// attempts to mark each against a real send, so noise addresses are harmless.
function extractBouncedRecipients(raw: string): string[] {
  const out = new Set<string>();
  const add = (a?: string | null) => {
    if (!a) return;
    const clean = a.trim().replace(/^<|>$/g, "").replace(/[.,;:]+$/, "").toLowerCase();
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) out.add(clean);
  };

  // 1) Gmail/most relays add this header on bounces — most reliable.
  for (const m of raw.matchAll(/^x-failed-recipients:\s*(.+)$/gim)) {
    m[1].split(/[,;]/).forEach((a) => add(a));
  }
  // 2) Structured DSN fields.
  for (const m of raw.matchAll(/(?:Final|Original)-Recipient:\s*(?:rfc822|RFC822);\s*([^\s<>;]+@[^\s<>;]+)/gi)) add(m[1]);
  // 3) Human-readable phrasing.
  for (const m of raw.matchAll(/(?:delivered to|deliver to|recipient[s]?[^@\n]{0,40}?)\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/gi)) add(m[1]);

  if (out.size > 0) return [...out];

  // 4) Last resort: every address in the message, minus our own + mail-system
  //    noise. The caller only flips addresses that match an actual send.
  for (const m of raw.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const a = m[0].toLowerCase();
    if (a.endsWith("newdawnfranchising.com")) continue;
    if (/mailer-daemon|postmaster|googlemail\.com|google\.com|@gmail\.com$/.test(a)) continue;
    add(a);
  }
  return [...out];
}

// Classify a bounce as permanent (hard) vs transient (soft) from the NDR body.
// DSN Status / SMTP reply codes: 5.x.x / 5xx = permanent, 4.x.x / 4xx = transient.
// Only HARD bounces should auto-suppress; soft ones (full mailbox, greylisting,
// rate limit) are temporary and the contact should keep its enrollment.
// Defaults to "hard" when nothing is parseable — matches prior behaviour.
function classifyBounce(raw: string): "hard" | "soft" {
  const status = raw.match(/^status:\s*([45])\.\d+\.\d+/im);
  if (status) return status[1] === "4" ? "soft" : "hard";
  const diag = raw.match(/(?:diagnostic-code:[^\n]*?|\bsmtp;\s*)([45]\d\d)\b/i) || raw.match(/\b([45]\d\d)\s+\d\.\d\.\d/);
  if (diag) return diag[1].startsWith("4") ? "soft" : "hard";
  if (/quota|mailbox (is )?full|over quota|temporar|try again|greylist|rate.?limit|deferred|throttl/i.test(raw)) return "soft";
  return "hard";
}

/**
 * Poll Dylan's inbox once and import any new client replies.
 * No-ops (with a clear reason) when the app password isn't configured.
 */
export async function syncFranchisingInbox(): Promise<SyncResult> {
  const password = getAppPassword();
  if (!password) {
    lastResult = { scanned: 0, matched: 0, stored: 0, bounced: 0, error: "GMAIL_APP_PASSWORD_DYLAN not set", lastRunAt: new Date() };
    return lastResult;
  }
  lastResult = await syncSenderInbox(PRIMARY_EMAIL, password);
  return lastResult;
}

/**
 * Full inbox sync for ONE sender mailbox: bounce/NDR handling plus personal
 * replies (pause the sender's active campaigns for that person, alert the team,
 * and land the message on the matching CRM record). With sender rotation on,
 * drip mail goes out from every credentialed mailbox — so every one of those
 * inboxes needs this treatment, not just franchising@ (a reply to dylan@ that
 * nobody sees is exactly the "no one ever replies" failure mode).
 */
const syncingMailboxes = new Set<string>();

export async function syncSenderInbox(senderEmail: string, password: string, lookbackDays = 7): Promise<SyncResult> {
  if (syncingMailboxes.has(senderEmail)) return { scanned: 0, matched: 0, stored: 0, bounced: 0, error: "Mailbox sync already running", lastRunAt: new Date() };
  syncingMailboxes.add(senderEmail);
  let client: ImapFlow | null = null;
  let scanned = 0;
  let matched = 0;
  let stored = 0;
  let bounced = 0;

  try {
    client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: senderEmail, pass: password },
      logger: false,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Look back 7 days so recent bounces are caught even after a restart.
      const since = new Date(Date.now() - Math.min(180, Math.max(1, lookbackDays)) * 24 * 60 * 60 * 1000);
      // Whether transient (4.x.x) bounces are left alone instead of suppressed.
      const softSkipDnc = (await getDeliverabilitySettings()).softBounceSkipDnc;

      // Fetch full raw source too — bounce parsing needs headers + all MIME
      // parts (the decoded TEXT part alone is often MIME-encoded).
      for await (const msg of client.fetch({ since }, { envelope: true, bodyParts: ["TEXT"], source: true, internalDate: true })) {
        scanned++;
        const msgId = msg.envelope?.messageId || `${senderEmail}:${client.mailbox && client.mailbox.uidValidity}:${msg.uid}`;

        const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";
        const fromName = msg.envelope?.from?.[0]?.name || fromAddr;
        const subject = msg.envelope?.subject || "(no subject)";
        const rawSource = msg.source ? msg.source.toString("utf8") : "";

        // Bounce / non-delivery reports FIRST — and intentionally NOT subject to
        // the in-memory dedup, so a manual "Check for bounces" always re-scans.
        // markDripSendBounced is idempotent (returns null once already bounced).
        if (isBounceNotification(fromAddr, subject, rawSource.slice(0, 4000))) {
          const kind = classifyBounce(rawSource || subject);
          // Transient (soft) bounce: don't suppress — it's temporary and the
          // contact should keep its enrollment to retry on the next cycle.
          if (kind === "soft" && softSkipDnc) {
            console.log(`[GmailSync] soft bounce (transient) — not suppressing (${subject})`);
            processedMessageIds.add(msgId);
            continue;
          }
          const candidates = extractBouncedRecipients(rawSource || subject);
          for (const addr of candidates) {
            const marked = await storage.markDripSendBounced(addr, `Bounced (${kind}): ${subject}`.slice(0, 200), msg.internalDate instanceof Date ? msg.internalDate : msg.envelope?.date);
            if (marked) {
              bounced++;
              stored++;
              // Suppress the address so future drip steps skip it, and stop the
              // enrollment so it doesn't keep retrying a dead mailbox.
              try { await addToDnc(addr, undefined, undefined, `Email hard-bounced (${kind})`); } catch {}
              try {
                if (marked.enrollmentId) {
                  await storage.updateDripEnrollment(marked.enrollmentId, { status: "bounced" } as any);
                }
              } catch {}
              console.log(`[GmailSync] bounce — marked ${addr} bounced + suppressed (${subject})`);
            }
          }
          processedMessageIds.add(msgId);
          continue;
        }

        // From here on it's a normal message — apply the dedup cache.
        if (processedMessageIds.has(msgId)) continue;

        // Skip our own messages / anything without a sender.
        if (!fromAddr || fromAddr === senderEmail) {
          processedMessageIds.add(msgId);
          continue;
        }

        const parsed = await simpleParser(msg.source || Buffer.alloc(0));
        const bodyText = (parsed.text || "").replace(/\r\n/g, "\n").trim();
        // Inspect only this message's headers, never headers quoted in its body.
        const rawHeaders = rawSource.split(/\r?\n\r?\n/, 1)[0];
        const replyText = authoredReply(bodyText);
        const replySignal = classifyReply(replyText, subject);

        // Skip newsletters / service welcome emails / notifications / auto-replies
        // (e.g. "Welcome to PR Newswire!") — these aren't personal replies and
        // shouldn't clutter the contact's timeline / Activity feed.
        if (isAutomatedOrBulkEmail(fromAddr, subject, rawHeaders, replyText)) {
          processedMessageIds.add(msgId);
          continue;
        }
        const bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(bodyText)}</pre>`;
        const preview = replyText.slice(0, 240);
        const replyMetadata = { subject, from: fromAddr, preview, messageId: msgId, replyText, replySignal, replyReceivedAt: (msg.envelope?.date || new Date()).toISOString(), replyPolicyVersion: REPLY_POLICY_VERSION };
        if (replySignal === "opt_out" || replySignal === "declined") {
          await suppressReplyOutreach(fromAddr, replySignal);
        }

        const enrolls = await storage.getDripEnrollmentsByEmail(fromAddr);
        const sends = (await Promise.all(enrolls.map(e => storage.getDripSends(e.id)))).flat();
        const references = [parsed.inReplyTo, ...(Array.isArray(parsed.references) ? parsed.references : [parsed.references])]
          .filter((r): r is string => !!r);
        const receivedAt = msg.internalDate instanceof Date ? msg.internalDate : parsed.date;
        const matchedSend = receivedAt ? findReplySend(sends, { subject, receivedAt, references, bodyText }) : undefined;
        const optOut = replySignal === "opt_out";
        if (optOut && enrolls.length > 0) {
          if (!(await isOnDnc(fromAddr))) await addToDnc(fromAddr, undefined, undefined, "Recipient requested unsubscribe");
          await storage.markEnrollmentsUnsubscribed(fromAddr);
        }
        if (matchedSend) {
          await storage.updateDripSend(matchedSend.id, { status: "replied" });
          // Attribute only the matched sequence, but stop every active sequence
          // for this person so another campaign cannot continue cold follow-ups.
          for (const enrollment of enrolls) {
            if (enrollment.status === "active" ||
                (enrollment.id === matchedSend.enrollmentId && enrollment.status === "completed")) {
              await storage.updateDripEnrollment(enrollment.id, { status: optOut ? "unsubscribed" : "replied" });
            }
          }
          if (matchedSend.status !== "replied" && replySignal !== "opt_out" && replySignal !== "declined") {
            const alert = await sendEmail(DEFAULT_SENDER, `Reply from ${fromName} — campaign paused`,
              `<p>${escapeHtml(fromName)} replied to ${escapeHtml(subject)}. Follow-ups have stopped.</p>${bodyHtml}`,
              undefined, undefined, { skipUnsubscribe: true });
            if (!alert.success) console.error("[GmailSync] Reply saved but team alert failed:", alert.error);
          }
        }

        // Primary match: investor CRM client by email.
        const clientRow = await storage.getCrmClientByEmail(fromAddr);
        if (clientRow) {
          const exists = await storage.getCrmDirectEmailByMessageId(msgId);
          if (!exists) {
            await storage.createCrmDirectEmail({
              clientId: clientRow.id,
              fromEmail: fromAddr,
              fromName,
              toEmail: senderEmail,
              subject,
              bodyHtml,
              bodyText,
              direction: "inbound",
              messageId: msgId,
              status: "received",
            });
            await storage.createCrmClientActivity({
              clientId: clientRow.id,
              activityType: "email_received",
              metadata: replyMetadata,
            });
            stored++;
          }
          matched++;
          processedMessageIds.add(msgId);
          continue;
        }

        // Log an inbound email reply once per Message-ID against a contact. The
        // in-memory dedup resets on restart and the IMAP fetch re-scans 7 days,
        // so guard at the DB layer too (matches the client + SMS reply paths).
        const logContactReply = async (contactId: string) => {
          const acts = await storage.getContactActivities(contactId);
          if (acts.some((a) => ((a.metadata || {}) as any).messageId === msgId)) return false;
          await storage.createContactActivity({
            contactId,
            activityType: "email_received",
            metadata: replyMetadata,
          });
          return true;
        };

        // Fallback: attorney/partner contact by email → log as an activity.
        const contactRow = await storage.getContactByEmail(fromAddr);
        if (contactRow) {
          if (await logContactReply(contactRow.id)) stored++;
          matched++;
        } else {
          // Final fallback: a cold prospect (e.g. a Seamless import enrolled in a
          // campaign) with no contact/client record yet. Mirror them into Contacts
          // and log the reply so it surfaces in the campaign Activity feed.
          // Wrapped best-effort so one bad row (e.g. a unique-email race) can't
          // abort the rest of the inbox poll.
          try {
            const prospect = await storage.getProspectByEmail(fromAddr);
            if (prospect) {
              const contact = await storage.findOrCreateContactForProspect(prospect);
              if (await logContactReply(contact.id)) stored++;
              matched++;
            }
          } catch (err) {
            throw new Error(`Could not store prospect reply ${msgId}`, { cause: err });
          }
        }

        if (processedMessageIds.size > 10_000) processedMessageIds.clear();
        processedMessageIds.add(msgId);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (e: any) {
    const error = e?.message || "IMAP sync error";
    console.error(`[GmailSync] ${senderEmail} poll error:`, error);
    if (client) {
      try { await client.logout(); } catch {}
    }
    return { scanned, matched, stored, bounced, error, lastRunAt: new Date() };
  } finally {
    syncingMailboxes.delete(senderEmail);
  }

  if (stored > 0 || bounced > 0) {
    console.log(`[GmailSync] ${senderEmail} — scanned ${scanned}, matched ${matched}, stored ${stored} (${bounced} bounce[s])`);
  }
  return { scanned, matched, stored, bounced, error: null, lastRunAt: new Date() };
}

let scheduled = false;

/** Register the recurring inbox poll (every 2 minutes). Safe to call once at boot. */
export function scheduleGmailSync(): void {
  if (scheduled) return;
  scheduled = true;

  if (!getAppPassword()) {
    console.log("[GmailSync] Dylan app password not set — inbox sync idle until GMAIL_APP_PASSWORD_DYLAN is configured");
  }

  cron.schedule("*/2 * * * *", () => {
    syncFranchisingInbox().catch((e) => console.error("[GmailSync] scheduled run failed:", e?.message || e));
  });
  console.log("[GmailSync] Dylan inbox sync scheduled (every 2 min)");
}

// ─── Full sync for the OTHER sender inboxes ────────────────────────────────────
// franchising@ gets the frequent (2-min) sync above. With sender rotation on,
// dylan@/info@/support@ send cold drip mail too — so their inboxes need the SAME
// full treatment (personal replies pause campaigns + alert the team + land on
// the CRM record, bounces suppress), just on a gentler cadence.

let allInboxScheduled = false;

/** Register a recurring full reply+bounce sync of the non-franchising sender inboxes. */
export function scheduleAllInboxBounceScan(): void {
  if (allInboxScheduled) return;
  allInboxScheduled = true;
  const others = () => ALL_SENDER_PROFILES.filter((p) => p.email !== PRIMARY_EMAIL && !!getSenderPassword(p));
  cron.schedule("*/15 * * * *", async () => {
    for (const p of others()) {
      const pass = getSenderPassword(p);
      if (pass) await syncSenderInbox(p.email, pass).catch((e) => console.error("[GmailSync] all-inbox sync error:", e?.message || e));
    }
  });
  console.log(`[GmailSync] all-inbox reply+bounce sync scheduled (every 15 min) for ${others().length} other sender(s)`);
}

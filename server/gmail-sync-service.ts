// ─── Gmail Inbox Sync (franchising@newdawnfranchising.com) ───────────────────
// Two-way Gmail connection: outbound is handled by email-service.ts; this module
// pulls the franchising@ INBOX over IMAP and lands client replies on the matching
// CRM record so conversations stay in one place.
//
// Modeled on the IMAP reply listener in agent-service.ts (pollForApprovalReply).
// Connects with the same Gmail App Password pattern, locks INBOX, fetches recent
// messages, matches the sender to a CRM client (or attorney contact), and stores
// the reply as an inbound crm_direct_emails row + an activity. Deduped by Message-ID.

import { ImapFlow } from "imapflow";
import cron from "node-cron";
import { storage } from "./storage";

const FRANCHISING_EMAIL = "franchising@newdawnfranchising.com";

function getAppPassword(): string | undefined {
  // Strip whitespace (Gmail app passwords are 16 contiguous chars; pasted env
  // values often carry a trailing newline/space that would break IMAP auth).
  const clean = process.env.GMAIL_APP_PASSWORD_FRANCHISING?.replace(/\s+/g, "");
  return clean || undefined;
}

export function getGmailSyncStatus() {
  const pass = (getAppPassword() || "").replace(/\s/g, "");
  return {
    email: FRANCHISING_EMAIL,
    configured: !!pass,
    appPasswordValid: pass.length === 16,
  };
}

interface SyncResult {
  scanned: number;
  matched: number;
  stored: number;
  error: string | null;
  lastRunAt: Date | null;
}

let lastResult: SyncResult = { scanned: 0, matched: 0, stored: 0, error: null, lastRunAt: null };
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

/**
 * Poll the franchising@ inbox once and import any new client replies.
 * No-ops (with a clear reason) when the app password isn't configured.
 */
export async function syncFranchisingInbox(): Promise<SyncResult> {
  const password = getAppPassword();
  if (!password) {
    lastResult = { scanned: 0, matched: 0, stored: 0, error: "GMAIL_APP_PASSWORD_FRANCHISING not set", lastRunAt: new Date() };
    return lastResult;
  }

  let client: ImapFlow | null = null;
  let scanned = 0;
  let matched = 0;
  let stored = 0;

  try {
    client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: FRANCHISING_EMAIL, pass: password },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Look back 2 days; Message-ID dedupe keeps repeats out of the CRM.
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      for await (const msg of client.fetch({ since }, { envelope: true, bodyParts: ["TEXT"] })) {
        scanned++;
        const msgId = msg.envelope?.messageId || `seq-${msg.seq}`;
        if (processedMessageIds.has(msgId)) continue;

        const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";
        const fromName = msg.envelope?.from?.[0]?.name || fromAddr;
        const subject = msg.envelope?.subject || "(no subject)";

        // Skip our own messages / anything without a sender.
        if (!fromAddr || fromAddr === FRANCHISING_EMAIL) {
          processedMessageIds.add(msgId);
          continue;
        }

        const textPart = msg.bodyParts?.get("TEXT");
        const bodyText = (textPart ? Buffer.from(textPart).toString("utf8") : "").replace(/\r\n/g, "\n").trim();
        const bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(bodyText)}</pre>`;
        const preview = bodyText.slice(0, 240);

        // Primary match: investor CRM client by email.
        const clientRow = await storage.getCrmClientByEmail(fromAddr);
        if (clientRow) {
          const exists = await storage.getCrmDirectEmailByMessageId(msgId);
          if (!exists) {
            await storage.createCrmDirectEmail({
              clientId: clientRow.id,
              fromEmail: fromAddr,
              fromName,
              toEmail: FRANCHISING_EMAIL,
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
              metadata: { subject, from: fromAddr, preview, messageId: msgId },
            });
            stored++;
          }
          matched++;
          processedMessageIds.add(msgId);
          continue;
        }

        // Fallback: attorney/partner contact by email → log as an activity.
        const contactRow = await storage.getContactByEmail(fromAddr);
        if (contactRow) {
          await storage.createContactActivity({
            contactId: contactRow.id,
            activityType: "email_received",
            metadata: { subject, from: fromAddr, preview, messageId: msgId },
          });
          matched++;
          stored++;
        }

        processedMessageIds.add(msgId);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (e: any) {
    const error = e?.message || "IMAP sync error";
    console.error("[GmailSync] franchising@ poll error:", error);
    if (client) {
      try { await client.logout(); } catch {}
    }
    lastResult = { scanned, matched, stored, error, lastRunAt: new Date() };
    return lastResult;
  }

  if (stored > 0) {
    console.log(`[GmailSync] franchising@ — scanned ${scanned}, matched ${matched}, stored ${stored} new inbound reply(ies)`);
  }
  lastResult = { scanned, matched, stored, error: null, lastRunAt: new Date() };
  return lastResult;
}

let scheduled = false;

/** Register the recurring inbox poll (every 2 minutes). Safe to call once at boot. */
export function scheduleGmailSync(): void {
  if (scheduled) return;
  scheduled = true;

  if (!getAppPassword()) {
    console.log("[GmailSync] franchising@ app password not set — inbox sync idle until GMAIL_APP_PASSWORD_FRANCHISING is configured");
  }

  cron.schedule("*/2 * * * *", () => {
    syncFranchisingInbox().catch((e) => console.error("[GmailSync] scheduled run failed:", e?.message || e));
  });
  console.log("[GmailSync] franchising@ inbox sync scheduled (every 2 min)");
}

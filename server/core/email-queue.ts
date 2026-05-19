import { sendEmail, sendEmailFromSender } from "../email-service";

export type EmailPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export interface QueuedEmail {
  id: string;
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  priority: EmailPriority;
  metadata?: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  createdAt: Date;
}

const PRIORITY_ORDER: Record<EmailPriority, number> = {
  CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3,
};

const RETRY_DELAYS_MS = [60_000, 300_000, 900_000];
const MAX_CONCURRENT = 10;
const MIN_DELAY_MS = 200;

let queue: QueuedEmail[] = [];
let activeCount = 0;
let processorInterval: ReturnType<typeof setInterval> | null = null;
let lastSendAt = 0;

function generateId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const emailQueue = {
  add(opts: {
    to: string;
    from?: string;
    subject: string;
    html: string;
    text?: string;
    priority?: EmailPriority;
    metadata?: Record<string, any>;
  }): string {
    const id = generateId();
    const item: QueuedEmail = {
      id,
      to: opts.to,
      from: opts.from,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      priority: opts.priority || "NORMAL",
      metadata: opts.metadata,
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
      createdAt: new Date(),
    };
    // Insert in priority order
    const insertAt = queue.findIndex(e => PRIORITY_ORDER[e.priority] > PRIORITY_ORDER[item.priority]);
    if (insertAt === -1) queue.push(item);
    else queue.splice(insertAt, 0, item);

    return id;
  },

  size(): number { return queue.length; },
  active(): number { return activeCount; },

  getStatus() {
    return {
      queued: queue.length,
      active: activeCount,
      byPriority: {
        CRITICAL: queue.filter(e => e.priority === "CRITICAL").length,
        HIGH: queue.filter(e => e.priority === "HIGH").length,
        NORMAL: queue.filter(e => e.priority === "NORMAL").length,
        LOW: queue.filter(e => e.priority === "LOW").length,
      },
    };
  },
};

async function processOne(item: QueuedEmail): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, MIN_DELAY_MS - (now - lastSendAt));
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
  lastSendAt = Date.now();

  try {
    if (item.from) {
      await sendEmailFromSender(item.from, item.to, item.subject, item.html);
    } else {
      await sendEmail(item.to, item.subject, item.html);
    }
    console.log(`[EmailQueue] Sent "${item.subject}" to ${item.to}`);
  } catch (err: any) {
    item.attempts++;
    if (item.attempts < item.maxAttempts) {
      const delay = RETRY_DELAYS_MS[Math.min(item.attempts - 1, RETRY_DELAYS_MS.length - 1)];
      item.nextAttemptAt = new Date(Date.now() + delay);
      queue.push(item); // re-queue
      console.warn(`[EmailQueue] Failed "${item.subject}" — retry ${item.attempts}/${item.maxAttempts} in ${delay / 1000}s: ${err.message}`);
    } else {
      console.error(`[EmailQueue] DEAD LETTER: "${item.subject}" to ${item.to} after ${item.attempts} attempts: ${err.message}`);
    }
  }
}

function startProcessor(): void {
  if (processorInterval) return;
  processorInterval = setInterval(async () => {
    const now = new Date();
    const ready = queue.filter(e => e.nextAttemptAt <= now);
    const slots = Math.min(MAX_CONCURRENT - activeCount, ready.length);
    if (slots <= 0) return;

    const batch = ready.slice(0, slots);
    batch.forEach(item => {
      const idx = queue.indexOf(item);
      if (idx !== -1) queue.splice(idx, 1);
    });

    activeCount += batch.length;
    await Promise.all(batch.map(item => processOne(item).finally(() => activeCount--)));
  }, 500);
}

startProcessor();

/** Match an inbound message to an actual prior email, never just an address. */
export interface ReplyCandidate {
  id: string;
  enrollmentId: string;
  subject: string;
  status: string;
  channel?: string | null;
  sentAt?: Date | string | null;
}
export const ACCEPTED_EMAIL_STATUSES = ["sent", "delivered", "opened", "clicked", "replied"];
export function campaignMessageId(sendId: string): string {
  return `<drip-${sendId}@newdawnfranchising.com>`;
}
export function normalizeReplySubject(subject: string): string {
  return subject.replace(/^(?:(?:re|fw|fwd|aw|sv):\s*)+/gi, "").trim().toLowerCase();
}
export function findReplySend<T extends ReplyCandidate>(
  sends: T[], reply: { subject: string; receivedAt: Date; references: string[]; bodyText?: string },
): T | undefined {
  const eligible = sends.filter(s => (s.channel || "email") === "email"
    && (ACCEPTED_EMAIL_STATUSES.includes(s.status) || (s.status === "bounced" && isOptOutReply(reply.bodyText || ""))) && s.sentAt
    && new Date(s.sentAt).getTime() <= reply.receivedAt.getTime());
  const exact = eligible.filter(s => reply.references.includes(campaignMessageId(s.id)));
  // A known campaign ID must not fall back to a different sequence's subject.
  if (reply.references.some(r => r.startsWith("<drip-"))) return exact.sort(newest)[0];
  // List-Unsubscribe mailto requests deliberately use a new subject. A known
  // recipient's explicit opt-out still stops outreach and credits the latest send.
  if (isOptOutReply(reply.bodyText || "")) return eligible.sort(newest)[0];
  const subject = normalizeReplySubject(reply.subject);
  if (!subject) return undefined;
  return eligible.filter(s => normalizeReplySubject(s.subject) === subject).sort(newest)[0];
}
function newest(a: ReplyCandidate, b: ReplyCandidate): number {
  return new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime();
}
export function isOptOutReply(body: string): boolean {
  // Only inspect the opening paragraph and require a direct request. Quoted
  // signatures/footers may lack a standard "On ... wrote" delimiter.
  const ownText = body.trimStart().split(/\r?\n\s*\r?\n|\n(?:On .+wrote:|>|From:)/i)[0];
  return /^(?:please\s+)?(?:unsubscribe\b|remove me\b|stop (?:emailing|contacting|sending)\b|do not (?:email|contact)\b)/i.test(ownText)
    || /\bplease (?:unsubscribe|remove me|stop (?:emailing|contacting|sending))\b/i.test(ownText);
}

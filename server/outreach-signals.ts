import { isOptOutReply } from "./campaign-replies";
/** Conservative intent policy: ambiguous replies need a written response, never a call. */
export type ReplySignal = "call_requested" | "information_requested" | "reply_received" | "declined" | "opt_out" | "automated";
export const REPLY_POLICY_VERSION = 1;

export function authoredReply(text: string): string {
  return text.replace(/\r\n/g, "\n")
    .split(/\n\s*(?:On [\s\S]{0,300}?wrote:|From:|Sent:|Begin forwarded message:|Sent from my|_{5,}|-{2,}\s*Original Message\s*-*|>|--\s*$)/im)[0]
    .replace(/[’‘]/g, "'").trim();
}

export function classifyReply(text: string, subject = ""): ReplySignal {
  const body = authoredReply(text);
  // Signatures and undelimited quoted footers often follow a blank line.
  const opening = body.replace(/^(?:hi|hello|dear)\b[^\n]{0,80}\n+/i, "").split(/\n\s*\n/)[0];
  if (/\b(out of (?:the )?office|automatic reply|auto.?reply|on vacation|away from (?:the )?office)\b/i.test(`${subject}\n${body}`)) return "automated";
  if (isOptOutReply(opening) || /^(?:please )?(?:remove us|take me off|stop|don't contact|do not contact)(?:[.!]|$)/i.test(opening)) return "opt_out";
  if (/\b(but|however|instead|client|he|she|they|email only|no calls)\b|["“”]/i.test(opening) || /not interested in (?:a |the )?call/i.test(opening)) return "reply_received";
  if (/\b(not interested|no thanks|no thank you|not a fit|not for (?:me|us)|not right now|not at this time)\b/i.test(opening)) return "declined";
  // Negation, conditions, third-party requests, and quoted wording all require review.
  if (/\b(no|not|don't|do not|can't|cannot|won't|if|unless|when|once|maybe|might|client|he|she|they)\b|["“”]/i.test(body)) return "reply_received";
  if (/\b(?:please (?:call|phone) (?:me|us)|(?:can|could|would) you (?:please )?(?:call|phone) (?:me|us)|(?:please |can you |could you )?(?:help me|help us) (?:book|schedule) (?:a |the )?(?:call|meeting)|(?:let's|let us|I'd like to|I would like to) (?:book|schedule|arrange) (?:a |the )?(?:call|meeting))\b/i.test(opening)) return "call_requested";
  if (/\b(?:send|share|request|receive|provide)\b.{0,65}\b(?:fdd|information|details|brochure|disclosure|deck)\b|\[FDD Request\]/i.test(opening)) return "information_requested";
  return "reply_received";
}

export type ReplyEvidence = { sourceId: string; text: string; receivedAt: Date; subject?: string };
export function qualifiesForCall(evidence?: ReplyEvidence): boolean {
  return !!evidence?.sourceId.trim() && Number.isFinite(evidence.receivedAt.getTime()) &&
    classifyReply(evidence.text, evidence.subject) === "call_requested";
}

export function replyEvidenceFromMetadata(metadata: unknown, receivedAt: Date, activityId: string): ReplyEvidence | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const m = metadata as Record<string, unknown>;
  // Historical previews can omit a later negation. Only classify complete authored text.
  if (m.replyPolicyVersion !== REPLY_POLICY_VERSION || typeof m.replyText !== "string") return undefined;
  const timestamp = typeof m.replyReceivedAt === "string" ? new Date(m.replyReceivedAt) : receivedAt;
  if (!Number.isFinite(timestamp.getTime())) return undefined;
  return { sourceId: typeof m.messageId === "string" ? m.messageId : activityId, text: m.replyText, receivedAt: timestamp, subject: typeof m.subject === "string" ? m.subject : undefined };
}

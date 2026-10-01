export interface OutcomeRow {
  channel: string;
  recipientEmail: string;
  status: string;
  sentAt?: Date | string | null;
  replySignal?: string | null;
  bounceVerifiedAt?: Date | string | null;
}
export function campaignOutcomes(rows: OutcomeRow[]) {
  const email = rows.filter(r => r.channel === "email");
  const people = (predicate: (r: OutcomeRow) => boolean) => new Set(email.filter(predicate).map(r => r.recipientEmail.trim().toLowerCase())).size;
  const acceptedRecipients = people(r => !!r.sentAt);
  const positiveReplies = people(r => r.status === "replied" && ["information_requested", "call_requested"].includes(r.replySignal || ""));
  return {
    acceptedRecipients,
    positiveReplies,
    humanReplies: people(r => r.status === "replied" && r.replySignal !== "automated"),
    optOutReplies: people(r => r.status === "replied" && r.replySignal === "opt_out"),
    declinedReplies: people(r => r.status === "replied" && r.replySignal === "declined"),
    unclassifiedReplies: people(r => r.status === "replied" && (!r.replySignal || r.replySignal === "reply_received")),
    verifiedBounces: email.filter(r => r.bounceVerifiedAt).length,
    legacyBounces: email.filter(r => r.status === "bounced" && !r.bounceVerifiedAt).length,
    positiveReplyRate: acceptedRecipients ? positiveReplies / acceptedRecipients : null,
  };
}

/** Give first introductions 60% of accepted volume while follow-ups retain capacity. */
export function preferFirstContact(firstContactsLast24h: number, emailsLast24h: number): boolean {
  return firstContactsLast24h < Math.ceil((emailsLast24h + 1) * 0.6);
}

export interface EmailStepTiming {
  id: string;
  delayDays?: number | null;
}

export interface SentEmailTiming {
  stepId: string;
  channel: string | null;
  sentAt: Date | string | null;
}

/** Overdue sequences retain their spacing from the actual previous email. */
export function nextEmailAllowedAt(
  step: EmailStepTiming,
  steps: EmailStepTiming[],
  sends: SentEmailTiming[],
  lastRecipientSend: Date | undefined,
): number {
  const day = 86_400_000;
  let allowedAt = lastRecipientSend ? lastRecipientSend.getTime() + day : 0;
  for (const send of sends) {
    if (send.channel !== "email" || !send.sentAt) continue;
    const priorIndex = steps.findIndex(s => s.id === send.stepId);
    const currentIndex = steps.findIndex(s => s.id === step.id);
    if (priorIndex < 0 || priorIndex >= currentIndex) continue;
    const gapDays = Math.max(1, (step.delayDays ?? 0) - (steps[priorIndex].delayDays ?? 0));
    allowedAt = Math.max(allowedAt, new Date(send.sentAt).getTime() + gapDays * day);
  }
  return allowedAt;
}

/** Use a neutral greeting when enrichment supplied an organization or placeholder. */
export function greetingName(name: string): { firstName: string; fullName: string } {
  const cleaned = name.trim().replace(/\s+/g, " ");
  const generic = /\b(new dawn|team|development|franchising|department|office|support|sales|info|contact|unknown|test|llc|llp|pllc|inc|corp|ltd|group|firm|law|legal|associates|partners|immigration)\b|[&@<>\d{}\[\]]/i;
  if (!cleaned || generic.test(cleaned)) return { firstName: "there", fullName: "there" };
  const fullName = cleaned.replace(/^(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+/i, "");
  return { firstName: fullName.split(/\s+/)[0], fullName };
}

export interface SmsPermission {
  consented_at: Date | string;
  revoked_at: Date | string | null;
  source: string;
  disclosure: string;
  evidence: string;
  timezone: string;
}

export function validRecipientTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return value.includes("/"); }
  catch { return false; }
}

export function smsPermissionIssue(permission: SmsPermission | undefined, now = new Date()): string | null {
  if (!permission || permission.revoked_at) return "Text skipped: no current written marketing permission for this email and phone.";
  const at = new Date(permission.consented_at).getTime();
  if (!Number.isFinite(at) || at > now.getTime() || !permission.source.trim() || !permission.evidence.trim()
    || !/new dawn/i.test(permission.disclosure) || !/marketing|promotional/i.test(permission.disclosure))
    return "Text skipped: written permission evidence is incomplete or invalid.";
  if (!validRecipientTimezone(permission.timezone)) return "Text skipped: recipient timezone must be known.";
  return null;
}

export function inTemplateSmsWindow(timezone: string, now = new Date()): boolean {
  if (!validRecipientTimezone(timezone)) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value);
  return weekday !== "Sat" && weekday !== "Sun" && hour >= 10 && hour < 16;
}

export function templateSmsContentIssue(body: string): string | null {
  return /new dawn/i.test(body) && /reply\s+STOP\b/i.test(body)
    ? null : "Text needs New Dawn's identity and Reply STOP instructions before sending.";
}

export function templateTouchAllowedAt(day: number, steps: { id: string; delayDays: number }[], sends: { stepId: string; sentAt: Date | string | null; channel: string | null }[]): number {
  let allowedAt = 0;
  for (const send of sends) {
    if (!send.sentAt || !["email", "sms"].includes(send.channel || "")) continue;
    const prior = steps.find(s => s.id === send.stepId);
    if (!prior || prior.delayDays > day) continue;
    const gap = Math.max(1, day - prior.delayDays);
    allowedAt = Math.max(allowedAt, new Date(send.sentAt).getTime() + gap * 86400_000);
  }
  return allowedAt;
}

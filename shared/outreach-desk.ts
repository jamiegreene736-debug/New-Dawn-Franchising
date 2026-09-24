import { z } from "zod";

export const deskChannels = [
  "call",
  "email",
  "sms",
  "whatsapp",
  "linkedin",
] as const;
export type DeskChannel = (typeof deskChannels)[number];
export type Permission = {
  allowed: boolean;
  evidence: string;
  recordedAt: string;
  expiresAt: string;
};
export type Permissions = Partial<Record<DeskChannel, Permission>>;
export type Eligibility = { allowed: boolean; reason: string };
export const deskQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  view: z
    .enum([
      "today",
      "all",
      "callbacks",
      "replies",
      "opens",
      "research",
      "history",
    ])
    .default("today"),
  campaignId: z.string().max(100).default(""),
  signal: z.enum(["all", "opened", "clicked", "replied"]).default("all"),
  days: z.coerce.number().int().min(1).max(365).default(30),
  cursor: z.string().max(500).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type DeskQuery = z.infer<typeof deskQuerySchema>;
export type DeskPerson = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  track: string;
  status: string;
  triggerType: string;
  triggerAt: string;
  emailSubject: string | null;
  attemptCount: number;
  nextAttemptAt: string | null;
  outcomeNotes: string | null;
  updatedAt: string;
  timezone: string | null;
  timezoneConfirmed: boolean;
  linkedinUrl: string | null;
  permissions: Permissions;
  eligibility: Record<DeskChannel, Eligibility>;
  claimedBy: string | null;
  claimUntil: string | null;
};
export type CampaignPerson = {
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  campaignName: string;
  campaignId: string;
  sendId: string;
  queueId: string | null;
  opens: number;
  clicks: number;
  lastActivityAt: string;
  replied: boolean;
};
export type DeskEvent = {
  id: string;
  kind: string;
  detail: string;
  occurredAt: string;
};
export type DeskDetail = {
  person: DeskPerson;
  brief: string;
  timeline: DeskEvent[];
  emailStatus: string | null;
  emailVerifiedAt: string | null;
  calendarUrl: string;
};
export const outcomeSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime(),
    outcome: z.enum([
      "details",
      "callback",
      "no_answer",
      "voicemail",
      "meeting_pending",
      "not_interested",
      "wrong_number",
      "dnc",
    ]),
    notes: z.string().trim().max(4000).default(""),
    scheduledAt: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.outcome === "callback" && !value.scheduledAt) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Choose a callback time.",
      });
    }
  });
export type DeskOutcome = z.infer<typeof outcomeSchema>;
export const permissionSchema = z.object({
  channel: z.enum(deskChannels),
  allowed: z.boolean(),
  evidence: z.string().trim().min(8).max(1000),
  expiresAt: z.string().datetime(),
});
export const profileSchema = z.object({
  timezone: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional(),
  linkedinUrl: z.union([z.string().url().max(500), z.literal("")]).optional(),
});
export const actionDraftSchema = z.object({
  operationId: z.string().uuid(),
  channel: z.enum(["email", "sms", "whatsapp", "linkedin"]),
  subject: z.string().trim().max(200).default(""),
  body: z.string().trim().min(1).max(4000),
});
export const approveActionSchema = z.object({
  scheduledAt: z.string().datetime(),
});
export type DeskAction = {
  id: string;
  queueId: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  recipient: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  providerId: string | null;
  error: string | null;
};
export type DeskSettings = {
  paused: boolean;
  autoFollowups: boolean;
  dailyLimit: number;
  lastPreparedAt: string | null;
  preparationError: string | null;
};
export const settingsSchema = z.object({
  paused: z.boolean(),
  autoFollowups: z.boolean(),
  dailyLimit: z.number().int().min(1).max(100),
});
export type DeskOverview = {
  active: number;
  callbacks: number;
  replies: number;
  needsResearch: number;
  confirmedCalls: number;
  connectedCalls: number;
  confirmedMeetings: number;
  awaitingReview: number;
  exceptions: number;
  generatedAt: string;
  settings: DeskSettings;
};
export type DeskConnection = {
  id: string;
  name: string;
  configured: boolean;
  status: string;
  detail: string;
  lastEvidenceAt: string | null;
};
export type SavedDeskView = { id: string; name: string; filters: DeskQuery };

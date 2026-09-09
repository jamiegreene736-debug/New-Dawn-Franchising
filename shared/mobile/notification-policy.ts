import type {
  MobileNotificationCategory,
  MobileNotificationPreferences,
  MobileReminderKind,
} from "./contracts";

export const GENERIC_LOCK_SCREEN_NOTIFICATION = {
  title: "New Dawn Pathways",
  body: "You have an update in your pathway.",
} as const;

export const DEFAULT_MOBILE_NOTIFICATION_PREFERENCES: Omit<MobileNotificationPreferences, "updatedAt"> = {
  nextAction: true,
  appointments: true,
  fdd: true,
  embassy: true,
  expiration: true,
  secureStatus: true,
  opportunities: false,
  weeklyDigest: true,
  referrals: true,
  ownerOperations: true,
  followedEmbassyPost: null,
  timezone: "America/New_York",
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
};

const CATEGORY_PREFERENCE: Record<MobileNotificationCategory, keyof typeof DEFAULT_MOBILE_NOTIFICATION_PREFERENCES> = {
  next_action: "nextAction",
  appointment: "appointments",
  fdd: "fdd",
  embassy: "embassy",
  expiration: "expiration",
  secure_status: "secureStatus",
  opportunity: "opportunities",
  weekly_digest: "weeklyDigest",
  referral: "referrals",
  owner_operations: "ownerOperations",
};

export function isMobileNotificationCategoryEnabled(
  preferences: Omit<MobileNotificationPreferences, "updatedAt">,
  category: MobileNotificationCategory,
): boolean {
  const key = CATEGORY_PREFERENCE[category];
  const value = preferences[key];
  return typeof value === "boolean" ? value : false;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const REMINDER_OFFSETS: Record<MobileReminderKind, readonly number[]> = {
  appointment: [-7 * DAY_MS, -24 * HOUR_MS, -2 * HOUR_MS],
  fdd_review: [0],
  passport_check: [-30 * DAY_MS, -7 * DAY_MS, -DAY_MS],
  visa_check: [-30 * DAY_MS, -7 * DAY_MS, -DAY_MS],
  i94_check: [-30 * DAY_MS, -7 * DAY_MS, -DAY_MS],
  business_deadline: [-7 * DAY_MS, -DAY_MS],
};

export type MobileReminderDelivery = {
  category: MobileNotificationCategory;
  availableAt: Date;
  title: string;
  body: string;
  deepLink: string;
};

export function buildMobileReminderDeliveries(
  kind: MobileReminderKind,
  eventAt: Date,
  now = new Date(),
): MobileReminderDelivery[] {
  if (Number.isNaN(eventAt.getTime())) throw new Error("Reminder event date is invalid");

  const copy = REMINDER_COPY[kind];
  return REMINDER_OFFSETS[kind]
    .map((offset) => ({ ...copy, availableAt: new Date(eventAt.getTime() + offset) }))
    .filter((delivery) => delivery.availableAt.getTime() > now.getTime())
    .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime());
}

const REMINDER_COPY: Record<MobileReminderKind, Omit<MobileReminderDelivery, "availableAt">> = {
  appointment: {
    category: "appointment",
    title: "An appointment is approaching",
    body: "Review the confirmed time and preparation checklist.",
    deepLink: "/notifications",
  },
  fdd_review: {
    category: "fdd",
    title: "Your recorded FDD review date has arrived",
    body: "Review your records and confirm next steps with franchise counsel before signing or paying.",
    deepLink: "/notifications",
  },
  passport_check: {
    category: "expiration",
    title: "A saved passport date is approaching",
    body: "Check the current document and any professional guidance that applies to you.",
    deepLink: "/notifications",
  },
  visa_check: {
    category: "expiration",
    title: "A saved visa date is approaching",
    body: "Check your official record and contact independent counsel if you need legal guidance.",
    deepLink: "/notifications",
  },
  i94_check: {
    category: "expiration",
    title: "A saved I-94 date is approaching",
    body: "Check your current official CBP record. This reminder is not a status determination.",
    deepLink: "/notifications",
  },
  business_deadline: {
    category: "owner_operations",
    title: "A business deadline is approaching",
    body: "Review the saved operational task and its authoritative source.",
    deepLink: "/notifications",
  },
};

const OFFICIAL_SOURCE_HOSTS = new Set([
  "travel.state.gov",
  "uscis.gov",
  "www.uscis.gov",
  "cbp.gov",
  "www.cbp.gov",
  "ftc.gov",
  "www.ftc.gov",
  "federalregister.gov",
  "www.federalregister.gov",
]);

export function assertApprovedOfficialSource(input: {
  sourceUrl: string;
  reviewedBy: string;
  reviewedAt: Date;
}): void {
  const url = new URL(input.sourceUrl);
  if (url.protocol !== "https:" || !OFFICIAL_SOURCE_HOSTS.has(url.hostname)) {
    throw new Error("Official alerts must link to an approved government source");
  }
  if (!input.reviewedBy.trim() || Number.isNaN(input.reviewedAt.getTime())) {
    throw new Error("Official alerts require a recorded human review");
  }
}

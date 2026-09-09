import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import {
  mobileNotificationCategorySchema,
  mobileNotificationPreferencesSchema,
  mobileNotificationSchema,
  mobileNotificationUrgencySchema,
  mobileReminderKindSchema,
  mobileReminderSchema,
  type MobileNotification,
  type MobileNotificationCategory,
  type MobileNotificationPreferences,
  type MobileNotificationUrgency,
  type MobileReminder,
  type MobileReminderKind,
} from "@shared/mobile/contracts";
import {
  buildMobileReminderDeliveries,
  DEFAULT_MOBILE_NOTIFICATION_PREFERENCES,
  isMobileNotificationCategoryEnabled,
} from "@shared/mobile/notification-policy";

type QueryClient = Pick<PoolClient, "query">;

const preferenceRowSchema = mobileNotificationPreferencesSchema.extend({ updatedAt: z.date() });
const notificationRowSchema = z.object({
  id: z.string().uuid(),
  category: mobileNotificationCategorySchema,
  urgency: mobileNotificationUrgencySchema,
  title: z.string(),
  body: z.string(),
  deepLink: z.string(),
  sourceLabel: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourcePublishedAt: z.date().nullable(),
  availableAt: z.date(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
});
const reminderRowSchema = z.object({
  id: z.string().uuid(),
  kind: mobileReminderKindSchema,
  eventAt: z.date(),
  createdAt: z.date(),
});

export type NotificationPreferencesInput = Omit<MobileNotificationPreferences, "updatedAt">;

export type PublishMobileNotificationInput = {
  identityId: string;
  category: MobileNotificationCategory;
  urgency?: MobileNotificationUrgency;
  title: string;
  body: string;
  deepLink: string;
  availableAt?: Date;
  expiresAt?: Date | null;
  source?: { label: string; url: string; publishedAt?: Date | null } | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
};

export type MobilePushTarget = {
  deviceId: string;
  expoPushToken: string;
  locale: "en" | "es";
};

export class PostgresMobileNotificationRepository {
  constructor(private readonly pool: Pool) {}

  async getPreferences(identityId: string): Promise<MobileNotificationPreferences> {
    await this.pool.query(
      `insert into mobile_notification_preferences
         (identity_id, next_action, appointments, fdd, embassy, expiration, secure_status,
          opportunities, weekly_digest, referrals, owner_operations, followed_embassy_post,
          timezone, quiet_hours_start, quiet_hours_end)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (identity_id) do nothing`,
      [
        identityId,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.nextAction,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.appointments,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.fdd,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.embassy,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.expiration,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.secureStatus,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.opportunities,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.weeklyDigest,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.referrals,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.ownerOperations,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.followedEmbassyPost,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.timezone,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.quietHoursStart,
        DEFAULT_MOBILE_NOTIFICATION_PREFERENCES.quietHoursEnd,
      ],
    );
    const result = await this.pool.query(
      `select next_action as "nextAction", appointments, fdd, embassy, expiration,
              secure_status as "secureStatus", opportunities, weekly_digest as "weeklyDigest",
              referrals, owner_operations as "ownerOperations",
              followed_embassy_post as "followedEmbassyPost", timezone,
              quiet_hours_start as "quietHoursStart", quiet_hours_end as "quietHoursEnd",
              updated_at as "updatedAt"
         from mobile_notification_preferences where identity_id = $1`,
      [identityId],
    );
    return serializePreferences(preferenceRowSchema.parse(result.rows[0]));
  }

  async updatePreferences(identityId: string, input: NotificationPreferencesInput): Promise<MobileNotificationPreferences> {
    const result = await this.pool.query(
      `insert into mobile_notification_preferences
         (identity_id, next_action, appointments, fdd, embassy, expiration, secure_status,
          opportunities, weekly_digest, referrals, owner_operations, followed_embassy_post,
          timezone, quiet_hours_start, quiet_hours_end, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
       on conflict (identity_id) do update set
         next_action=excluded.next_action, appointments=excluded.appointments, fdd=excluded.fdd,
         embassy=excluded.embassy, expiration=excluded.expiration, secure_status=excluded.secure_status,
         opportunities=excluded.opportunities, weekly_digest=excluded.weekly_digest,
         referrals=excluded.referrals, owner_operations=excluded.owner_operations,
         followed_embassy_post=excluded.followed_embassy_post, timezone=excluded.timezone,
         quiet_hours_start=excluded.quiet_hours_start, quiet_hours_end=excluded.quiet_hours_end,
         updated_at=excluded.updated_at
       returning next_action as "nextAction", appointments, fdd, embassy, expiration,
         secure_status as "secureStatus", opportunities, weekly_digest as "weeklyDigest",
         referrals, owner_operations as "ownerOperations", followed_embassy_post as "followedEmbassyPost",
         timezone, quiet_hours_start as "quietHoursStart", quiet_hours_end as "quietHoursEnd",
         updated_at as "updatedAt"`,
      [identityId, input.nextAction, input.appointments, input.fdd, input.embassy, input.expiration,
        input.secureStatus, input.opportunities, input.weeklyDigest, input.referrals, input.ownerOperations,
        input.followedEmbassyPost, input.timezone, input.quietHoursStart, input.quietHoursEnd],
    );
    return serializePreferences(preferenceRowSchema.parse(result.rows[0]));
  }

  async registerDevice(identityId: string, input: {
    expoPushToken: string;
    platform: "ios" | "android";
    deviceLabel?: string;
    locale: "en" | "es";
  }): Promise<string> {
    const tokenHash = createHash("sha256").update(input.expoPushToken).digest("hex");
    const result = await this.pool.query<{ id: string }>(
      `insert into mobile_push_devices
         (identity_id, expo_push_token, token_hash, platform, device_label, locale, enabled, last_registered_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,true,now(),now())
       on conflict (token_hash) do update set identity_id=excluded.identity_id,
         expo_push_token=excluded.expo_push_token, platform=excluded.platform,
         device_label=excluded.device_label, locale=excluded.locale, enabled=true,
         last_registered_at=now(), updated_at=now()
       returning id`,
      [identityId, input.expoPushToken, tokenHash, input.platform, input.deviceLabel ?? null, input.locale],
    );
    return z.string().uuid().parse(result.rows[0]?.id);
  }

  async disableDevice(identityId: string, deviceId: string): Promise<void> {
    await this.pool.query(
      `update mobile_push_devices set enabled=false, updated_at=now() where id=$1 and identity_id=$2`,
      [deviceId, identityId],
    );
  }

  async listEnabledPushTargets(
    identityId: string,
    category: MobileNotificationCategory,
  ): Promise<MobilePushTarget[]> {
    const preferences = await this.getPreferences(identityId);
    if (!isMobileNotificationCategoryEnabled(preferences, category)) return [];
    const result = await this.pool.query(
      `select id as "deviceId", expo_push_token as "expoPushToken", locale
         from mobile_push_devices where identity_id=$1 and enabled=true`,
      [identityId],
    );
    return z.array(z.object({
      deviceId: z.string().uuid(),
      expoPushToken: z.string().min(1),
      locale: z.enum(["en", "es"]),
    })).parse(result.rows);
  }

  async listNotifications(identityId: string, limit = 50): Promise<MobileNotification[]> {
    const result = await this.pool.query(
      `select id, category, urgency, title, body, deep_link as "deepLink",
              source_label as "sourceLabel", source_url as "sourceUrl",
              source_published_at as "sourcePublishedAt", available_at as "availableAt",
              read_at as "readAt", created_at as "createdAt"
         from mobile_notifications
        where identity_id=$1 and available_at <= now() and (expires_at is null or expires_at > now())
        order by available_at desc limit $2`,
      [identityId, Math.min(Math.max(limit, 1), 100)],
    );
    return z.array(notificationRowSchema).parse(result.rows).map(serializeNotification);
  }

  async markRead(identityId: string, notificationId: string): Promise<void> {
    await this.pool.query(
      `update mobile_notifications set read_at=coalesce(read_at, now()) where id=$1 and identity_id=$2`,
      [notificationId, identityId],
    );
  }

  async createReminder(
    identityId: string,
    kind: MobileReminderKind,
    eventAt: Date,
    now = new Date(),
  ): Promise<MobileReminder> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `insert into mobile_notification_reminders (identity_id, kind, event_at, created_at, updated_at)
         values ($1,$2,$3,$4,$4) returning id, kind, event_at as "eventAt", created_at as "createdAt"`,
        [identityId, kind, eventAt, now],
      );
      const reminder = reminderRowSchema.parse(result.rows[0]);
      for (const delivery of buildMobileReminderDeliveries(kind, eventAt, now)) {
        await insertNotification(client, {
          identityId,
          reminderId: reminder.id,
          urgency: delivery.category === "appointment" ? "active" : "passive",
          ...delivery,
        });
      }
      await client.query("COMMIT");
      return serializeReminder(reminder);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listReminders(identityId: string): Promise<MobileReminder[]> {
    const result = await this.pool.query(
      `select id, kind, event_at as "eventAt", created_at as "createdAt"
         from mobile_notification_reminders
        where identity_id=$1 and cancelled_at is null and event_at > now()
        order by event_at asc limit 100`,
      [identityId],
    );
    return z.array(reminderRowSchema).parse(result.rows).map(serializeReminder);
  }

  async cancelReminder(identityId: string, reminderId: string): Promise<void> {
    await this.pool.query(
      `update mobile_notification_reminders set cancelled_at=now(), updated_at=now()
        where id=$1 and identity_id=$2 and cancelled_at is null`,
      [reminderId, identityId],
    );
  }

  async publish(input: PublishMobileNotificationInput): Promise<string> {
    const result = await insertNotification(this.pool, {
      ...input,
      reminderId: null,
      urgency: input.urgency ?? "active",
      availableAt: input.availableAt ?? new Date(),
    });
    return result;
  }
}

async function insertNotification(
  client: QueryClient,
  input: PublishMobileNotificationInput & { reminderId: string | null },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into mobile_notifications
       (identity_id, reminder_id, category, urgency, title, body, deep_link,
        source_label, source_url, source_published_at, reviewed_by, reviewed_at,
        available_at, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
    [input.identityId, input.reminderId, input.category, input.urgency ?? "active",
      input.title, input.body, input.deepLink, input.source?.label ?? null,
      input.source?.url ?? null, input.source?.publishedAt ?? null, input.reviewedBy ?? null,
      input.reviewedAt ?? null, input.availableAt ?? new Date(), input.expiresAt ?? null],
  );
  return z.string().uuid().parse(result.rows[0]?.id);
}

function serializePreferences(row: z.infer<typeof preferenceRowSchema>): MobileNotificationPreferences {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

function serializeNotification(row: z.infer<typeof notificationRowSchema>): MobileNotification {
  return mobileNotificationSchema.parse({
    id: row.id,
    category: row.category,
    urgency: row.urgency,
    title: row.title,
    body: row.body,
    deepLink: row.deepLink,
    source: row.sourceLabel && row.sourceUrl ? {
      label: row.sourceLabel,
      url: row.sourceUrl,
      publishedAt: row.sourcePublishedAt?.toISOString() ?? null,
    } : null,
    availableAt: row.availableAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

function serializeReminder(row: z.infer<typeof reminderRowSchema>): MobileReminder {
  return mobileReminderSchema.parse({
    ...row,
    eventAt: row.eventAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
}

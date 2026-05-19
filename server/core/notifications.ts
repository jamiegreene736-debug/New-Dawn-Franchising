import { db } from "../db";
import { systemNotifications } from "@shared/schema";
import { eq, isNull, desc } from "drizzle-orm";

export type NotificationType =
  | "seo_task_completed"
  | "seo_task_failed"
  | "lead_created"
  | "lead_replied"
  | "lead_positive_intent"
  | "visitor_high_intent"
  | "visitor_identified"
  | "meeting_booked"
  | "meeting_cancelled"
  | "content_draft_created"
  | "campaign_completed"
  | "general";

export interface NotificationOptions {
  type: NotificationType;
  system: string;
  title: string;
  message: string;
  leadId?: string;
  actionUrl?: string;
}

export const notifications = {
  async create(opts: NotificationOptions): Promise<void> {
    try {
      await db.insert(systemNotifications).values({
        type: opts.type,
        system: opts.system,
        title: opts.title,
        message: opts.message,
        leadId: opts.leadId,
        actionUrl: opts.actionUrl,
      });
    } catch (err) {
      console.error("[Notifications] Failed to create notification:", err);
    }
  },

  async getUnread(limit = 50): Promise<any[]> {
    try {
      return await db.select().from(systemNotifications)
        .where(isNull(systemNotifications.readAt))
        .orderBy(desc(systemNotifications.createdAt))
        .limit(limit);
    } catch {
      return [];
    }
  },

  async markRead(id: string): Promise<void> {
    try {
      await db.update(systemNotifications)
        .set({ readAt: new Date() })
        .where(eq(systemNotifications.id, id));
    } catch { /* ignore */ }
  },

  async markAllRead(): Promise<void> {
    try {
      await db.update(systemNotifications)
        .set({ readAt: new Date() })
        .where(isNull(systemNotifications.readAt));
    } catch { /* ignore */ }
  },

  async getCount(): Promise<number> {
    try {
      const rows = await db.select().from(systemNotifications)
        .where(isNull(systemNotifications.readAt));
      return rows.length;
    } catch {
      return 0;
    }
  },
};

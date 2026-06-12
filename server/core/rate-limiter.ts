import { db } from "../db";
import { rateLimitUsage } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export type Service =
  | "serp_api"
  | "pagespeed_api"
  | "seamless_api"
  | "twilio_sms"
  | "twilio_whatsapp"
  | "lob_mail"
  | "smtp_email"
  | "heygen_api";

const DAILY_LIMITS: Record<Service, number> = {
  serp_api: 100,
  pagespeed_api: 25000,
  seamless_api: 50,
  twilio_sms: 20,
  twilio_whatsapp: 20,
  lob_mail: 10,
  smtp_email: 100,
  heygen_api: 10,
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const rateLimiter = {
  async check(service: Service): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
    const today = todayKey();
    try {
      const rows = await db.select().from(rateLimitUsage)
        .where(and(eq(rateLimitUsage.service, service), eq(rateLimitUsage.date, today)));
      const used = rows[0]?.count || 0;
      const limit = DAILY_LIMITS[service] || 100;
      return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
    } catch {
      return { allowed: true, used: 0, limit: DAILY_LIMITS[service] || 100, remaining: 100 };
    }
  },

  async consume(service: Service, amount = 1): Promise<boolean> {
    const status = await this.check(service);
    if (!status.allowed) {
      console.warn(`[RateLimiter] ${service} daily limit reached (${status.used}/${status.limit})`);
      return false;
    }
    const today = todayKey();
    try {
      await db.execute(sql`
        INSERT INTO rate_limit_usage (id, service, date, count, "limit", reset_at)
        VALUES (gen_random_uuid(), ${service}, ${today}, ${amount}, ${DAILY_LIMITS[service]}, now() + interval '1 day')
        ON CONFLICT (service, date)
        DO UPDATE SET count = rate_limit_usage.count + ${amount}
      `);
    } catch {
      // Table may not have unique constraint yet — ignore
    }
    return true;
  },

  async getStatus(): Promise<Record<Service, { used: number; limit: number; remaining: number }>> {
    const result: any = {};
    for (const service of Object.keys(DAILY_LIMITS) as Service[]) {
      const s = await this.check(service);
      result[service] = { used: s.used, limit: s.limit, remaining: s.remaining };
    }
    return result;
  },
};

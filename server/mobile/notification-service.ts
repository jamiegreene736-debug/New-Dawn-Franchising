import {
  GENERIC_LOCK_SCREEN_NOTIFICATION,
  assertApprovedOfficialSource,
} from "@shared/mobile/notification-policy";

import {
  PostgresMobileNotificationRepository,
  type PublishMobileNotificationInput,
} from "./notification-repository";

type FetchLike = typeof fetch;

type ExpoTicketResponse = {
  data?: { status?: unknown; id?: unknown; message?: unknown };
};

export class ExpoMobilePushGateway {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly accessToken = process.env.EXPO_ACCESS_TOKEN?.trim() || null,
  ) {}

  async send(input: { expoPushToken: string; notificationId: string; deepLink: string }): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await this.fetchImpl("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify({
            to: input.expoPushToken,
            title: GENERIC_LOCK_SCREEN_NOTIFICATION.title,
            body: GENERIC_LOCK_SCREEN_NOTIFICATION.body,
            sound: "default",
            data: { notificationId: input.notificationId, deepLink: input.deepLink },
          }),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => ({})) as ExpoTicketResponse;
        if (response.ok && body.data?.status === "ok" && typeof body.data.id === "string") return;
        const message = typeof body.data?.message === "string" ? body.data.message : `HTTP ${response.status}`;
        throw new Error(`Expo push rejected: ${message}`);
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          const jitterMs = Math.floor(Math.random() * 250);
          await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1) + jitterMs));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Expo push delivery failed");
  }
}
export class MobileNotificationService {
  constructor(
    private readonly repository: PostgresMobileNotificationRepository,
    private readonly gateway: ExpoMobilePushGateway,
  ) {}

  async publish(input: PublishMobileNotificationInput): Promise<{
    notificationId: string;
    delivered: number;
    failed: number;
  }> {
    if (input.source || input.category === "embassy") {
      if (!input.source || !input.reviewedBy || !input.reviewedAt) {
        throw new Error("Government-source notifications require source provenance and human review");
      }
      assertApprovedOfficialSource({
        sourceUrl: input.source.url,
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt,
      });
    }

    const notificationId = await this.repository.publish(input);
    const targets = await this.repository.listEnabledPushTargets(input.identityId, input.category);
    const results = await Promise.allSettled(targets.map((target) => this.gateway.send({
      expoPushToken: target.expoPushToken,
      notificationId,
      deepLink: input.deepLink,
    })));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed > 0) {
      console.warn(JSON.stringify({
        event: "mobile.notification.delivery_partial_failure",
        notificationId,
        delivered: results.length - failed,
        failed,
      }));
    }
    return { notificationId, delivered: results.length - failed, failed };
  }
}

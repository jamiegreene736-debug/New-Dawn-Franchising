import { EventEmitter } from "events";

class NewDawnEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

export const eventBus = new NewDawnEventBus();

// ─── Typed event helpers ──────────────────────────────────────────────────────

export type SeoTaskCompletedPayload = {
  taskId: string; taskName: string; cadence: string; completedAt: Date; results: any;
};
export type SeoTaskFailedPayload = {
  taskId: string; taskName: string; error: string; failedAt: Date;
};
export type LeadCreatedPayload = {
  leadId: string; name: string; company: string; category: string; score: number; source: string;
};
export type LeadRepliedPayload = {
  leadId: string; channel: string; replyText: string; repliedAt: Date;
};
export type LeadIntentPositivePayload = {
  leadId: string; replyText: string; classifiedAt: Date;
};
export type LeadIntentObjectionPayload = {
  leadId: string; objectionType: string; replyText: string;
};
export type LeadOptedOutPayload = {
  leadId: string; channel: string; timestamp: Date;
};
export type VisitorHighIntentPayload = {
  fingerprint: string; pageUrl: string; visitCount: number; sessionId: string;
};
export type VisitorIdentifiedPayload = {
  leadId: string; fingerprint: string; sessionHistory: any[]; identifiedVia: string;
};
export type MeetingBookedPayload = {
  meetingId: string; leadId: string; scheduledAt: Date; calendlyEventId: string;
};
export type MeetingCancelledPayload = {
  meetingId: string; leadId: string; cancelledAt: Date;
};
export type ContentDraftCreatedPayload = {
  draftId: string; title: string; targetKeyword: string; triggerSource: string;
};

export type EventMap = {
  "seo:task:completed": SeoTaskCompletedPayload;
  "seo:task:failed": SeoTaskFailedPayload;
  "lead:created": LeadCreatedPayload;
  "lead:replied": LeadRepliedPayload;
  "lead:intent:positive": LeadIntentPositivePayload;
  "lead:intent:objection": LeadIntentObjectionPayload;
  "lead:opted_out": LeadOptedOutPayload;
  "visitor:high_intent": VisitorHighIntentPayload;
  "visitor:identified": VisitorIdentifiedPayload;
  "meeting:booked": MeetingBookedPayload;
  "meeting:cancelled": MeetingCancelledPayload;
  "content:draft:created": ContentDraftCreatedPayload;
};

export function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
  eventBus.emit(event, payload);
}

export function on<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void | Promise<void>
): void {
  eventBus.on(event, (payload: EventMap[K]) => {
    Promise.resolve(handler(payload)).catch(err =>
      console.error(`[EventBus] Unhandled error in handler for "${event}":`, err)
    );
  });
}

import { RuntimeConfig, runtimeConfig } from '@/config/runtime';

export type MobileRole = 'investor' | 'partner';
export type MobileLocale = 'en' | 'es';

export type MobileAccount = {
  id: string;
  email: string;
  roles: MobileRole[];
};

export type AuthenticatedSession = {
  status: 'authenticated';
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: 600;
  account: MobileAccount;
  requestId: string;
};

export type RegistrationResponse = {
  status: 'verification_required';
  testToken?: string;
  requestId: string;
};

export type VerificationResponse =
  | AuthenticatedSession
  | { status: 'pending_approval'; requestId: string };

export type PathwayMilestoneKey =
  | 'initial_readiness'
  | 'counsel_consultation'
  | 'business_model_review'
  | 'fdd_review'
  | 'territory_operating_plan'
  | 'entity_investment_business_plan'
  | 'visa_preparation'
  | 'launch_training';
export type PathwayMilestoneState =
  | 'not_started'
  | 'available'
  | 'your_action'
  | 'in_progress'
  | 'completed'
  | 'blocked';
export type PathwayOwner = 'investor' | 'new_dawn' | 'independent_counsel' | 'shared';
export type InvestorPathway = {
  pathwayVersion: string;
  completedMilestones: number;
  totalMilestones: number;
  milestones: {
    key: PathwayMilestoneKey;
    sequence: number;
    owner: PathwayOwner;
    state: PathwayMilestoneState;
    updatedAt: string;
  }[];
  requestId: string;
};

export type NotificationCategory =
  | 'next_action' | 'appointment' | 'fdd' | 'embassy' | 'expiration'
  | 'secure_status' | 'opportunity' | 'weekly_digest' | 'referral' | 'owner_operations';
export type ReminderKind =
  | 'appointment' | 'fdd_review' | 'passport_check' | 'visa_check' | 'i94_check' | 'business_deadline';
export type NotificationPreferences = {
  nextAction: boolean;
  appointments: boolean;
  fdd: boolean;
  embassy: boolean;
  expiration: boolean;
  secureStatus: boolean;
  opportunities: boolean;
  weeklyDigest: boolean;
  referrals: boolean;
  ownerOperations: boolean;
  followedEmbassyPost: string | null;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string;
};
export type PathNotification = {
  id: string;
  category: NotificationCategory;
  urgency: 'passive' | 'active' | 'time_sensitive';
  title: string;
  body: string;
  deepLink: string;
  source: { label: string; url: string; publishedAt: string | null } | null;
  availableAt: string;
  readAt: string | null;
  createdAt: string;
};
export type PathReminder = { id: string; kind: ReminderKind; eventAt: string; createdAt: string };

type ApiFault = {
  error?: {
    message?: unknown;
    retryable?: unknown;
    requestId?: unknown;
  };
};

export class AuthClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AuthClientError';
  }
}

export class MobileAuthClient {
  constructor(private readonly apiBaseUrl: string) {}

  async register(input: { email: string; password: string; role: MobileRole; locale: MobileLocale }) {
    return parseRegistration(await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }));
  }

  async verifyEmail(input: { token: string; deviceLabel?: string }) {
    return parseVerification(await this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(input),
    }));
  }

  async login(input: { email: string; password: string; deviceLabel?: string }) {
    return parseAuthenticated(await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }));
  }

  async refresh(refreshToken: string) {
    return parseAuthenticated(await this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }));
  }

  async logout(refreshToken: string): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async requestDeletion(accessToken: string): Promise<void> {
    await this.request('/deletion-request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async getInvestorPath(accessToken: string): Promise<InvestorPathway> {
    return parseInvestorPath(await this.request('/investor/path', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }));
  }

  async getNotificationPreferences(accessToken: string): Promise<NotificationPreferences> {
    return parseNotificationPreferences(await this.request('/notification-preferences', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }));
  }

  async updateNotificationPreferences(
    accessToken: string,
    preferences: Omit<NotificationPreferences, 'updatedAt'>,
  ): Promise<NotificationPreferences> {
    return parseNotificationPreferences(await this.request('/notification-preferences', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(preferences),
    }));
  }

  async registerNotificationDevice(accessToken: string, input: {
    expoPushToken: string;
    platform: 'ios' | 'android';
    deviceLabel?: string;
    locale: MobileLocale;
  }): Promise<string> {
    const value = await this.request('/notification-devices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(input),
    });
    if (!isRecord(value) || value.status !== 'registered' || typeof value.id !== 'string') throw unexpectedResponse();
    return value.id;
  }

  async getNotifications(accessToken: string): Promise<PathNotification[]> {
    const value = await this.request('/notifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!isRecord(value) || !Array.isArray(value.notifications)) throw unexpectedResponse();
    return value.notifications.map(parsePathNotification);
  }

  async markNotificationRead(accessToken: string, notificationId: string): Promise<void> {
    await this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async getReminders(accessToken: string): Promise<PathReminder[]> {
    const value = await this.request('/notification-reminders', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!isRecord(value) || !Array.isArray(value.reminders)) throw unexpectedResponse();
    return value.reminders.map(parseReminder);
  }

  async createReminder(accessToken: string, kind: ReminderKind, eventAt: string): Promise<PathReminder> {
    return parseReminder(await this.request('/notification-reminders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ kind, eventAt }),
    }));
  }

  async cancelReminder(accessToken: string, reminderId: string): Promise<void> {
    await this.request(`/notification-reminders/${encodeURIComponent(reminderId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/mobile/v1${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw apiFault(body, response.status >= 500);
      return body;
    } catch (error) {
      if (error instanceof AuthClientError) throw error;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new AuthClientError(
        timedOut ? 'The request timed out. Please try again.' : 'Unable to reach New Dawn services.',
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readAccount(value: unknown): MobileAccount | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.email !== 'string') return null;
  if (!Array.isArray(value.roles) || !value.roles.every((role) => role === 'investor' || role === 'partner')) return null;
  return { id: value.id, email: value.email, roles: value.roles };
}

function parseAuthenticated(value: unknown): AuthenticatedSession {
  if (!isRecord(value) || value.status !== 'authenticated') throw unexpectedResponse();
  const account = readAccount(value.account);
  if (
    !account
    || typeof value.accessToken !== 'string'
    || typeof value.refreshToken !== 'string'
    || value.accessTokenExpiresInSeconds !== 600
    || typeof value.requestId !== 'string'
  ) throw unexpectedResponse();
  return {
    status: 'authenticated',
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    accessTokenExpiresInSeconds: 600,
    account,
    requestId: value.requestId,
  };
}

function parseRegistration(value: unknown): RegistrationResponse {
  if (!isRecord(value) || value.status !== 'verification_required' || typeof value.requestId !== 'string') {
    throw unexpectedResponse();
  }
  if (value.testToken !== undefined && typeof value.testToken !== 'string') throw unexpectedResponse();
  return {
    status: 'verification_required',
    requestId: value.requestId,
    ...(typeof value.testToken === 'string' ? { testToken: value.testToken } : {}),
  };
}

function parseVerification(value: unknown): VerificationResponse {
  if (isRecord(value) && value.status === 'pending_approval' && typeof value.requestId === 'string') {
    return { status: 'pending_approval', requestId: value.requestId };
  }
  return parseAuthenticated(value);
}

const PATHWAY_KEYS: readonly PathwayMilestoneKey[] = [
  'initial_readiness',
  'counsel_consultation',
  'business_model_review',
  'fdd_review',
  'territory_operating_plan',
  'entity_investment_business_plan',
  'visa_preparation',
  'launch_training',
];
const PATHWAY_STATES: readonly PathwayMilestoneState[] = [
  'not_started', 'available', 'your_action', 'in_progress', 'completed', 'blocked',
];
const PATHWAY_OWNERS: readonly PathwayOwner[] = [
  'investor', 'new_dawn', 'independent_counsel', 'shared',
];

function parseInvestorPath(value: unknown): InvestorPathway {
  if (
    !isRecord(value)
    || typeof value.pathwayVersion !== 'string'
    || typeof value.completedMilestones !== 'number'
    || typeof value.totalMilestones !== 'number'
    || typeof value.requestId !== 'string'
    || !Array.isArray(value.milestones)
  ) throw unexpectedResponse();

  const milestones = value.milestones.map((milestone) => {
    if (
      !isRecord(milestone)
      || typeof milestone.key !== 'string'
      || !PATHWAY_KEYS.includes(milestone.key as PathwayMilestoneKey)
      || typeof milestone.sequence !== 'number'
      || typeof milestone.owner !== 'string'
      || !PATHWAY_OWNERS.includes(milestone.owner as PathwayOwner)
      || typeof milestone.state !== 'string'
      || !PATHWAY_STATES.includes(milestone.state as PathwayMilestoneState)
      || typeof milestone.updatedAt !== 'string'
    ) throw unexpectedResponse();
    return {
      key: milestone.key as PathwayMilestoneKey,
      sequence: milestone.sequence,
      owner: milestone.owner as PathwayOwner,
      state: milestone.state as PathwayMilestoneState,
      updatedAt: milestone.updatedAt,
    };
  });

  if (value.totalMilestones !== milestones.length) throw unexpectedResponse();
  return {
    pathwayVersion: value.pathwayVersion,
    completedMilestones: value.completedMilestones,
    totalMilestones: value.totalMilestones,
    milestones,
    requestId: value.requestId,
  };
}

const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'next_action', 'appointment', 'fdd', 'embassy', 'expiration', 'secure_status',
  'opportunity', 'weekly_digest', 'referral', 'owner_operations',
];

function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) throw unexpectedResponse();
  const booleanKeys = [
    'nextAction', 'appointments', 'fdd', 'embassy', 'expiration', 'secureStatus',
    'opportunities', 'weeklyDigest', 'referrals', 'ownerOperations',
  ] as const;
  if (!booleanKeys.every((key) => typeof value[key] === 'boolean')) throw unexpectedResponse();
  if (
    (value.followedEmbassyPost !== null && typeof value.followedEmbassyPost !== 'string')
    || typeof value.timezone !== 'string'
    || (value.quietHoursStart !== null && typeof value.quietHoursStart !== 'string')
    || (value.quietHoursEnd !== null && typeof value.quietHoursEnd !== 'string')
    || typeof value.updatedAt !== 'string'
  ) throw unexpectedResponse();
  return value as NotificationPreferences;
}

function parsePathNotification(value: unknown): PathNotification {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.category !== 'string'
    || !NOTIFICATION_CATEGORIES.includes(value.category as NotificationCategory)
    || (value.urgency !== 'passive' && value.urgency !== 'active' && value.urgency !== 'time_sensitive')
    || typeof value.title !== 'string'
    || typeof value.body !== 'string'
    || typeof value.deepLink !== 'string'
    || typeof value.availableAt !== 'string'
    || (value.readAt !== null && typeof value.readAt !== 'string')
    || typeof value.createdAt !== 'string'
  ) throw unexpectedResponse();
  let source: PathNotification['source'] = null;
  if (value.source !== null) {
    if (!isRecord(value.source) || typeof value.source.label !== 'string' || typeof value.source.url !== 'string') {
      throw unexpectedResponse();
    }
    if (value.source.publishedAt !== null && typeof value.source.publishedAt !== 'string') throw unexpectedResponse();
    source = {
      label: value.source.label,
      url: value.source.url,
      publishedAt: value.source.publishedAt as string | null,
    };
  }
  return {
    id: value.id,
    category: value.category as NotificationCategory,
    urgency: value.urgency,
    title: value.title,
    body: value.body,
    deepLink: value.deepLink,
    source,
    availableAt: value.availableAt,
    readAt: value.readAt as string | null,
    createdAt: value.createdAt,
  };
}

const REMINDER_KINDS: readonly ReminderKind[] = [
  'appointment', 'fdd_review', 'passport_check', 'visa_check', 'i94_check', 'business_deadline',
];

function parseReminder(value: unknown): PathReminder {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.kind !== 'string'
    || !REMINDER_KINDS.includes(value.kind as ReminderKind)
    || typeof value.eventAt !== 'string'
    || typeof value.createdAt !== 'string'
  ) throw unexpectedResponse();
  return { id: value.id, kind: value.kind as ReminderKind, eventAt: value.eventAt, createdAt: value.createdAt };
}

function unexpectedResponse(): AuthClientError {
  return new AuthClientError('The service returned an unexpected response.', false);
}

function apiFault(value: unknown, retryableFallback: boolean): AuthClientError {
  const fault = value && typeof value === 'object' ? value as ApiFault : null;
  const message = typeof fault?.error?.message === 'string'
    ? fault.error.message
    : 'New Dawn services are temporarily unavailable.';
  const requestId = typeof fault?.error?.requestId === 'string' ? fault.error.requestId : undefined;
  const retryable = typeof fault?.error?.retryable === 'boolean'
    ? fault.error.retryable
    : retryableFallback;
  return new AuthClientError(message, retryable, requestId);
}

export function createMobileAuthClient(config: RuntimeConfig): MobileAuthClient | null {
  return config.mode === 'connected' && config.apiBaseUrl
    ? new MobileAuthClient(config.apiBaseUrl)
    : null;
}

export const mobileAuthClient = createMobileAuthClient(runtimeConfig);

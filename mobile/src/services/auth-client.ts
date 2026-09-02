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

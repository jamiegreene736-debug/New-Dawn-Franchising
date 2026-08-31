import { RuntimeConfig, runtimeConfig } from '@/config/runtime';

export type MobileStatus = {
  apiVersion: 'v1';
  availability: 'prelaunch' | 'pilot' | 'available';
  minimumAppVersion: string;
  requestId: string;
};

export class MobileGatewayError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'MobileGatewayError';
  }
}

export interface MobileGateway {
  getStatus(): Promise<MobileStatus>;
}

export function isMobileStatus(value: unknown): value is MobileStatus {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return candidate.apiVersion === 'v1'
    && ['prelaunch', 'pilot', 'available'].includes(String(candidate.availability))
    && typeof candidate.minimumAppVersion === 'string'
    && /^\d+\.\d+\.\d+$/.test(candidate.minimumAppVersion)
    && typeof candidate.requestId === 'string'
    && candidate.requestId.length > 0
    && candidate.requestId.length <= 128;
}

class PrototypeMobileGateway implements MobileGateway {
  async getStatus(): Promise<MobileStatus> {
    return {
      apiVersion: 'v1',
      availability: 'prelaunch',
      minimumAppVersion: '1.0.0',
      requestId: `prototype-${Date.now()}`,
    };
  }
}

class ConnectedMobileGateway implements MobileGateway {
  constructor(private readonly apiBaseUrl: string) {}

  async getStatus(): Promise<MobileStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/mobile/v1/status`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        throw new MobileGatewayError('New Dawn services are temporarily unavailable.', response.status >= 500);
      }

      if (!isMobileStatus(body)) {
        throw new MobileGatewayError('The service returned an unexpected response.', false);
      }

      return body;
    } catch (error) {
      if (error instanceof MobileGatewayError) throw error;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new MobileGatewayError(
        timedOut ? 'The request timed out. Please try again.' : 'Unable to reach New Dawn services.',
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createMobileGateway(config: RuntimeConfig): MobileGateway {
  if (config.mode === 'prototype') return new PrototypeMobileGateway();
  if (!config.apiBaseUrl) throw new Error('Connected mode requires an API base URL');
  return new ConnectedMobileGateway(config.apiBaseUrl);
}

export const mobileGateway = createMobileGateway(runtimeConfig);

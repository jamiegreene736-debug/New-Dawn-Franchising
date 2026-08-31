export type AppMode = 'prototype' | 'connected';

type RuntimeValues = {
  appMode?: string;
  apiBaseUrl?: string;
};

export type RuntimeConfig = {
  mode: AppMode;
  apiBaseUrl: string | null;
};

export function createRuntimeConfig(values: RuntimeValues): RuntimeConfig {
  const rawMode = values.appMode?.trim() || 'prototype';

  if (rawMode !== 'prototype' && rawMode !== 'connected') {
    throw new Error('EXPO_PUBLIC_APP_MODE must be either prototype or connected');
  }

  const apiBaseUrl = values.apiBaseUrl?.trim().replace(/\/$/, '') || null;

  if (rawMode === 'connected' && !apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required in connected mode');
  }

  return { mode: rawMode, apiBaseUrl };
}

export const runtimeConfig = createRuntimeConfig({
  appMode: process.env.EXPO_PUBLIC_APP_MODE,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
});

import type { Platform } from 'react-native';

export type RuntimePlatform = Extract<Platform['OS'], 'web' | 'ios' | 'android'> | 'native';
export type RuntimeMode = 'demo' | 'remote';

export type RuntimeConfig = {
  mode: RuntimeMode;
  /** null means same-origin on web, or an unavailable native endpoint. */
  baseUrl: string | null;
  error?: string;
};

export function getRuntimeConfig(input: {
  demoMode?: string;
  apiUrl?: string;
  platform: RuntimePlatform;
}): RuntimeConfig {
  if (input.demoMode !== 'false') return { mode: 'demo', baseUrl: null };
  if (input.platform === 'web') return { mode: 'remote', baseUrl: null };

  const apiUrl = input.apiUrl?.trim().replace(/\/$/, '');
  if (!apiUrl) {
    return {
      mode: 'remote',
      baseUrl: null,
      error: 'API для native-приложения не настроен',
    };
  }
  return { mode: 'remote', baseUrl: apiUrl };
}

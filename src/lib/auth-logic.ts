import type { Session } from '../types/social.ts';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './validation';

export type OAuthPlatform = 'web' | 'native';
export type RuntimeMode = 'demo' | 'remote';

export type SupabaseAuthRedirect = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  type?: string;
  error?: string;
  errorCode?: string;
};

export function normalizePlatform(value: unknown): OAuthPlatform {
  return value === 'native' ? 'native' : 'web';
}

export function validateNewPassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `Пароль должен содержать от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов`,
    );
  }
  return password;
}

export function authCallbackUrl(platform: OAuthPlatform, handoff: string) {
  const encoded = encodeURIComponent(handoff);
  return platform === 'native'
    ? `bailanysta://auth/callback?handoff=${encoded}`
    : `/auth/callback?handoff=${encoded}`;
}

export function parseSupabaseAuthRedirect(url: string): SupabaseAuthRedirect {
  const parsed = new URL(url);
  const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const params = new URLSearchParams(fragment || parsed.search);
  const expiresAtValue = Number(params.get('expires_at'));

  return {
    ...(params.get('access_token') ? { accessToken: params.get('access_token')! } : {}),
    ...(params.get('refresh_token') ? { refreshToken: params.get('refresh_token')! } : {}),
    ...(Number.isFinite(expiresAtValue) && expiresAtValue > 0 ? { expiresAt: expiresAtValue } : {}),
    ...(params.get('type') ? { type: params.get('type')! } : {}),
    ...(params.get('error_description') || params.get('error')
      ? { error: params.get('error_description') || params.get('error')! }
      : {}),
    ...(params.get('error_code') ? { errorCode: params.get('error_code')! } : {}),
  };
}

export function sessionStorageKey(mode: RuntimeMode) {
  return `bailanysta-session-${mode}`;
}

export function isSessionForMode(value: unknown, mode: RuntimeMode): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Session> & { user?: unknown };
  return Boolean(
    candidate.runtime === mode &&
      typeof candidate.accessToken === 'string' &&
      candidate.accessToken.length > 0 &&
      candidate.user &&
      typeof candidate.user === 'object' &&
      typeof (candidate.user as { id?: unknown }).id === 'string',
  );
}

export function profileDraftFromAuth(input: {
  id: string;
  email?: string | null;
  name?: string | null;
  fullName?: string | null;
}) {
  const emailName = input.email?.split('@')[0]?.trim() ?? '';
  const rawName = [input.name, input.fullName, emailName].find((value) => value?.trim())?.trim() ?? '';
  const name = rawName.length >= 2 ? rawName.slice(0, 60) : 'Участник';
  const base = (input.name || input.fullName || emailName || 'member')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 24);
  const safeBase = base.length >= 3 ? base : 'member';
  const suffix = input.id.replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase() || 'user1';
  return { name, handle: `${safeBase}_${suffix}`, bio: '' };
}

import type { OAuthPlatform } from './auth-logic.ts';

export function buildGoogleAuthorizeUrl(input: {
  callbackOrigin: string;
  attempt: string;
  platform: OAuthPlatform;
  supabaseOrigin: string;
  challenge: string;
}) {
  const callback = new URL('/api/auth/google/callback', `${input.callbackOrigin.replace(/\/$/, '')}/`);
  callback.searchParams.set('platform', input.platform);
  callback.searchParams.set('attempt', input.attempt);

  const authorize = new URL('/auth/v1/authorize', `${input.supabaseOrigin.replace(/\/$/, '')}/`);
  authorize.searchParams.set('provider', 'google');
  authorize.searchParams.set('redirect_to', callback.toString());
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('code_challenge', input.challenge);
  authorize.searchParams.set('code_challenge_method', 's256');
  authorize.searchParams.set('scope', 'openid email profile');
  return { callback: callback.toString(), url: authorize.toString() };
}

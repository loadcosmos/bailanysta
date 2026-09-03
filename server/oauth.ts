import { createHash, randomBytes } from 'node:crypto';

import { normalizePlatform, type OAuthPlatform } from '../src/lib/auth-logic';
import { buildGoogleAuthorizeUrl } from '../src/lib/oauth';
import type { Session } from '../src/types/social';
import { authCallbackUrl as callbackUrl } from '../src/lib/auth-logic';
import { database, ensureProfile, privilegedDatabase, publishableKey, supabaseUrl } from './supabase';

export function publicUrl() {
  const configured = process.env.AUTH_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:8081';
}

export function authErrorUrl(platform: OAuthPlatform, message: string) {
  if (platform === 'native') {
    return `bailanysta://auth/callback?error=${encodeURIComponent(message)}`;
  }
  return `${publicUrl()}/auth?error=${encodeURIComponent(message)}`;
}

function hashState(state: string) {
  return createHash('sha256').update(state).digest('hex');
}

function jwtExpiresAt(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof parsed.exp === 'number' ? parsed.exp : undefined;
  } catch {
    return undefined;
  }
}

function sessionPayload(
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  },
  user: Session['user'],
): Session {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    provider: 'google',
    runtime: 'remote',
    user,
  };
}

export async function createGoogleStart(rawPlatform: unknown) {
  const platform = normalizePlatform(rawPlatform);
  const attempt = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const db = privilegedDatabase();

  await db.from('auth_oauth_attempts').delete().lt('expires_at', new Date().toISOString());
  await db.from('auth_handoffs').delete().lt('expires_at', new Date().toISOString());
  const { error } = await db.from('auth_oauth_attempts').insert({
    state_hash: hashState(attempt),
    code_verifier: verifier,
    platform,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw error;

  return {
    platform,
    url: buildGoogleAuthorizeUrl({
      callbackOrigin: publicUrl(),
      attempt,
      platform,
      supabaseOrigin: supabaseUrl(),
      challenge,
    }).url,
  };
}

async function exchangeCode(code: string, verifier: string) {
  const response = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: { apikey: publishableKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    user?: { id: string };
    error_description?: string;
    msg?: string;
  };
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(data.error_description || data.msg || 'Google не вернул сессию');
  }
  return data;
}

export async function finishGoogleCallback(input: { code: string; attempt: string; platform: OAuthPlatform }) {
  const db = privilegedDatabase();
  const { data: attempt, error: lookupError } = await db
    .from('auth_oauth_attempts')
    .select('state_hash,code_verifier,platform,expires_at')
    .eq('state_hash', hashState(input.attempt))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!attempt || attempt.platform !== input.platform)
    throw new Error('OAuth state истёк или недействителен');

  const token = await exchangeCode(input.code, attempt.code_verifier);
  await db.from('auth_oauth_attempts').delete().eq('state_hash', attempt.state_hash);

  const { data: handoff, error: handoffError } = await db
    .from('auth_handoffs')
    .insert({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (handoffError) throw handoffError;

  return { platform: input.platform, location: callbackUrl(input.platform, handoff.id) };
}

export async function consumeHandoff(id: string) {
  const db = privilegedDatabase();
  const { data, error } = await db
    .from('auth_handoffs')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('access_token,refresh_token')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Ссылка входа уже использована или истекла');

  const client = database(data.access_token);
  const { data: authUser, error: userError } = await client.auth.getUser(data.access_token);
  if (userError || !authUser.user) throw new Error('Не удалось подтвердить Google-сессию');
  const user = await ensureProfile(authUser.user, client);
  if (user.status === 'blocked') throw new Error('Аккаунт заблокирован администратором');
  return sessionPayload(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: jwtExpiresAt(data.access_token),
    },
    user,
  );
}

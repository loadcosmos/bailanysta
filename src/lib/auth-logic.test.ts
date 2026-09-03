import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authCallbackUrl,
  isSessionForMode,
  normalizePlatform,
  parseSupabaseAuthRedirect,
  profileDraftFromAuth,
  sessionStorageKey,
  validateNewPassword,
} from './auth-logic.ts';

test('normalizePlatform only accepts known OAuth clients', () => {
  assert.equal(normalizePlatform('native'), 'native');
  assert.equal(normalizePlatform('web'), 'web');
  assert.equal(normalizePlatform('desktop'), 'web');
});

test('validateNewPassword applies the same limit as sign in', () => {
  assert.equal(validateNewPassword('secret1'), 'secret1');
  assert.throws(() => validateNewPassword('12345'), /6/);
  assert.throws(() => validateNewPassword('a'.repeat(73)), /72/);
});

test('authCallbackUrl keeps the handoff out of a provider access token URL', () => {
  assert.equal(authCallbackUrl('native', 'one-time-id'), 'bailanysta://auth/callback?handoff=one-time-id');
  assert.equal(authCallbackUrl('web', 'one-time-id'), '/auth/callback?handoff=one-time-id');
});

test('parseSupabaseAuthRedirect reads an email confirmation session from the URL fragment', () => {
  assert.deepEqual(
    parseSupabaseAuthRedirect(
      'https://bailanysta-ruby.vercel.app/#access_token=access-123&refresh_token=refresh-123&expires_at=1788340000&expires_in=3600&type=signup',
    ),
    {
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      expiresAt: 1788340000,
      type: 'signup',
    },
  );
});

test('parseSupabaseAuthRedirect exposes a readable error for an expired email link', () => {
  assert.deepEqual(
    parseSupabaseAuthRedirect(
      'https://bailanysta-ruby.vercel.app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    ),
    {
      error: 'Email link is invalid or has expired',
      errorCode: 'otp_expired',
    },
  );
});

test('session storage is isolated between demo and remote runtimes', () => {
  assert.equal(sessionStorageKey('demo'), 'bailanysta-session-demo');
  assert.equal(sessionStorageKey('remote'), 'bailanysta-session-remote');

  const session = {
    accessToken: 'token',
    runtime: 'remote' as const,
    user: { id: 'user-1', name: 'User', handle: 'user_1', bio: '' },
  };
  assert.equal(isSessionForMode(session, 'remote'), true);
  assert.equal(isSessionForMode(session, 'demo'), false);
  assert.equal(isSessionForMode({ ...session, runtime: undefined }, 'remote'), false);
});

test('profile defaults keep short auth metadata valid and produce a stable handle', () => {
  assert.deepEqual(
    profileDraftFromAuth({ id: '12345678-aaaa-bbbb-cccc-ddddeeeeffff', email: 'a@example.com' }),
    { name: 'Участник', handle: 'member_12345', bio: '' },
  );

  assert.deepEqual(
    profileDraftFromAuth({
      id: '12345678-aaaa-bbbb-cccc-ddddeeeeffff',
      email: 'person@example.com',
      name: 'Ada Lovelace',
    }),
    { name: 'Ada Lovelace', handle: 'adalovelace_12345', bio: '' },
  );
});

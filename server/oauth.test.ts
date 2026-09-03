import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGoogleAuthorizeUrl } from '../src/lib/oauth.ts';

test('Google authorize URL keeps the app attempt in the callback URL', () => {
  const result = buildGoogleAuthorizeUrl({
    callbackOrigin: 'https://bailanysta.example.com',
    attempt: 'app-attempt-123',
    platform: 'web',
    supabaseOrigin: 'https://project.supabase.co',
    challenge: 'pkce-challenge',
  });
  const authorize = new URL(result.url);
  const redirectTo = new URL(authorize.searchParams.get('redirect_to') ?? '');

  assert.equal(authorize.searchParams.get('state'), null);
  assert.equal(redirectTo.searchParams.get('attempt'), 'app-attempt-123');
  assert.equal(redirectTo.searchParams.get('state'), null);
  assert.equal(redirectTo.searchParams.get('platform'), 'web');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { revokeSession, updateUserPassword } from '../../server/supabase.ts';

test('revokeSession sends the bearer token to Supabase logout', async () => {
  let call: unknown[] = [];
  const client = {
    auth: {
      admin: {
        signOut: async (...args: unknown[]) => {
          call = args;
          return { data: null, error: null };
        },
      },
    },
  };

  await revokeSession('access-token', client as never);

  assert.deepEqual(call, ['access-token', 'global']);
});

test('updateUserPassword sends a validated password to the owning Supabase user', async () => {
  let call: unknown[] = [];
  const client = {
    auth: {
      admin: {
        updateUserById: async (...args: unknown[]) => {
          call = args;
          return { data: { user: { id: 'user-1' } }, error: null };
        },
      },
    },
  };

  await updateUserPassword('user-1', 'new-password', client as never);

  assert.deepEqual(call, ['user-1', { password: 'new-password' }]);
});

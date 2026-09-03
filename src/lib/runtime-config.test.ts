import assert from 'node:assert/strict';
import test from 'node:test';

import { getRuntimeConfig } from './runtime-config.ts';

test('demo mode is explicit by default and never needs an API URL', () => {
  assert.deepEqual(
    getRuntimeConfig({ demoMode: undefined, apiUrl: undefined, platform: 'native' }),
    { mode: 'demo', baseUrl: null },
  );
  assert.deepEqual(
    getRuntimeConfig({ demoMode: 'true', apiUrl: 'https://api.example.com', platform: 'web' }),
    { mode: 'demo', baseUrl: null },
  );
});

test('remote web mode uses same-origin routes', () => {
  assert.deepEqual(
    getRuntimeConfig({ demoMode: 'false', apiUrl: undefined, platform: 'web' }),
    { mode: 'remote', baseUrl: null },
  );
});

test('remote native mode fails closed when the API URL is missing', () => {
  assert.deepEqual(
    getRuntimeConfig({ demoMode: 'false', apiUrl: undefined, platform: 'native' }),
    {
      mode: 'remote',
      baseUrl: null,
      error: 'API для native-приложения не настроен',
    },
  );
});

test('remote native mode trims the configured API URL', () => {
  assert.deepEqual(
    getRuntimeConfig({ demoMode: 'false', apiUrl: ' https://api.example.com/ ', platform: 'native' }),
    { mode: 'remote', baseUrl: 'https://api.example.com' },
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { allowMobile, fail, HttpError, optionalBearerToken } from './http.ts';

function responseStub() {
  const headers = new Map<string, string>();
  const calls: { status?: number; body?: unknown } = {};
  return {
    headers,
    calls,
    response: {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      status(code: number) {
        calls.status = code;
        return this;
      },
      json(body: unknown) {
        calls.body = body;
        return this;
      },
      end() {
        return this;
      },
    },
  };
}

test('API responses are never cached, including OAuth state responses', () => {
  const stub = responseStub();

  allowMobile(stub.response, 'GET, OPTIONS');

  assert.equal(stub.headers.get('Cache-Control'), 'no-store');
  assert.equal(stub.headers.get('Access-Control-Allow-Origin'), '*');
});

test('auth failures keep a safe status and message', () => {
  const stub = responseStub();

  fail(stub.response, new Error('Сессия закончилась. Войдите снова'));
  assert.equal(stub.calls.status, 401);
  assert.deepEqual(stub.calls.body, {
    error: 'Сессия закончилась. Войдите снова',
    code: 'SESSION_EXPIRED',
  });
});

test('missing authentication is reported as 401 instead of invalid input', () => {
  const stub = responseStub();

  fail(stub.response, new Error('Нужно войти в аккаунт'));
  assert.equal(stub.calls.status, 401);
  assert.deepEqual(stub.calls.body, { error: 'Нужно войти в аккаунт', code: 'AUTH_REQUIRED' });
});

test('optional bearer token parsing is strict and reusable', () => {
  assert.equal(optionalBearerToken({ authorization: 'Bearer access-token' }), 'access-token');
  assert.equal(optionalBearerToken({ authorization: 'Bearer   access-token  ' }), 'access-token');
  assert.equal(optionalBearerToken({ authorization: 'Basic access-token' }), undefined);
  assert.equal(optionalBearerToken({ authorization: 'Bearer ' }), undefined);
  assert.equal(optionalBearerToken({}), undefined);
});

test('configuration failures do not expose server variable names', () => {
  const stub = responseStub();

  fail(stub.response, new Error('SUPABASE_SECRET_KEY is not configured'));
  assert.equal(stub.calls.status, 503);
  assert.deepEqual(stub.calls.body, { error: 'Сервис авторизации пока не настроен', code: 'CONFIGURATION' });
});

test('typed API errors preserve a stable status and machine-readable code', () => {
  const stub = responseStub();

  fail(stub.response, new HttpError('Пользователь недоступен', 403, 'FORBIDDEN'));
  assert.equal(stub.calls.status, 403);
  assert.deepEqual(stub.calls.body, { error: 'Пользователь недоступен', code: 'FORBIDDEN' });
});

test('database constraint failures become safe conflict responses', () => {
  const stub = responseStub();

  fail(stub.response, {
    message: 'duplicate key value violates unique constraint profiles_handle_key',
    code: '23505',
  });

  assert.equal(stub.calls.status, 409);
  assert.deepEqual(stub.calls.body, { error: 'Такой объект уже существует', code: 'CONFLICT' });
});

test('unknown database failures do not expose SQL details', () => {
  const stub = responseStub();

  fail(stub.response, {
    message: 'relation private.secret_table does not exist',
    code: '42P01',
  });

  assert.equal(stub.calls.status, 500);
  assert.deepEqual(stub.calls.body, { error: 'Не удалось выполнить запрос', code: 'INTERNAL' });
});

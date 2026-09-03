import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  POST_BODY_MAX,
  POST_BODY_MIN,
  parsePostDraft,
  validatePasswordPair,
  validateCredentials,
  validateProfileDraft,
} from './validation.ts';

test('validateCredentials trims email and rejects short passwords', () => {
  assert.deepEqual(validateCredentials('  person@example.com ', 'secret1'), {
    email: 'person@example.com',
    password: 'secret1',
  });
  assert.throws(() => validateCredentials('person@example.com', '12345'), /6/);
});

test('password requirements stay aligned with the auth form limits', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 6);
  assert.equal(PASSWORD_MAX_LENGTH, 72);
  assert.deepEqual(validateCredentials('person@example.com', 'x'.repeat(PASSWORD_MAX_LENGTH)), {
    email: 'person@example.com',
    password: 'x'.repeat(PASSWORD_MAX_LENGTH),
  });
  assert.throws(
    () => validateCredentials('person@example.com', 'x'.repeat(PASSWORD_MAX_LENGTH + 1)),
    /от 6 до 72/,
  );
});

test('password reset validation uses shared limits and requires matching confirmation', () => {
  assert.deepEqual(validatePasswordPair('secret1', 'secret1'), { ok: true });
  assert.deepEqual(validatePasswordPair('12345', '12345'), { ok: false, reason: 'length' });
  assert.deepEqual(validatePasswordPair('x'.repeat(73), 'x'.repeat(73)), { ok: false, reason: 'length' });
  assert.deepEqual(validatePasswordPair('secret1', 'different'), { ok: false, reason: 'mismatch' });
});

test('parsePostDraft rejects unknown signal values and normalizes tags', () => {
  assert.deepEqual(
    parsePostDraft({
      type: 'insight',
      topic: 'AI',
      body: '  Маленький шаг каждый день  ',
      tags: ['AI', ' ai ', 4, ''],
      link: ' https://example.com ',
    }),
    {
      type: 'insight',
      topic: 'AI',
      body: 'Маленький шаг каждый день',
      tags: ['AI', 'ai', '4'],
      link: 'https://example.com',
    },
  );
  assert.throws(() => parsePostDraft({ type: 'unknown', topic: 'AI', body: 'valid body' }), /тип/);
});

test('post body limits are shared by API and editor contracts', () => {
  assert.equal(POST_BODY_MIN, 5);
  assert.equal(POST_BODY_MAX, 1200);
  assert.throws(
    () => parsePostDraft({ type: 'insight', topic: 'AI', body: '1234' }),
    /от 5 до 1200/,
  );
  assert.throws(
    () => parsePostDraft({ type: 'insight', topic: 'AI', body: 'x'.repeat(1201) }),
    /от 5 до 1200/,
  );
});

test('validateProfileDraft keeps public fields inside database limits', () => {
  assert.deepEqual(validateProfileDraft({ name: 'Ailin', handle: 'ailin_1', bio: 'Делаю заметки' }), {
    name: 'Ailin',
    handle: 'ailin_1',
    bio: 'Делаю заметки',
  });
  assert.throws(() => validateProfileDraft({ name: 'A', handle: 'bad handle', bio: '' }), /профиль/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseModerationRequest } from './moderation.ts';

const id = '11111111-1111-4111-8111-111111111111';

test('moderation request accepts only actions supported by the target type', () => {
  assert.deepEqual(parseModerationRequest({ action: 'hide', targetType: 'post', targetId: id }), {
    action: 'hide',
    targetType: 'post',
    targetId: id,
  });
  assert.throws(
    () => parseModerationRequest({ action: 'hide', targetType: 'user', targetId: id }),
    /Операция недоступна для пользователя/,
  );
  assert.throws(
    () => parseModerationRequest({ action: 'block', targetType: 'post', targetId: id }),
    /Операция недоступна для публикации/,
  );
});

test('moderation request rejects missing and malformed identifiers', () => {
  assert.throws(
    () => parseModerationRequest({ action: 'delete', targetType: 'comment', targetId: 'not-an-id' }),
    /Некорректный идентификатор/,
  );
  assert.throws(
    () => parseModerationRequest({ action: 'remove', targetType: 'post', targetId: id }),
    /Некорректная операция модерации/,
  );
});

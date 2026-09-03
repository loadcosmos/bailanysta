import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authSubmitLabel, guestProfileLabel, profileCreateLabel } from './ui-copy.ts';

test('auth signup is labelled as account creation, not profile creation', () => {
  assert.equal(authSubmitLabel('ru', 'signup'), 'Создать аккаунт');
  assert.equal(authSubmitLabel('kk', 'signup'), 'Тіркелу');
});

test('guest profile action explains that sign in or registration is required', () => {
  assert.equal(guestProfileLabel('ru'), 'Войти или зарегистрироваться');
  assert.equal(guestProfileLabel('kk'), 'Кіру немесе тіркелу');
});

test('authenticated profile has a direct create-signal CTA', () => {
  assert.equal(profileCreateLabel('ru'), 'Создать сигнал');
  assert.equal(profileCreateLabel('kk'), 'Сигнал жасау');
});

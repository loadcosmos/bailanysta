import type { Locale } from './app-logic';

export type AuthMode = 'signin' | 'signup' | 'forgot';

export function authSubmitLabel(locale: Locale, mode: AuthMode) {
  if (mode === 'forgot') return locale === 'kk' ? 'Сілтеме жіберу' : 'Отправить ссылку';
  if (mode === 'signin') return locale === 'kk' ? 'Кіру' : 'Войти';
  return locale === 'kk' ? 'Тіркелу' : 'Создать аккаунт';
}

export function guestProfileLabel(locale: Locale) {
  return locale === 'kk' ? 'Кіру немесе тіркелу' : 'Войти или зарегистрироваться';
}

export function profileCreateLabel(locale: Locale) {
  return locale === 'kk' ? 'Сигнал жасау' : 'Создать сигнал';
}

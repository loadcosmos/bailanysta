import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useApp } from '@/context/app-context';
import { parseSupabaseAuthRedirect } from '@/lib/auth-logic';

function readAuthRedirect() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || window.location.pathname !== '/') return undefined;
  const redirect = parseSupabaseAuthRedirect(window.location.href);
  return redirect.accessToken || redirect.error ? redirect : undefined;
}

function authRedirectMessage(redirect: ReturnType<typeof parseSupabaseAuthRedirect>) {
  if (redirect.errorCode === 'otp_expired') {
    return 'Ссылка подтверждения email уже использована или истекла. Выберите «Вход» и войдите в аккаунт.';
  }
  if (redirect.error) return redirect.error;
  return 'Не удалось завершить подтверждение email. Выберите «Вход» и войдите в аккаунт.';
}

export default function StartScreen() {
  const router = useRouter();
  const { onboarded, session } = useApp();
  const [authRedirect] = useState(readAuthRedirect);
  const authError = authRedirect?.error ? authRedirectMessage(authRedirect) : undefined;
  const incompleteConfirmation = Boolean(authRedirect?.accessToken && !session);

  useEffect(() => {
    if (!authError && !incompleteConfirmation) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = '';
      window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
    }
    router.replace({
      pathname: '/auth',
      params: {
        error: authError ?? 'Ссылку подтверждения не удалось завершить. Войдите в аккаунт вручную.',
      },
    });
  }, [authError, incompleteConfirmation, router]);

  if (authError || incompleteConfirmation) return null;
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}

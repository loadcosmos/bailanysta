import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';

import { PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPair,
} from '@/lib/validation';

function hashAccessToken() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  return tokenFromUrl(window.location.href);
}

export default function PasswordResetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ access_token?: string; error_description?: string }>();
  const { colors, locale, resetPassword } = useApp();
  const [accessToken, setAccessToken] = useState(() => String(params.access_token ?? hashAccessToken()));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(String(params.error_description ?? ''));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const cleanUrl = new URL(window.location.href);
      ['access_token', 'refresh_token', 'token_type', 'expires_in', 'type', 'error_description'].forEach((key) =>
        cleanUrl.searchParams.delete(key),
      );
      cleanUrl.hash = '';
      window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void Linking.getInitialURL().then((url) => {
        const token = url ? tokenFromUrl(url) : '';
        if (token) setAccessToken(token);
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = tokenFromUrl(url);
      if (token) setAccessToken(token);
    });
    return () => subscription.remove();
  }, []);

  async function submit() {
    if (!accessToken) {
      setError(
        locale === 'kk' ? 'Қалпына келтіру сілтемесі жарамсыз.' : 'Ссылка восстановления недействительна.',
      );
      return;
    }
    const passwordCheck = validatePasswordPair(password, confirmation);
    if (!passwordCheck.ok && passwordCheck.reason === 'length') {
      setError(
        locale === 'kk'
          ? `Құпия сөз ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} таңба болуы керек.`
          : `Пароль должен содержать от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов.`,
      );
      return;
    }
    if (!passwordCheck.ok && passwordCheck.reason === 'mismatch') {
      setError(locale === 'kk' ? 'Құпия сөздер сәйкес емес.' : 'Пароли не совпадают.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(password, accessToken);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось обновить пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {done
            ? locale === 'kk'
              ? 'Дайын'
              : 'Готово'
            : locale === 'kk'
              ? 'Жаңа құпия сөз'
              : 'Новый пароль'}
        </Text>
        <Text selectable style={[styles.subtitle, { color: colors.muted }]}>
          {done
            ? locale === 'kk'
              ? 'Енді жаңа құпия сөзбен кіре аласыз.'
              : 'Теперь можно войти с новым паролем.'
            : locale === 'kk'
              ? 'Аккаунтқа қайта кіру үшін жаңа құпия сөз қойыңыз.'
              : 'Придумайте новый пароль для доступа к аккаунту.'}
        </Text>
        {done ? (
          <Pressable onPress={() => router.replace('/auth')}>
            <Text style={[styles.link, { color: colors.text }]}>Вернуться ко входу</Text>
          </Pressable>
        ) : (
          <>
            <View
              style={[styles.passwordField, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
                onChangeText={setPassword}
                placeholder={locale === 'kk' ? 'Жаңа құпия сөз' : 'Новый пароль'}
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                style={[styles.passwordInput, { color: colors.text }]}
                value={password}
              />
              <Pressable
                accessibilityLabel={
                  showPassword
                    ? locale === 'kk'
                      ? 'Құпия сөзді жасыру'
                      : 'Скрыть пароль'
                    : locale === 'kk'
                      ? 'Құпия сөзді көрсету'
                      : 'Показать пароль'
                }
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowPassword((visible) => !visible)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  color={colors.muted}
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                />
              </Pressable>
            </View>
            <View
              style={[styles.passwordField, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
                onChangeText={setConfirmation}
                placeholder={locale === 'kk' ? 'Қайта енгізіңіз' : 'Повторите пароль'}
                placeholderTextColor={colors.muted}
                secureTextEntry={!showConfirmation}
                style={[styles.passwordInput, { color: colors.text }]}
                value={confirmation}
              />
              <Pressable
                accessibilityLabel={
                  showConfirmation
                    ? locale === 'kk'
                      ? 'Растауды жасыру'
                      : 'Скрыть подтверждение пароля'
                    : locale === 'kk'
                      ? 'Растауды көрсету'
                      : 'Показать подтверждение пароля'
                }
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowConfirmation((visible) => !visible)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  color={colors.muted}
                  name={showConfirmation ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                />
              </Pressable>
            </View>
            <Text selectable style={[styles.passwordHint, { color: colors.muted }]}>
              {locale === 'kk'
                ? `Құпия сөз: ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} таңба.`
                : `Пароль: от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов.`}
            </Text>
            {!!error && (
              <Text selectable accessibilityRole="alert" style={[styles.error, { color: colors.coral }]}>
                {error}
              </Text>
            )}
            <PrimaryButton
              loading={loading}
              onPress={submit}
              title={locale === 'kk' ? 'Сақтау' : 'Сохранить пароль'}
              icon="checkmark"
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function tokenFromUrl(url: string) {
  const [withoutFragment, fragment = ''] = url.split('#');
  const fromQuery = new URLSearchParams(withoutFragment.split('?')[1] ?? '').get('access_token');
  return fromQuery ?? new URLSearchParams(fragment).get('access_token') ?? '';
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  title: { fontSize: 34, lineHeight: 39, fontStyle: 'italic', fontWeight: '500', letterSpacing: -1.2 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 8 },
  passwordField: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    minHeight: 56,
    paddingLeft: 18,
    paddingRight: 8,
    fontSize: 16,
  },
  passwordToggle: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordHint: { fontSize: 13, lineHeight: 18, marginTop: -6 },
  error: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
});

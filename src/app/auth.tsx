import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { hasRemoteApi } from '@/lib/api';
import { authSubmitLabel } from '@/lib/ui-copy';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/validation';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { colors, locale, session, signIn, signInWithGoogle, forgotPassword } = useApp();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => String(params.error ?? ''));
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [router, session]);

  if (session)
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(locale === 'kk' ? 'Дұрыс email енгізіңіз.' : 'Введите корректный email.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'forgot') {
        setNotice(await forgotPassword(email.trim()));
        return;
      }
      if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
        setError(
          locale === 'kk'
            ? `Құпия сөз ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} таңбадан тұруы керек.`
            : `Пароль должен содержать от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов.`,
        );
        return;
      }
      const result = await signIn(mode, email.trim(), password);
      if (result.pending) {
        setNotice(result.message ?? (locale === 'kk' ? 'Email-ді растаңыз.' : 'Подтвердите email в письме.'));
        return;
      }
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      if (Platform.OS !== 'web' || !hasRemoteApi) router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось войти через Google');
    } finally {
      setLoading(false);
    }
  }

  const forgot = mode === 'forgot';
  const title = forgot
    ? locale === 'kk'
      ? 'Құпия сөзді қалпына келтірейік'
      : 'Вернём доступ'
    : mode === 'signup'
      ? locale === 'kk'
        ? 'Өз ортаңызды табыңыз'
        : 'Найдите своё сообщество'
      : locale === 'kk'
        ? 'Қайта оралу'
        : 'С возвращением';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <Text selectable style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text selectable style={[styles.subtitle, { color: colors.muted }]}>
          {forgot
            ? locale === 'kk'
              ? 'Тіркелген email-ге қауіпсіз сілтеме жібереміз.'
              : 'Отправим безопасную ссылку на зарегистрированный email.'
            : locale === 'kk'
              ? 'Жариялау, пікір жазу және прогресті сақтау үшін.'
              : 'Чтобы публиковать, комментировать и сохранять прогресс.'}
        </Text>

        {!forgot && (
          <View style={[styles.segment, { backgroundColor: colors.softSurface }]}>
            {(['signup', 'signin'] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                onPress={() => {
                  setMode(item);
                  setError('');
                  setNotice('');
                }}
                style={[styles.segmentItem, mode === item && { backgroundColor: colors.surface }]}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {item === 'signup'
                    ? locale === 'kk'
                      ? 'Тіркелу'
                      : 'Регистрация'
                    : locale === 'kk'
                      ? 'Кіру'
                      : 'Вход'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          value={email}
        />
        {!forgot && (
          <View style={styles.passwordGroup}>
            <View
              style={[
                styles.passwordField,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TextInput
                autoCapitalize="none"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                maxLength={PASSWORD_MAX_LENGTH}
                onChangeText={setPassword}
                placeholder={locale === 'kk' ? 'Құпия сөз' : 'Пароль'}
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
            <Text selectable style={[styles.passwordHint, { color: colors.muted }]}>
              {locale === 'kk'
                ? `Құпия сөз: ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} таңба.`
                : `Пароль: от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов.`}
            </Text>
          </View>
        )}

        {!!error && (
          <Text selectable accessibilityRole="alert" style={[styles.error, { color: colors.coral }]}>
            {error}
          </Text>
        )}
        {!!notice && (
          <Text selectable style={[styles.notice, { color: colors.text }]}>
            {notice}
          </Text>
        )}
        <PrimaryButton
          loading={loading}
          onPress={submit}
          title={
            authSubmitLabel(locale, forgot ? 'forgot' : mode)
          }
          icon="arrow.right"
        />

        {!forgot && (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={google}
              style={[styles.google, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="logo-google" size={18} color={colors.text} />
              <Text style={[styles.googleText, { color: colors.text }]}>
                {locale === 'kk' ? 'Google арқылы жалғастыру' : 'Продолжить с Google'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode('forgot');
                setError('');
                setNotice('');
              }}
              style={styles.linkButton}
            >
              <Text style={[styles.link, { color: colors.muted }]}>
                {locale === 'kk' ? 'Құпия сөзді ұмыттыңыз ба?' : 'Забыли пароль?'}
              </Text>
            </Pressable>
          </>
        )}
        {forgot && (
          <Pressable
            onPress={() => {
              setMode('signin');
              setError('');
              setNotice('');
            }}
            style={styles.linkButton}
          >
            <Text style={[styles.link, { color: colors.muted }]}>
              {locale === 'kk' ? 'Кіруге оралу' : 'Вернуться ко входу'}
            </Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  segment: { flexDirection: 'row', padding: 4, borderRadius: 24 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  passwordGroup: { gap: 6 },
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
  passwordHint: { fontSize: 12, lineHeight: 16, paddingHorizontal: 18 },
  error: { fontSize: 13, lineHeight: 18 },
  notice: { fontSize: 13, lineHeight: 19 },
  google: {
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  googleText: { fontSize: 15, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingVertical: 6 },
  link: { fontSize: 13, textDecorationLine: 'underline' },
});

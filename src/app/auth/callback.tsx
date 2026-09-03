import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ handoff?: string; error?: string }>();
  const { colors, consumeGoogleHandoff, locale } = useApp();
  const [error, setError] = useState('');
  const displayError = String(
    params.error ||
      error ||
      (!params.handoff
        ? locale === 'kk'
          ? 'Кірудің бір реттік сілтемесі табылмады'
          : 'Не найдена одноразовая ссылка входа'
        : ''),
  );

  useEffect(() => {
    if (params.error || !params.handoff) return;
    void consumeGoogleHandoff(String(params.handoff))
      .then(() => router.replace('/(tabs)'))
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : locale === 'kk'
              ? 'Кіруді аяқтау мүмкін болмады'
              : 'Не удалось завершить вход',
        ),
      );
  }, [consumeGoogleHandoff, locale, params.error, params.handoff, router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {displayError ? (
        <Text selectable style={[styles.error, { color: colors.coral }]}>{displayError}</Text>
      ) : (
        <ActivityIndicator color={colors.text} size="large" />
      )}
      {displayError && (
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')}>
          <Text selectable style={[styles.hint, { color: colors.muted }]}>
            {locale === 'kk' ? 'Кіру бетіне оралу' : 'Вернуться к входу'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  error: { fontSize: 16, textAlign: 'center', lineHeight: 23 },
  hint: { fontSize: 14, textDecorationLine: 'underline' },
});

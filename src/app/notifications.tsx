import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, locale, loadNotifications, markNotificationsRead, notifications, session } = useApp();
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState('');
  const [markingRead, setMarkingRead] = useState(false);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError('');
      return loadNotifications()
        .catch((cause) => {
          if (!cancelled)
            setError(cause instanceof Error ? cause.message : 'Не удалось загрузить уведомления');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loadNotifications, session]);

  async function markAllRead() {
    if (markingRead) return;
    setMarkingRead(true);
    setError('');
    try {
      await markNotificationsRead();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отметить уведомления');
    } finally {
      setMarkingRead(false);
    }
  }

  if (!session)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState
          title={locale === 'kk' ? 'Кіру қажет' : 'Нужен вход'}
          text={
            locale === 'kk'
              ? 'Хабарламаларды көру үшін аккаунтқа кіріңіз.'
              : 'Войдите, чтобы увидеть уведомления.'
          }
        />
        <PrimaryButton title={locale === 'kk' ? 'Кіру' : 'Войти'} onPress={() => router.push('/auth')} />
      </View>
    );
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={notifications}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {locale === 'kk' ? 'Хабарламалар' : 'Уведомления'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: markingRead }}
              disabled={markingRead}
              onPress={() => void markAllRead()}
              style={styles.markButton}
            >
              <Text style={[styles.mark, { color: colors.muted }]}>
                {locale === 'kk' ? 'Барлығын оқу' : 'Отметить всё'}
              </Text>
            </Pressable>
          </View>
          {!!error && (
            <Text selectable accessibilityRole="alert" style={{ color: colors.coral }}>
              {error}
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.text} style={{ marginTop: 24 }} />
        ) : error ? (
          <EmptyState title={locale === 'kk' ? 'Жүктеу қатесі' : 'Не удалось загрузить'} text={error} />
        ) : (
          <EmptyState
            title={locale === 'kk' ? 'Әзірге жаңалық жоқ' : 'Пока тихо'}
            text={
              locale === 'kk'
                ? 'Лайк, пікір немесе жазылым келгенде осында көрінеді.'
                : 'Лайки, комментарии и новые подписки появятся здесь.'
            }
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.body}
          onPress={() => {
            if (item.postId) router.push({ pathname: '/post/[id]', params: { id: item.postId } });
            else if (item.actor?.id) router.push({ pathname: '/profile/[id]', params: { id: item.actor.id } });
          }}
          style={[
            styles.item,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !item.readAt && { backgroundColor: colors.cyanSoft },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.softSurface }]}>
            <Ionicons
              name={
                item.kind === 'like'
                  ? 'heart'
                  : item.kind === 'comment'
                    ? 'chatbubble'
                    : item.kind === 'follow'
                      ? 'person-add'
                      : 'shield-checkmark'
              }
              size={18}
              color={item.kind === 'like' ? colors.coral : colors.text}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.body, { color: colors.text }]}>{item.body}</Text>
            <Text style={[styles.date, { color: colors.muted }]}>
              {new Date(item.createdAt).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 18 },
  content: { padding: 16, paddingBottom: 50, gap: 10, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: 8, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 34, fontStyle: 'italic' },
  markButton: { minHeight: 40, justifyContent: 'center' },
  mark: { fontSize: 13, textDecorationLine: 'underline' },
  item: {
    minHeight: 76,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 15, lineHeight: 20 },
  date: { fontSize: 11 },
});

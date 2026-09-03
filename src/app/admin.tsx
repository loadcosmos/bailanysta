import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EmptyState } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import type { Post, SocialUser } from '@/types/social';

type Resource = 'users' | 'posts' | 'comments' | 'events';
type AdminData = {
  users?: SocialUser[];
  posts?: Post[];
  comments?: {
    id: string;
    post_id: string;
    body: string;
    status: string;
    created_at: string;
    profile?: { name?: string };
  }[];
  events?: { id: string; target_type: string; target_id: string; action: string; created_at: string }[];
};

export default function AdminScreen() {
  const { adminList, adminModerate, colors, locale, session } = useApp();
  const [resource, setResource] = useState<Resource>('users');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operationKey, setOperationKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError('');
      setData({});
      return adminList(resource, query)
        .then((result) => {
          if (!cancelled) setData(result as AdminData);
        })
        .catch((cause) => {
          if (!cancelled)
            setError(cause instanceof Error ? cause.message : 'Не удалось загрузить модерацию');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [adminList, query, resource]);

  if (session?.user.role !== 'admin')
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState
          title={locale === 'kk' ? 'Қолжетім жоқ' : 'Нет доступа'}
          text={
            locale === 'kk'
              ? 'Бұл бөлім тек әкімшілерге арналған.'
              : 'Раздел доступен только администраторам.'
          }
        />
      </View>
    );

  async function moderate(
    action: 'hide' | 'restore' | 'delete' | 'block' | 'unblock',
    targetType: 'user' | 'post' | 'comment',
    targetId: string,
  ) {
    if (operationKey) return;
    if (action === 'delete') {
      const confirmed = await confirmDestructive(
        locale === 'kk' ? 'Бұл нысанды өшіру керек пе?' : 'Удалить этот объект?',
        locale,
      );
      if (!confirmed) return;
    }
    setOperationKey(`${targetType}:${targetId}`);
    setError('');
    try {
      await adminModerate({ action, targetType, targetId });
      const result = await adminList(resource, query);
      setData(result as AdminData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Операция не выполнена');
    } finally {
      setOperationKey('');
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>
          {locale === 'kk' ? 'Модерация' : 'Модерация'}
        </Text>
        <Ionicons name="shield-checkmark" size={26} color={colors.text} />
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={locale === 'kk' ? 'Іздеу' : 'Поиск'}
        placeholderTextColor={colors.muted}
        style={[
          styles.search,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
      <View style={styles.tabs}>
        {(['users', 'posts', 'comments', 'events'] as Resource[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setResource(item)}
            style={[
              styles.tab,
              {
                backgroundColor: resource === item ? colors.text : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={{ color: resource === item ? colors.surface : colors.text, fontWeight: '700' }}>
              {item === 'users'
                ? 'Пользователи'
                : item === 'posts'
                  ? 'Посты'
                  : item === 'comments'
                    ? 'Комментарии'
                    : 'Журнал'}
            </Text>
          </Pressable>
        ))}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.coral }}>
          {error}
        </Text>
      )}
      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: 30 }} />
      ) : resource === 'users' ? (
        <View style={styles.list}>
          {(data.users ?? []).map((user) => (
            <View
              key={user.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{user.name}</Text>
                <Text style={{ color: colors.muted }}>
                  @{user.handle} · {user.status}
                </Text>
              </View>
              {user.status === 'blocked' ? (
                <Action
                  label="Разблокировать"
                  onPress={() => void moderate('unblock', 'user', user.id)}
                  disabled={operationKey === `user:${user.id}`}
                  colors={colors}
                />
              ) : (
                <Action
                  label="Заблокировать"
                  onPress={() => void moderate('block', 'user', user.id)}
                  disabled={operationKey === `user:${user.id}`}
                  colors={colors}
                />
              )}
            </View>
          ))}
        </View>
      ) : resource === 'posts' ? (
        <View style={styles.list}>
          {(data.posts ?? []).map((post) => (
            <View
              key={post.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>
                  {post.body}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {post.status ?? 'published'} · @{post.author.handle}
                </Text>
              </View>
              {post.status === 'hidden' ? (
                <Action
                  label="Вернуть"
                  onPress={() => void moderate('restore', 'post', post.id)}
                  disabled={operationKey === `post:${post.id}`}
                  colors={colors}
                />
              ) : (
                <Action
                  label="Скрыть"
                  onPress={() => void moderate('hide', 'post', post.id)}
                  disabled={operationKey === `post:${post.id}`}
                  colors={colors}
                />
              )}
              <Action
                label="Удалить"
                onPress={() => void moderate('delete', 'post', post.id)}
                disabled={operationKey === `post:${post.id}`}
                colors={colors}
                danger
              />
            </View>
          ))}
        </View>
      ) : resource === 'comments' ? (
        <View style={styles.list}>
          {(data.comments ?? []).map((comment) => (
            <View
              key={comment.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>
                  {comment.body}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {comment.profile?.name ?? 'Участник'} · {comment.status}
                </Text>
              </View>
              {comment.status === 'hidden' ? (
                <Action
                  label="Вернуть"
                  onPress={() => void moderate('restore', 'comment', comment.id)}
                  disabled={operationKey === `comment:${comment.id}`}
                  colors={colors}
                />
              ) : (
                <Action
                  label="Скрыть"
                  onPress={() => void moderate('hide', 'comment', comment.id)}
                  disabled={operationKey === `comment:${comment.id}`}
                  colors={colors}
                />
              )}
              <Action
                label="Удалить"
                onPress={() => void moderate('delete', 'comment', comment.id)}
                disabled={operationKey === `comment:${comment.id}`}
                colors={colors}
                danger
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {(data.events ?? []).map((event) => (
            <View
              key={event.id}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {event.action} · {event.target_type}
              </Text>
              <Text style={{ color: colors.muted }}>
                {event.target_id} · {new Date(event.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Action({
  label,
  onPress,
  disabled,
  colors,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors: { text: string; surface: string; border: string; coral: string };
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        { borderColor: danger ? colors.coral : colors.border, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={{ color: danger ? colors.coral : colors.text, fontSize: 11, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 70, gap: 14, width: '100%', maxWidth: 820, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 35, fontStyle: 'italic' },
  search: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 10 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  action: {
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 17,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function confirmDestructive(message: string, locale: 'ru' | 'kk') {
  if (Platform.OS === 'web')
    return Promise.resolve(
      window.confirm(
        `${message}\n${locale === 'kk' ? 'Бұл әрекет қайтарылмайды.' : 'Это действие нельзя отменить.'}`,
      ),
    );
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      message,
      locale === 'kk' ? 'Бұл әрекет қайтарылмайды.' : 'Это действие нельзя отменить.',
      [
        {
          text: locale === 'kk' ? 'Бас тарту' : 'Отмена',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: locale === 'kk' ? 'Өшіру' : 'Удалить',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
    );
  });
}

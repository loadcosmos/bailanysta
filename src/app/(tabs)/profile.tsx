import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PostCard } from '@/components/post-card';
import { PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { api, hasRemoteApi } from '@/lib/api';
import { appImages } from '@/data/demo';
import { guestProfileLabel, profileCreateLabel } from '@/lib/ui-copy';
import type { Post } from '@/types/social';

export default function ProfileScreen() {
  const router = useRouter();
  const { changeLocale, changeTheme, colors, locale, posts, session, signOut, theme, notifications } =
    useApp();
  const user = session?.user;
  const [remoteOwnPosts, setRemoteOwnPosts] = useState<Post[]>([]);
  const [ownPostsLoading, setOwnPostsLoading] = useState(Boolean(hasRemoteApi && user));
  const [ownPostsError, setOwnPostsError] = useState('');
  const ownPosts = useMemo(() => {
    const cachedOwnPosts = user ? posts.filter((post) => post.author.id === user.id) : [];
    if (!hasRemoteApi) return cachedOwnPosts;
    const cachedById = new Map(cachedOwnPosts.map((post) => [post.id, post]));
    const remoteIds = new Set(remoteOwnPosts.map((post) => post.id));
    return [
      ...remoteOwnPosts.map((post) => cachedById.get(post.id) ?? post),
      ...cachedOwnPosts.filter((post) => !remoteIds.has(post.id)),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [posts, remoteOwnPosts, user]);

  useEffect(() => {
    if (!hasRemoteApi || !user) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setOwnPostsLoading(true);
      setOwnPostsError('');
      setRemoteOwnPosts([]);
      return api
        .user(user.id, session?.accessToken)
        .then((result) => {
          if (!cancelled) setRemoteOwnPosts(result.posts);
        })
        .catch((cause) => {
          if (!cancelled)
            setOwnPostsError(cause instanceof Error ? cause.message : 'Не удалось загрузить сигналы');
        })
        .finally(() => {
          if (!cancelled) setOwnPostsLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, user]);

  if (!session)
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, styles.guestContent]}
      >
        <View style={[styles.guestCard, { backgroundColor: colors.surface }]}>
          <Ionicons name="person-circle-outline" size={62} color={colors.text} />
          <Text selectable style={[styles.guestTitle, { color: colors.text }]}>
            {locale === 'kk' ? 'Bailanysta-ға кіріңіз' : 'Войдите в Bailanysta'}
          </Text>
          <Text selectable style={[styles.guestText, { color: colors.muted }]}>
            {locale === 'kk'
              ? 'Жеке профиліңіз автоматты түрде жасалады: сигнал жариялап, жазылымдарыңызды басқара аласыз.'
              : 'Личный профиль создастся автоматически — сможете публиковать сигналы и управлять подписками.'}
          </Text>
          <PrimaryButton title={guestProfileLabel(locale)} onPress={() => router.push('/auth')} />
        </View>
        <View style={[styles.settings, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="language-outline"
            label={locale === 'kk' ? 'Тіл' : 'Язык'}
            value={locale === 'kk' ? 'Қазақша' : 'Русский'}
            onPress={() => changeLocale(locale === 'ru' ? 'kk' : 'ru')}
          />
          <SettingRow
            icon={theme === 'dark' ? 'moon-outline' : 'sunny-outline'}
            label={locale === 'kk' ? 'Тақырып' : 'Тема'}
            value={
              theme === 'dark'
                ? locale === 'kk'
                  ? 'Қараңғы'
                  : 'Тёмная'
                : locale === 'kk'
                  ? 'Жарық'
                  : 'Светлая'
            }
            onPress={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        </View>
      </ScrollView>
    );

  const activeUser = session.user;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profile, { backgroundColor: colors.surface }]}>
        <Image source={activeUser.cover ?? appImages.trail} style={styles.cover} contentFit="cover" />
        <Image
          source={activeUser.avatar ?? appImages.hero}
          style={[styles.avatar, { borderColor: colors.surface }]}
          contentFit="cover"
        />
        <View style={styles.identity}>
          <View style={styles.nameLine}>
            <Text selectable style={[styles.name, { color: colors.text }]}>
              {activeUser.name}
            </Text>
            {session && (
              <Pressable
                accessibilityLabel={locale === 'kk' ? 'Профильді өңдеу' : 'Редактировать профиль'}
                onPress={() => router.push('/profile/edit')}
                style={[styles.iconButton, { backgroundColor: colors.softSurface }]}
              >
                <Ionicons name="pencil-outline" size={16} color={colors.text} />
              </Pressable>
            )}
          </View>
          <Text style={[styles.handle, { color: colors.muted }]}>@{activeUser.handle}</Text>
          <Text style={[styles.bio, { color: colors.muted }]}>{activeUser.bio}</Text>
        </View>
        <View style={styles.stats}>
          <Stat value={ownPosts.length} label={locale === 'kk' ? 'Сигнал' : 'Сигналы'} />
          <Stat value={activeUser.followers ?? 0} label={locale === 'kk' ? 'Жазылушы' : 'Подписчики'} />
          <Stat value={activeUser.following ?? 0} label={locale === 'kk' ? 'Жазылым' : 'Подписки'} />
        </View>
        <View style={styles.profileAction}>
          <PrimaryButton
            icon="paperplane.fill"
            onPress={() => router.push('/create')}
            title={profileCreateLabel(locale)}
          />
        </View>
      </View>

      <View style={[styles.settings, { backgroundColor: colors.surface }]}>
        <SettingRow
          icon="language-outline"
          label={locale === 'kk' ? 'Тіл' : 'Язык'}
          value={locale === 'kk' ? 'Қазақша' : 'Русский'}
          onPress={() => changeLocale(locale === 'ru' ? 'kk' : 'ru')}
        />
        <SettingRow
          icon={theme === 'dark' ? 'moon-outline' : 'sunny-outline'}
          label={locale === 'kk' ? 'Тақырып' : 'Тема'}
          value={
            theme === 'dark'
              ? locale === 'kk'
                ? 'Қараңғы'
                : 'Тёмная'
              : locale === 'kk'
                ? 'Жарық'
                : 'Светлая'
          }
          onPress={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        {session && (
          <SettingRow
            icon="notifications-outline"
            label={locale === 'kk' ? 'Хабарламалар' : 'Уведомления'}
            value={notifications.some((item) => !item.readAt) ? '•' : undefined}
            onPress={() => router.push('/notifications')}
          />
        )}
        {session?.user.role === 'admin' && (
          <SettingRow
            icon="shield-checkmark-outline"
            label={locale === 'kk' ? 'Модерация' : 'Модерация'}
            onPress={() => router.push('/admin')}
          />
        )}
        {session && (
          <SettingRow
            icon="log-out-outline"
            label={locale === 'kk' ? 'Шығу' : 'Выйти'}
            onPress={() => void signOut()}
          />
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {locale === 'kk' ? 'Сигналдар' : 'Сигналы'}
      </Text>
      <View style={{ gap: 14 }}>
        {ownPosts.map((post) => (
          <PostCard key={post.id} post={post} compact />
        ))}
      </View>
      {ownPostsLoading && <ActivityIndicator color={colors.text} />}
      {!!ownPostsError && (
        <Text selectable accessibilityRole="alert" style={[styles.emptyText, { color: colors.coral }]}>
          {ownPostsError}
        </Text>
      )}
      {!ownPosts.length && session && !ownPostsLoading && (
        <Text style={[styles.emptyText, { color: colors.muted }]}>
          {locale === 'kk' ? 'Алғашқы сигналыңызды жасаңыз.' : 'Создайте свой первый сигнал.'}
        </Text>
      )}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { colors } = useApp();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const { colors } = useApp();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      {value && <Text style={{ color: colors.muted }}>{value}</Text>}
      <Ionicons name="chevron-forward" size={15} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 118, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  guestContent: { flexGrow: 1, justifyContent: 'center' },
  guestCard: { borderRadius: 32, borderCurve: 'continuous', padding: 28, alignItems: 'center', gap: 14 },
  guestTitle: { fontSize: 27, fontWeight: '800', textAlign: 'center' },
  guestText: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  profile: { borderRadius: 32, borderCurve: 'continuous', overflow: 'hidden' },
  cover: { height: 220, width: '100%' },
  avatar: { width: 94, height: 94, borderRadius: 47, borderWidth: 5, alignSelf: 'center', marginTop: -47 },
  identity: { alignItems: 'center', padding: 14, gap: 4 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 27, fontWeight: '700', letterSpacing: -0.8 },
  handle: { fontSize: 13 },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 390, marginTop: 6 },
  stats: { flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 18 },
  profileAction: { paddingHorizontal: 18, paddingBottom: 18 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11 },
  settings: { borderRadius: 26, borderCurve: 'continuous', paddingHorizontal: 16 },
  settingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 25, fontWeight: '600', letterSpacing: -0.7, paddingHorizontal: 6, marginTop: 8 },
  emptyText: { textAlign: 'center', padding: 24, fontSize: 15 },
});

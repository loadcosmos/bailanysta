import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PostCard } from '@/components/post-card';
import { EmptyState } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { api, hasRemoteApi } from '@/lib/api';
import { appImages } from '@/data/demo';
import type { Post, SocialUser } from '@/types/social';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, getFollowStatus, locale, posts, session, followUser } = useApp();
  const localUser = hasRemoteApi ? undefined : posts.find((post) => post.author.id === id)?.author;
  const [remoteUser, setRemoteUser] = useState<SocialUser>();
  const [following, setFollowing] = useState(false);
  const [remoteFollowers, setRemoteFollowers] = useState(0);
  const [remotePosts, setRemotePosts] = useState<Post[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteError, setRemoteError] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');
  const user = hasRemoteApi ? remoteUser : localUser;
  const followers = hasRemoteApi ? remoteFollowers : localUser?.followers ?? 0;
  const loading = hasRemoteApi ? remoteLoading : false;
  const error = hasRemoteApi ? remoteError : localUser ? '' : 'Профиль не найден';
  const userPosts: Post[] = hasRemoteApi ? remotePosts : posts.filter((post) => post.author.id === id);

  useEffect(() => {
    if (!hasRemoteApi) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setRemoteLoading(true);
      setRemoteError('');
      return api
        .user(String(id), session?.accessToken)
        .then((result) => {
          if (!cancelled) {
            setRemoteUser(result.user);
            setRemoteFollowers(result.user.followers ?? 0);
            setRemotePosts(result.posts);
          }
        })
        .catch((cause) => {
          if (!cancelled) setRemoteError(cause instanceof Error ? cause.message : 'Профиль не найден');
        })
        .finally(() => {
          if (!cancelled) setRemoteLoading(false);
        });
    });
    if (session && session.user.id !== String(id)) {
      void getFollowStatus(String(id))
        .then((result) => {
          if (!cancelled) {
            setFollowing(result.following);
            setRemoteFollowers(result.followers);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [getFollowStatus, id, session]);

  async function toggle() {
    if (!session) {
      router.push('/auth');
      return;
    }
    setFollowLoading(true);
    setFollowError('');
    try {
      const result = await followUser(String(id));
      setFollowing(result.following);
      setRemoteFollowers(result.followers);
    } catch (cause) {
      setFollowError(cause instanceof Error ? cause.message : 'Не удалось изменить подписку');
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  if (!user || error)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <EmptyState
          title={locale === 'kk' ? 'Профиль табылмады' : 'Профиль не найден'}
          text={error || (locale === 'kk' ? 'Пайдаланушы қолжетімсіз.' : 'Пользователь недоступен.')}
        />
      </View>
    );
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Image source={user.cover ?? appImages.trail} style={styles.cover} contentFit="cover" />
        <Image
          source={user.avatar ?? appImages.hero}
          style={[styles.avatar, { borderColor: colors.surface }]}
          contentFit="cover"
        />
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
          <Text style={[styles.handle, { color: colors.muted }]}>@{user.handle}</Text>
          <Text style={[styles.bio, { color: colors.muted }]}>{user.bio}</Text>
        </View>
        <View style={styles.stats}>
          <Stat value={userPosts.length} label={locale === 'kk' ? 'Сигнал' : 'Сигналы'} />
          <Stat value={followers} label={locale === 'kk' ? 'Жазылушы' : 'Подписчики'} />
          <Stat value={user.following ?? 0} label={locale === 'kk' ? 'Жазылым' : 'Подписки'} />
        </View>
        {session?.user.id !== user.id && (
          <Pressable
            onPress={() => void toggle()}
            accessibilityRole="button"
            disabled={followLoading}
            style={[styles.follow, { backgroundColor: following ? colors.softSurface : colors.text }]}
          >
            <Ionicons
              name={following ? 'checkmark' : 'person-add-outline'}
              size={17}
              color={following ? colors.text : colors.surface}
            />
            <Text style={{ color: following ? colors.text : colors.surface, fontWeight: '800' }}>
              {followLoading
                ? locale === 'kk'
                  ? 'Күтіңіз…'
                  : 'Подождите…'
                : following
                  ? locale === 'kk'
                    ? 'Жазылдыңыз'
                    : 'Вы подписаны'
                  : locale === 'kk'
                    ? 'Жазылу'
                    : 'Подписаться'}
            </Text>
          </Pressable>
        )}
      </View>
      {!!followError && (
        <Text selectable accessibilityRole="alert" style={[styles.error, { color: colors.coral }]}>
          {followError}
        </Text>
      )}
      <Text style={[styles.heading, { color: colors.text }]}>
        {locale === 'kk' ? 'Сигналдар' : 'Сигналы'}
      </Text>
      <View style={{ gap: 14 }}>
        {userPosts.map((post) => (
          <PostCard key={post.id} post={post} compact />
        ))}
      </View>
      {!userPosts.length && (
        <Text selectable style={[styles.empty, { color: colors.muted }]}>
          {locale === 'kk' ? 'Жарияланымдар әзірге жоқ.' : 'Пока нет публикаций.'}
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
const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 60, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 32, overflow: 'hidden' },
  cover: { width: '100%', height: 220 },
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 5, alignSelf: 'center', marginTop: -46 },
  identity: { alignItems: 'center', padding: 12, gap: 4 },
  name: { fontSize: 27, fontWeight: '800' },
  handle: { fontSize: 13 },
  bio: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 420, marginTop: 4 },
  stats: { flexDirection: 'row', padding: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  follow: {
    minHeight: 48,
    margin: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heading: { fontSize: 25, fontWeight: '700', paddingHorizontal: 5 },
  empty: { textAlign: 'center', padding: 20 },
  error: { fontSize: 13, lineHeight: 18, paddingHorizontal: 5 },
});

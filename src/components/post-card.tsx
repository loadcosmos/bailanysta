import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import type { Post, SignalType } from '@/types/social';

const labels: Record<SignalType, { ru: string; kk: string }> = {
  insight: { ru: 'Инсайт', kk: 'Ой' },
  question: { ru: 'Вопрос', kk: 'Сұрақ' },
  progress: { ru: 'Прогресс', kk: 'Прогресс' },
  resource: { ru: 'Ресурс', kk: 'Ресурс' },
};

function timeAgo(value: string, locale: 'ru' | 'kk') {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return locale === 'kk' ? 'Қазір' : 'Сейчас';
  if (hours < 24) return locale === 'kk' ? `${hours} сағ бұрын` : `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return locale === 'kk' ? `${days} күн бұрын` : `${days} дн назад`;
}

export function PostCard({ post, compact = false }: { post: Post; compact?: boolean }) {
  const router = useRouter();
  const { colors, locale, session, toggleLike } = useApp();
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeError, setLikeError] = useState('');
  const typeLabel = labels[post.type][locale];

  const openPost = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });
  const like = async () => {
    if (!session) {
      router.push('/auth');
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);
    setLikeError('');
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggleLike(post.id);
    } catch (cause) {
      setLikeError(cause instanceof Error ? cause.message : 'Не удалось обновить реакцию');
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: `0 9px 26px ${colors.shadow}`,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${post.author.name}, @${post.author.handle}`}
        onPress={() => router.push({ pathname: '/profile/[id]', params: { id: post.author.id } })}
        style={styles.authorRow}
      >
        <Image source={post.author.avatar} style={styles.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text selectable style={[styles.author, { color: colors.text }]}>
            {post.author.name}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            @{post.author.handle} · {timeAgo(post.createdAt, locale)}
          </Text>
        </View>
        <View style={[styles.signalBadge, { backgroundColor: colors.cyanSoft }]}>
          <Text style={[styles.signalText, { color: colors.text }]}>{typeLabel}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={locale === 'kk' ? 'Сигналды ашу' : 'Открыть сигнал'}
        onPress={openPost}
        style={({ pressed }) => pressed && { opacity: 0.88 }}
      >
        {post.image && !compact && (
          <Image
            source={post.image}
            style={[styles.image, { backgroundColor: colors.softSurface }]}
            contentFit="cover"
            transition={250}
          />
        )}
        <View style={styles.copy}>
          <Text selectable style={[styles.body, { color: colors.text }]}>
            {post.body}
          </Text>
          <View style={styles.tags}>
            {post.tags.map((tag) => (
              <Text key={tag} style={[styles.tag, { color: colors.muted }]}>
                #{tag}
              </Text>
            ))}
          </View>
          {post.link && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={locale === 'kk' ? 'Сілтемені ашу' : 'Открыть ссылку'}
              onPress={() => void Linking.openURL(post.link!)}
              style={[styles.link, { borderColor: colors.border }]}
            >
              <Ionicons name="link-outline" size={15} color={colors.text} />
              <Text numberOfLines={1} style={[styles.linkText, { color: colors.text }]}>
                {post.link}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>

      {!!likeError && (
        <Text selectable accessibilityRole="alert" style={[styles.error, { color: colors.coral }]}>
          {likeError}
        </Text>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === 'kk' ? 'Ұнайды' : 'Нравится'}
          accessibilityState={{ disabled: likeLoading, selected: post.liked }}
          testID="like-button"
          disabled={likeLoading}
          onPress={() => void like()}
          style={styles.action}
        >
          <Ionicons
            name={post.liked ? 'heart' : 'heart-outline'}
            size={20}
            color={post.liked ? colors.coral : colors.text}
          />
          <Text style={[styles.count, { color: colors.text }]}>{post.likes}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === 'kk' ? 'Пікірлер' : 'Комментарии'}
          onPress={openPost}
          style={styles.action}
        >
          <Ionicons name="chatbubble-outline" size={19} color={colors.text} />
          <Text style={[styles.count, { color: colors.text }]}>{post.comments.length}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={[styles.topic, { borderColor: colors.border }]}>
          <Text style={[styles.topicText, { color: colors.text }]}>{post.topic}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
  },
  avatar: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#D7EEEE' },
  author: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
  signalBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18 },
  signalText: { fontSize: 11, fontWeight: '700' },
  image: { width: '100%', aspectRatio: 1.22 },
  copy: { padding: 16, gap: 12 },
  body: { fontSize: 19, lineHeight: 26, fontWeight: '500', letterSpacing: -0.3 },
  error: { paddingHorizontal: 16, paddingBottom: 10, fontSize: 12, lineHeight: 17 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontSize: 12, fontWeight: '600' },
  link: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  linkText: { flex: 1, fontSize: 12, textDecorationLine: 'underline' },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
  },
  action: { minWidth: 44, minHeight: 40, flexDirection: 'row', gap: 6, alignItems: 'center' },
  count: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  topic: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
  },
  topicText: { fontSize: 11, fontWeight: '700' },
});

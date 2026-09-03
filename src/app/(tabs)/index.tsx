import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { FeedSkeleton } from '@/components/feed-skeleton';
import { PostCard } from '@/components/post-card';
import { EmptyState, PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { appImages } from '@/data/demo';
import { feedEmptyCopy } from '@/lib/app-logic';
import type { Topic } from '@/types/social';

const topics: (Topic | 'Все')[] = ['Все', 'Наука', 'AI', 'ЗОЖ', 'Бизнес', 'Карьера'];

export default function FeedScreen() {
  const router = useRouter();
  const {
    colors,
    feedError,
    locale,
    loading,
    loadingMore,
    loadMorePosts,
    notifications,
    posts,
    reloadFeed,
    session,
  } = useApp();
  const [topic, setTopic] = useState<(typeof topics)[number]>('Все');
  const filtered = useMemo(
    () => (topic === 'Все' ? posts : posts.filter((post) => post.topic === topic)),
    [posts, topic],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.cyanSoft, colors.background]}
        end={{ x: 0.8, y: 1 }}
        style={styles.glow}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={loading ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.accountPill, { backgroundColor: colors.surface }]}>
              <Image
                source={session?.user.avatar ?? appImages.hero}
                style={styles.accountAvatar}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountName, { color: colors.text }]}>
                  {session
                    ? locale === 'kk'
                      ? `Сәлем, ${session.user.name}`
                      : `Добрый день, ${session.user.name}`
                    : locale === 'kk'
                      ? 'Қайырлы күн'
                      : 'Добрый день'}
                </Text>
                <Text style={[styles.accountMeta, { color: colors.muted }]}>
                  {locale === 'kk' ? 'Бүгін не үйрендіңіз?' : 'Что вы узнали сегодня?'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={locale === 'kk' ? 'Хабарламалар' : 'Уведомления'}
                onPress={() => router.push('/notifications')}
                style={[styles.roundButton, { backgroundColor: colors.softSurface }]}
              >
                <Ionicons
                  name={
                    notifications.some((item) => !item.readAt) ? 'notifications' : 'notifications-outline'
                  }
                  size={20}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <Text selectable style={[styles.editorialTitle, { color: colors.text }]}>
              {locale === 'kk'
                ? 'Өзгерткен сәттеріңізбен\nбөлісіңіз.'
                : 'Рассказывайте о том,\nчто меняет вас.'}
            </Text>
            <Text style={[styles.lead, { color: colors.muted }]}>
              {locale === 'kk'
                ? 'Нақты ойлар, кішкентай жеңістер және сізбен бір бағытта өсетін адамдар.'
                : 'Честные мысли, маленькие победы и люди, которые растут в том же направлении.'}
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              {locale === 'kk' ? 'Таспа' : 'Лента'}
            </Text>
            <FlatList
              data={topics}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => {
                const active = item === topic;
                return (
                  <Pressable
                    onPress={() => setTopic(item)}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? colors.text : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ color: active ? colors.surface : colors.text, fontWeight: '700' }}>
                      {item === 'Все' && locale === 'kk' ? 'Барлығы' : item}
                    </Text>
                  </Pressable>
                );
              }}
            />
            {!!feedError && !loading && (
              <View style={[styles.errorBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text selectable style={[styles.errorText, { color: colors.coral }]}>
                  {feedError}
                </Text>
                <PrimaryButton
                  title={locale === 'kk' ? 'Қайталау' : 'Повторить'}
                  onPress={() => void reloadFeed()}
                  icon="arrow.right"
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <FeedSkeleton />
          ) : feedError ? (
            <View style={styles.emptyError}>
              <EmptyState
                compact
                title={locale === 'kk' ? 'Таспа жүктелмеді' : 'Лента не загрузилась'}
                text={feedError}
              />
              <PrimaryButton
                title={locale === 'kk' ? 'Қайталау' : 'Повторить'}
                onPress={() => void reloadFeed()}
                icon="arrow.right"
              />
            </View>
          ) : (
            <EmptyState compact {...feedEmptyCopy(locale)} />
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.text} style={styles.footerLoader} /> : null
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.7}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 430 },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 118,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: { gap: 16, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 20 },
  accountPill: {
    minHeight: 66,
    borderRadius: 34,
    borderCurve: 'continuous',
    padding: 8,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountAvatar: { width: 46, height: 46, borderRadius: 23 },
  accountName: { fontSize: 14, fontWeight: '700' },
  accountMeta: { fontSize: 11, marginTop: 2 },
  editorialTitle: {
    fontSize: 39,
    lineHeight: 42,
    letterSpacing: -1.8,
    fontStyle: 'italic',
    fontWeight: '400',
    marginTop: 8,
  },
  lead: { fontSize: 14, lineHeight: 20, maxWidth: 360 },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 22, fontWeight: '600', letterSpacing: -0.6, marginTop: 4 },
  footerLoader: { marginVertical: 18 },
  errorBanner: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 12, gap: 10 },
  errorText: { fontSize: 13, lineHeight: 18 },
  emptyError: { gap: 12 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
});

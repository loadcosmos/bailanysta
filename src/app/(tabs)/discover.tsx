import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PostCard } from '@/components/post-card';
import { EmptyState, ScreenTitle } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { api, hasRemoteApi } from '@/lib/api';
import { filterPosts } from '@/lib/app-logic';
import { isLatestSearch, normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from '@/lib/search-logic';
import type { Post, SocialUser, Topic } from '@/types/social';

const topics: (Topic | 'Все')[] = ['Все', 'Наука', 'AI', 'ЗОЖ', 'Бизнес', 'Карьера'];

export default function DiscoverScreen() {
  const router = useRouter();
  const { colors, locale, posts, session } = useApp();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<(typeof topics)[number]>('Все');
  const [remoteResults, setRemoteResults] = useState<Post[]>();
  const [people, setPeople] = useState<SocialUser[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(hasRemoteApi);
  const [remoteError, setRemoteError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!hasRemoteApi) return;
    const currentRequest = ++requestId.current;
    const timer = setTimeout(() => {
      const normalized = normalizeSearchQuery(query);
      setRemoteLoading(true);
      setRemoteError('');
      void Promise.all([
        api.feed({ query: normalized, topic, token: session?.accessToken }),
        api.users(normalized),
      ])
        .then(([feedResult, peopleResult]) => {
          if (!isLatestSearch(currentRequest, requestId.current)) return;
          setRemoteResults(feedResult.posts);
          setPeople(peopleResult.users);
        })
        .catch((cause) => {
          if (!isLatestSearch(currentRequest, requestId.current)) return;
          setRemoteResults([]);
          setPeople([]);
          setRemoteError(cause instanceof Error ? cause.message : 'Не удалось выполнить поиск');
        })
        .finally(() => {
          if (isLatestSearch(currentRequest, requestId.current)) setRemoteLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, session?.accessToken, topic]);

  const localResults = useMemo(
    () => filterPosts(topic === 'Все' ? posts : posts.filter((post) => post.topic === topic), query),
    [posts, query, topic],
  );
  const results = hasRemoteApi ? (remoteResults ?? []) : localResults;
  const normalizedQuery = normalizeSearchQuery(query);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={results}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PostCard post={item} compact />}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle
            eyebrow={locale === 'kk' ? 'Жаңа идеялар' : 'Новые идеи'}
            title={locale === 'kk' ? 'Өзіңізді табыңыз' : 'Найдите своё'}
          />
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={20} color={colors.muted} />
            <TextInput
              autoCapitalize="none"
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder={locale === 'kk' ? 'Сөз, тақырып немесе тег' : 'Слово, автор, тема или тег'}
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text }]}
              value={query}
            />
          </View>
          <FlatList
            data={topics}
            horizontal
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setTopic(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: item === topic ? colors.text : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: item === topic ? colors.surface : colors.text, fontWeight: '700' }}>
                  {item === 'Все' && locale === 'kk' ? 'Барлығы' : item}
                </Text>
              </Pressable>
            )}
          />
        </View>
      }
      ListEmptyComponent={
        remoteLoading ? (
          <ActivityIndicator color={colors.text} style={{ marginTop: 24 }} />
        ) : remoteError ? (
          <EmptyState
            title={locale === 'kk' ? 'Іздеу орындалмады' : 'Поиск не сработал'}
            text={remoteError}
          />
        ) : (
          <EmptyState
            title={locale === 'kk' ? 'Әзірге тыныш' : 'Пока тихо'}
            text={
              locale === 'kk'
                ? 'Басқа сөзді немесе тақырыпты қолданып көріңіз.'
                : 'Попробуйте другое слово или тему.'
            }
          />
        )
      }
      ListFooterComponent={
        hasRemoteApi && normalizedQuery && people.length ? (
          <View style={styles.peopleSection}>
            <Text style={[styles.peopleTitle, { color: colors.text }]}>
              {locale === 'kk' ? 'Адамдар' : 'Люди'}
            </Text>
            {people.map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`${person.name}, @${person.handle}`}
                onPress={() => router.push({ pathname: '/profile/[id]', params: { id: person.id } })}
                style={[styles.person, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personName, { color: colors.text }]}>{person.name}</Text>
                <Text style={{ color: colors.muted }}>@{person.handle}</Text>
              </Pressable>
            ))}
          </View>
        ) : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 118,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: { gap: 18, paddingHorizontal: 4, paddingBottom: 22 },
  search: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 17,
  },
  input: { flex: 1, fontSize: 16, minHeight: 52 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  peopleSection: { gap: 8, paddingTop: 12 },
  peopleTitle: { fontSize: 21, fontWeight: '800' },
  person: { borderRadius: 18, padding: 13, gap: 3 },
  personName: { fontSize: 14, fontWeight: '700' },
});

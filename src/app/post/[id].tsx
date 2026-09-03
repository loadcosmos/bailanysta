import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { PostCard } from '@/components/post-card';
import { EmptyState } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { hasRemoteApi } from '@/lib/api';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addComment, colors, deletePost, loadPost, locale, posts, session } = useApp();
  const [body, setBody] = useState('');
  const cachedPost = posts.find((item) => item.id === id);
  const [loading, setLoading] = useState(hasRemoteApi && !cachedPost);
  const [error, setError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    if (!hasRemoteApi) return;
    let cancelled = false;
    void loadPost(String(id))
      .then(() => {
        if (!cancelled) setError('');
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Сигнал не найден');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadPost]);

  const post = posts.find((item) => item.id === id);

  if (loading) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <EmptyState
          title={locale === 'kk' ? 'Сигнал табылмады' : 'Сигнал не найден'}
          text={error || (locale === 'kk' ? 'Автор оны жойған болуы мүмкін.' : 'Возможно, автор уже удалил его.')}
        />
      </View>
    );
  }

  const postId = post.id;
  const owned = session?.user.id === post.author.id;
  async function submitComment() {
    if (!session) {
      router.push('/auth');
      return;
    }
    if (!body.trim() || commentLoading) return;
    setCommentLoading(true);
    setError('');
    try {
      await addComment(postId, body.trim());
      setBody('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить комментарий');
    } finally {
      setCommentLoading(false);
    }
  }

  async function requestDelete() {
    const remove = async () => {
      try {
        await deletePost(postId);
        router.back();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить сигнал');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Удалить сигнал?\nЭто действие нельзя отменить.')) await remove();
      return;
    }
    Alert.alert('Удалить сигнал?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {owned && (
        <View style={styles.ownerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === 'kk' ? 'Өзгерту' : 'Изменить'}
            onPress={() => router.push({ pathname: '/edit/[id]', params: { id: post.id } })}
            style={[styles.ownerButton, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {locale === 'kk' ? 'Өзгерту' : 'Изменить'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === 'kk' ? 'Жою' : 'Удалить'}
            onPress={() => void requestDelete()}
            style={[styles.ownerButton, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.coral} />
            <Text style={{ color: colors.coral, fontWeight: '700' }}>
              {locale === 'kk' ? 'Жою' : 'Удалить'}
            </Text>
          </Pressable>
        </View>
      )}
      {!!error && (
        <Text selectable accessibilityRole="alert" style={[styles.error, { color: colors.coral }]}>
          {error}
        </Text>
      )}
      <PostCard post={post} />
      <Text style={[styles.heading, { color: colors.text }]}>
        {locale === 'kk' ? 'Пікірлер' : 'Комментарии'}
      </Text>
      <View style={{ gap: 10 }}>
        {post.comments.length ? (
          post.comments.map((comment) => (
            <View key={comment.id} style={[styles.comment, { backgroundColor: colors.surface }]}>
              <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.author.name}</Text>
              <Text selectable style={[styles.commentBody, { color: colors.text }]}>
                {comment.body}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.muted }}>
            {locale === 'kk' ? 'Бірінші пікірді жазыңыз.' : 'Напишите первый комментарий.'}
          </Text>
        )}
      </View>
      <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          multiline
          onChangeText={setBody}
          placeholder={locale === 'kk' ? 'Пікір қосу…' : 'Добавить комментарий…'}
          placeholderTextColor={colors.muted}
          style={[styles.commentInput, { color: colors.text }]}
          value={body}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === 'kk' ? 'Жіберу' : 'Отправить'}
          onPress={submitComment}
          disabled={commentLoading}
          style={[styles.send, { backgroundColor: colors.text }]}
        >
          <Ionicons name="arrow-up" size={18} color={colors.surface} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, padding: 20, justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 60, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' },
  ownerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  ownerButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heading: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  comment: { borderRadius: 22, borderCurve: 'continuous', padding: 15, gap: 6 },
  commentAuthor: { fontSize: 13, fontWeight: '800' },
  commentBody: { fontSize: 15, lineHeight: 21 },
  composer: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  commentInput: { flex: 1, maxHeight: 110, fontSize: 15 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 13, lineHeight: 18 },
});

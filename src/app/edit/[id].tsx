import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PostEditor } from '@/components/post-editor';
import { EmptyState } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { hasRemoteApi } from '@/lib/api';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, locale, loadPost, posts, updatePost } = useApp();
  const cachedPost = posts.find((item) => item.id === id);
  const [loading, setLoading] = useState(hasRemoteApi && !cachedPost);

  useEffect(() => {
    if (!hasRemoteApi) return;
    let cancelled = false;
    void loadPost(String(id))
      .then((result) => {
        if (!cancelled && result) setLoading(false);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadPost]);

  const post = posts.find((item) => item.id === id);

  if (loading)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );

  if (!post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background }}>
        <EmptyState
          title={locale === 'kk' ? 'Сигнал табылмады' : 'Сигнал не найден'}
          text={locale === 'kk' ? 'Профильге оралып көріңіз.' : 'Вернитесь в профиль и попробуйте снова.'}
        />
      </View>
    );
  }

  return (
    <PostEditor
      initial={post}
      submitLabel={locale === 'kk' ? 'Өзгерістерді сақтау' : 'Сохранить изменения'}
      onSubmit={async (draft) => {
        await updatePost(post.id, draft);
        router.back();
      }}
    />
  );
}

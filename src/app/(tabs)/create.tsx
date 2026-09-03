import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PostEditor } from '@/components/post-editor';
import { PrimaryButton, ScreenTitle } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';

export default function CreateScreen() {
  const router = useRouter();
  const { addPost, colors, locale, session } = useApp();

  if (!session) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <ScreenTitle
          eyebrow={locale === 'kk' ? 'Сіздің даусыңыз' : 'Ваш голос'}
          title={locale === 'kk' ? 'Сигнал жасаңыз' : 'Создайте сигнал'}
        />
        <Text style={[styles.gateText, { color: colors.muted }]}>
          {locale === 'kk'
            ? 'Ой, сұрақ немесе прогресс жариялау үшін кіріңіз.'
            : 'Войдите, чтобы публиковать инсайты, вопросы и прогресс.'}
        </Text>
        <PrimaryButton title={locale === 'kk' ? 'Кіру' : 'Войти'} onPress={() => router.push('/auth')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.editorHeader}>
        <ScreenTitle
          eyebrow={locale === 'kk' ? 'Бүгінгі қадам' : 'Шаг сегодня'}
          title={locale === 'kk' ? 'Жаңа сигнал' : 'Новый сигнал'}
        />
      </View>
      <PostEditor
        submitLabel={locale === 'kk' ? 'Жариялау' : 'Опубликовать'}
        onSubmit={async (draft) => {
          const post = await addPost(draft);
          router.push({ pathname: '/post/[id]', params: { id: post.id } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, paddingHorizontal: 22, justifyContent: 'center', gap: 20 },
  gateText: { fontSize: 16, lineHeight: 23, maxWidth: 440 },
  editorHeader: { paddingHorizontal: 22, paddingTop: 24 },
});

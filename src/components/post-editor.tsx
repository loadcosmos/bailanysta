import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { POST_BODY_MAX, POST_BODY_MIN } from '@/lib/validation';
import type { AiSuggestion } from '@/types/ai';
import type { PostDraft, SignalType, Topic } from '@/types/social';

const types: SignalType[] = ['insight', 'question', 'progress', 'resource'];
const topics: Topic[] = ['Наука', 'AI', 'ЗОЖ', 'Бизнес', 'Карьера'];
const typeCopy = {
  insight: ['Инсайт', 'Ой'],
  question: ['Вопрос', 'Сұрақ'],
  progress: ['Прогресс', 'Прогресс'],
  resource: ['Ресурс', 'Ресурс'],
} as const;

export function PostEditor({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: PostDraft;
  submitLabel: string;
  onSubmit: (draft: PostDraft) => Promise<void>;
}) {
  const { aiAssist, colors, locale } = useApp();
  const [type, setType] = useState<SignalType>(initial?.type ?? 'insight');
  const [topic, setTopic] = useState<Topic>(initial?.topic ?? 'AI');
  const [body, setBody] = useState(initial?.body ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion>();

  function normalizedTags() {
    return tags
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 5);
  }

  async function submit() {
    if (body.trim().length < POST_BODY_MIN) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        type,
        topic,
        body: body.trim(),
        tags: normalizedTags(),
        link: link.trim() || undefined,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить сигнал');
    } finally {
      setSaving(false);
    }
  }

  async function assistWithDraft() {
    setAiLoading(true);
    setAiError('');
    try {
      const suggestion = await aiAssist(
        { body: body.trim(), topic, type, tags: normalizedTags() },
        body.trim().length >= POST_BODY_MIN ? 'improve' : 'generate',
      );
      setAiSuggestion(suggestion);
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : 'AI пока недоступен');
    } finally {
      setAiLoading(false);
    }
  }

  function applySuggestion() {
    if (!aiSuggestion) return;
    setBody(aiSuggestion.body);
    setTopic(aiSuggestion.topic);
    setType(aiSuggestion.type);
    setTags(aiSuggestion.tags.join(', '));
    setAiSuggestion(undefined);
    setAiError('');
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
    >
      <Text style={[styles.label, { color: colors.muted }]}>
        {locale === 'kk' ? 'Сигнал түрі' : 'Тип сигнала'}
      </Text>
      <View style={styles.wrap}>
        {types.map((item) => {
          const active = item === type;
          return (
            <Pressable
              key={item}
              onPress={() => setType(item)}
              style={[
                styles.pill,
                { backgroundColor: active ? colors.text : colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: active ? colors.surface : colors.text, fontWeight: '700' }}>
                {typeCopy[item][locale === 'kk' ? 1 : 0]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>{locale === 'kk' ? 'Тақырып' : 'Сфера'}</Text>
      <View style={styles.wrap}>
        {topics.map((item) => (
          <Pressable
            key={item}
            onPress={() => setTopic(item)}
            style={[
              styles.pill,
              {
                backgroundColor: item === topic ? colors.cyanSoft : colors.surface,
                borderColor: item === topic ? colors.cyan : colors.border,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>
        {locale === 'kk' ? 'Не бөліскіңіз келеді?' : 'Чем хотите поделиться?'}
      </Text>
      <TextInput
        multiline
        maxLength={POST_BODY_MAX}
        onChangeText={setBody}
        placeholder={
          locale === 'kk' ? 'Нақты ой, сұрақ немесе прогресс…' : 'Конкретная мысль, вопрос или прогресс…'
        }
        placeholderTextColor={colors.muted}
        selectionColor={colors.cyan}
        style={[
          styles.textarea,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        value={body}
      />
      <Text style={[styles.counter, { color: colors.muted }]}>{body.length}/{POST_BODY_MAX}</Text>

      <Pressable
        accessibilityLabel={locale === 'kk' ? 'AI көмегімен сигнал жазу' : 'Помочь написать сигнал с AI'}
        accessibilityRole="button"
        disabled={aiLoading || saving}
        onPress={() => void assistWithDraft()}
        style={({ pressed }) => [
          styles.aiButton,
          { backgroundColor: colors.softSurface, borderColor: colors.border },
          (pressed || aiLoading) && { opacity: 0.65 },
        ]}
      >
        <Ionicons name="sparkles-outline" size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          {aiLoading
            ? locale === 'kk'
              ? 'AI ойлануда…'
              : 'AI формулирует…'
            : locale === 'kk'
              ? 'AI көмегімен жазу'
              : 'Помочь с текстом'}
        </Text>
      </Pressable>

      {!!aiError && (
        <Text selectable accessibilityRole="alert" style={{ color: colors.coral }}>
          {aiError}
        </Text>
      )}

      {aiSuggestion && (
        <View style={[styles.aiPreview, { backgroundColor: colors.softSurface, borderColor: colors.border }]}>
          <View style={styles.aiPreviewHeader}>
            <View style={styles.aiPreviewTitle}>
              <Ionicons name="sparkles" size={17} color={colors.text} />
              <Text selectable style={{ color: colors.text, fontWeight: '800' }}>
                {locale === 'kk' ? 'AI нұсқасы' : 'Черновик от AI'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={locale === 'kk' ? 'AI нұсқасын жабу' : 'Закрыть AI-черновик'}
              accessibilityRole="button"
              onPress={() => setAiSuggestion(undefined)}
            >
              <Ionicons name="close" size={19} color={colors.muted} />
            </Pressable>
          </View>
          <Text selectable style={[styles.aiBody, { color: colors.text }]}>
            {aiSuggestion.body}
          </Text>
          <Text selectable style={[styles.aiMeta, { color: colors.muted }]}>
            {aiSuggestion.topic} · {typeCopy[aiSuggestion.type][locale === 'kk' ? 1 : 0]}
            {aiSuggestion.tags.length ? ` · ${aiSuggestion.tags.map((tag) => `#${tag}`).join(' ')}` : ''}
          </Text>
          <Pressable
            accessibilityLabel={locale === 'kk' ? 'AI нұсқасын қолдану' : 'Применить AI-черновик'}
            accessibilityRole="button"
            onPress={applySuggestion}
            style={({ pressed }) => [styles.aiApply, { backgroundColor: colors.text }, pressed && { opacity: 0.75 }]}
          >
            <Text style={{ color: colors.surface, fontWeight: '800' }}>
              {locale === 'kk' ? 'Қолдану' : 'Применить'}
            </Text>
          </Pressable>
          <Text selectable style={[styles.aiDisclosure, { color: colors.muted }]}>
            {locale === 'kk'
              ? 'Жарияламас бұрын мәтінді өзіңіз тексеріңіз.'
              : 'Проверьте текст сами перед публикацией.'}
          </Text>
        </View>
      )}

      <TextInput
        autoCapitalize="none"
        onChangeText={setTags}
        placeholder={locale === 'kk' ? 'Тегтер үтір арқылы' : 'Теги через запятую'}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        value={tags}
      />
      <TextInput
        autoCapitalize="none"
        keyboardType="url"
        onChangeText={setLink}
        placeholder={locale === 'kk' ? 'Сілтеме (міндетті емес)' : 'Ссылка (необязательно)'}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        value={link}
      />

      {!!error && (
        <Text selectable accessibilityRole="alert" style={{ color: colors.coral }}>
          {error}
        </Text>
      )}

      <PrimaryButton
        disabled={body.trim().length < POST_BODY_MIN}
        loading={saving}
        onPress={submit}
        title={submitLabel}
        icon="paperplane.fill"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 120, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  textarea: {
    minHeight: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    borderCurve: 'continuous',
    padding: 18,
    fontSize: 19,
    lineHeight: 27,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, fontVariant: ['tabular-nums'] },
  input: {
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 27,
    paddingHorizontal: 18,
    fontSize: 15,
  },
  aiButton: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 16,
    gap: 10,
  },
  aiPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiPreviewTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiBody: { fontSize: 16, lineHeight: 23 },
  aiMeta: { fontSize: 12, lineHeight: 18 },
  aiApply: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  aiDisclosure: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});

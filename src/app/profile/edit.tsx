import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors, locale, session, updateProfile } = useApp();
  const [name, setName] = useState(session?.user.name ?? '');
  const [handle, setHandle] = useState(session?.user.handle ?? '');
  const [bio, setBio] = useState(session?.user.bio ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateProfile({ name, handle, bio });
      router.back();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : locale === 'kk'
            ? 'Профильді сақтау мүмкін болмады'
            : 'Не удалось сохранить профиль',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!session)
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>
          {locale === 'kk' ? 'Аккаунтқа кіріңіз' : 'Нужно войти в аккаунт'}
        </Text>
      </View>
    );
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {locale === 'kk' ? 'Профильді өңдеу' : 'Редактировать профиль'}
      </Text>
      <Text style={[styles.label, { color: colors.muted }]}>{locale === 'kk' ? 'Аты' : 'Имя'}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={locale === 'kk' ? 'Атыңыз' : 'Ваше имя'}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
      <Text style={[styles.label, { color: colors.muted }]}>Handle</Text>
      <TextInput
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        placeholder="your_handle"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
      <Text style={[styles.label, { color: colors.muted }]}>Bio</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={180}
        placeholder={locale === 'kk' ? 'Өзіңіз туралы' : 'О чём вы'}
        placeholderTextColor={colors.muted}
        style={[
          styles.bioInput,
          { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.coral }}>
          {error}
        </Text>
      )}
      <PrimaryButton
        loading={saving}
        onPress={save}
        title={locale === 'kk' ? 'Сақтау' : 'Сохранить'}
        icon="checkmark"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, gap: 12, maxWidth: 620, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontStyle: 'italic', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 5 },
  input: {
    minHeight: 54,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  bioInput: {
    minHeight: 130,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const iconMap: Record<string, IconName> = {
  'arrow.right': 'arrow-forward',
  'paperplane.fill': 'paper-plane',
  checkmark: 'checkmark',
  sparkles: 'sparkles',
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.text, opacity: disabled ? 0.4 : pressed ? 0.76 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.surface} />
      ) : (
        <>
          {icon && <Ionicons name={iconMap[icon] ?? (icon as IconName)} size={18} color={colors.surface} />}
          <Text style={[styles.buttonText, { color: colors.surface }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ScreenTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow && <Text style={[styles.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>}
        <Text selectable style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

export function EmptyState({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  const { colors } = useApp();
  return (
    <View style={[styles.empty, compact && styles.compactEmpty, { backgroundColor: colors.softSurface }]}>
      <Ionicons name="sparkles-outline" size={28} color={colors.text} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, compact && styles.compactEmptyText, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 28,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '500',
    letterSpacing: -1.2,
  },
  empty: {
    minHeight: 210,
    borderRadius: 28,
    borderCurve: 'continuous',
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  compactEmpty: { minHeight: 120, padding: 12, justifyContent: 'flex-start', gap: 6 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  compactEmptyText: { maxWidth: 500 },
});

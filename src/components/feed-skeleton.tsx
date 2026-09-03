import { StyleSheet, View } from 'react-native';

import { useApp } from '@/context/app-context';

export function FeedSkeleton() {
  const { colors } = useApp();
  return (
    <View style={{ gap: 18 }}>
      {[0, 1].map((item) => (
        <View key={item} style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: colors.softSurface }]} />
            <View style={{ gap: 8, flex: 1 }}>
              <View style={[styles.line, { width: '46%', backgroundColor: colors.softSurface }]} />
              <View style={[styles.line, { width: '28%', backgroundColor: colors.softSurface }]} />
            </View>
          </View>
          <View style={[styles.image, { backgroundColor: colors.softSurface }]} />
          <View style={[styles.line, { width: '92%', backgroundColor: colors.softSurface }]} />
          <View style={[styles.line, { width: '70%', backgroundColor: colors.softSurface }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 14,
    borderRadius: 28,
    borderCurve: 'continuous',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  image: { width: '100%', aspectRatio: 1.25, borderRadius: 22, borderCurve: 'continuous' },
  line: { height: 11, borderRadius: 7 },
});

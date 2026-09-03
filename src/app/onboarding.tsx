import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui-kit';
import { useApp } from '@/context/app-context';
import { appImages } from '@/data/demo';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { colors, completeOnboarding, locale } = useApp();

  function start() {
    completeOnboarding();
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <View style={[styles.photoWrap, { height: Math.max(420, height * 0.61) }]}>
        <Image source={appImages.hero} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.22)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.brand, { top: insets.top + 12 }]}>Bailanysta</Text>
        <Text style={[styles.photoNote, { bottom: 28 }]}>
          {locale === 'kk' ? 'Бірге өсу оңайырақ.' : 'Расти проще вместе.'}
        </Text>
      </View>
      <View style={[styles.panel, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 18 }]}>
        <Text selectable style={[styles.title, { color: colors.text }]}>
          {locale === 'kk' ? 'Ойыңызды бөлісіңіз.\nӨзіңізді табыңыз.' : 'Делитесь идеями.\nНаходите своих.'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {locale === 'kk'
            ? 'Ғылым, технология, денсаулық және өмірді жақсартатын шағын қадамдар туралы тірі орта.'
            : 'Живое сообщество о науке, технологиях, здоровье и маленьких шагах, которые меняют жизнь.'}
        </Text>
        <PrimaryButton
          title={locale === 'kk' ? 'Зерттеуді бастау' : 'Начать исследовать'}
          onPress={start}
          icon="arrow.right"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photoWrap: { margin: 10, borderRadius: 34, borderCurve: 'continuous', overflow: 'hidden' },
  brand: {
    position: 'absolute',
    left: 22,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  photoNote: { position: 'absolute', left: 22, right: 22, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  panel: { flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 14, justifyContent: 'center' },
  title: { fontSize: 36, lineHeight: 40, letterSpacing: -1.5, fontStyle: 'italic', fontWeight: '500' },
  subtitle: { fontSize: 15, lineHeight: 21, maxWidth: 560 },
});

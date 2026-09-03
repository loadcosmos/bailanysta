import 'react-native-url-polyfill/auto';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AppProvider, useApp } from '@/context/app-context';

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { ready, theme, colors } = useApp();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  const base = theme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text },
      }}
    >
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{ presentation: 'formSheet', title: 'Bailanysta', sheetGrabberVisible: true }}
        />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="auth/reset" options={{ title: 'Bailanysta' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Профиль' }} />
        <Stack.Screen name="profile/[id]" options={{ title: 'Профиль' }} />
        <Stack.Screen name="notifications" options={{ title: 'Уведомления' }} />
        <Stack.Screen name="admin" options={{ title: 'Модерация' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Сигнал' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Редактировать' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <Navigation />
    </AppProvider>
  );
}

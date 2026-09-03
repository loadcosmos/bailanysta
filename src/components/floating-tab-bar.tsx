import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';

const tabs = {
  index: { ru: 'Лента', kk: 'Таспа', icon: 'home-outline', activeIcon: 'home' },
  discover: { ru: 'Поиск', kk: 'Іздеу', icon: 'search-outline', activeIcon: 'search' },
  create: { ru: 'Создать', kk: 'Жасау', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  profile: { ru: 'Профиль', kk: 'Профиль', icon: 'person-outline', activeIcon: 'person' },
} as const;

type TabBar = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
type FloatingTabBarProps = Parameters<TabBar>[0];

export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, locale } = useApp();

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 10), pointerEvents: 'box-none' }]}>
      <View style={[styles.bar, { backgroundColor: colors.nav, boxShadow: `0 12px 30px ${colors.shadow}` }]}>
        {state.routes.map((route, index) => {
          const tab = tabs[route.name as keyof typeof tabs];
          if (!tab) return null;
          const focused = state.index === index;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={locale === 'kk' ? tab.kk : tab.ru}
              key={route.key}
              onPress={() => {
                if (Platform.OS === 'ios') Haptics.selectionAsync();
                navigation.navigate(route.name, route.params);
              }}
              style={[styles.item, focused && { backgroundColor: colors.surface }]}
            >
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={20}
                color={focused ? colors.text : colors.navText}
              />
              <Text
                numberOfLines={1}
                style={[styles.label, { color: focused ? colors.text : colors.navText }]}
              >
                {locale === 'kk' ? tab.kk : tab.ru}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 430,
    minHeight: 64,
    padding: 6,
    borderRadius: 34,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    minHeight: 52,
    borderRadius: 28,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});

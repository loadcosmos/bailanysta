import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { darkColors, lightColors } from '@/constants/bailanysta-theme';
import { demoPosts, demoUser } from '@/data/demo';
import { api, ApiError, hasRemoteApi } from '@/lib/api';
import { appendUnique, feedFailurePosts, type Locale, upsertById } from '@/lib/app-logic';
import {
  isSessionForMode,
  parseSupabaseAuthRedirect,
  sessionStorageKey,
  type RuntimeMode,
} from '@/lib/auth-logic';
import type { AiAssistMode, AiDraft, AiSuggestion } from '@/types/ai';
import type { Notification, Post, PostDraft, Session, SocialUser } from '@/types/social';

type ThemeMode = 'light' | 'dark';
type AuthResult = { pending: boolean; message?: string };

type AppContextValue = {
  ready: boolean;
  loading: boolean;
  onboarded: boolean;
  locale: Locale;
  theme: ThemeMode;
  colors: typeof lightColors;
  session?: Session;
  posts: Post[];
  feedError: string;
  loadingMore: boolean;
  notifications: Notification[];
  completeOnboarding: () => void;
  changeLocale: (locale: Locale) => void;
  changeTheme: (theme: ThemeMode) => void;
  signIn: (mode: 'signin' | 'signup', email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  updatePassword: (password: string) => Promise<void>;
  resetPassword: (password: string, accessToken: string) => Promise<void>;
  aiAssist: (draft: AiDraft, mode: AiAssistMode) => Promise<AiSuggestion>;
  consumeGoogleHandoff: (handoff: string) => Promise<void>;
  refreshSession: () => Promise<Session | undefined>;
  signOut: () => Promise<void>;
  updateProfile: (profile: { name: string; handle: string; bio: string }) => Promise<SocialUser>;
  followUser: (userId: string) => Promise<{ following: boolean; followers: number }>;
  getFollowStatus: (userId: string) => Promise<{ following: boolean; followers: number }>;
  loadNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  loadPost: (id: string) => Promise<Post | undefined>;
  reloadFeed: () => Promise<void>;
  addPost: (draft: PostDraft) => Promise<Post>;
  updatePost: (id: string, draft: PostDraft) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  addComment: (postId: string, body: string) => Promise<void>;
  adminList: (resource: 'users' | 'posts' | 'comments' | 'events', query?: string) => Promise<unknown>;
  adminModerate: (payload: {
    action: 'hide' | 'restore' | 'delete' | 'block' | 'unblock';
    targetType: 'user' | 'post' | 'comment';
    targetId: string;
  }) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
const SETTINGS_KEY = 'bailanysta-settings';
const runtimeMode: RuntimeMode = hasRemoteApi ? 'remote' : 'demo';
const TOKEN_KEY = sessionStorageKey(runtimeMode);

async function readSession() {
  try {
    const value =
      Platform.OS === 'web'
        ? await AsyncStorage.getItem(TOKEN_KEY)
        : await SecureStore.getItemAsync(TOKEN_KEY);
    if (!value) return undefined;
    const parsed: unknown = JSON.parse(value);
    return isSessionForMode(parsed, runtimeMode) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function saveSession(session?: Session) {
  const value = session ? JSON.stringify(session) : null;
  if (Platform.OS === 'web') {
    if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } else if (value) {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

function readWebAuthRedirect() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || window.location.pathname !== '/') {
    return undefined;
  }
  return parseSupabaseAuthRedirect(window.location.href);
}

function clearWebAuthRedirect() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const cleanUrl = new URL(window.location.href);
  cleanUrl.hash = '';
  window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
}

function isSession(value: unknown): value is Session {
  return Boolean(value && typeof value === 'object' && 'accessToken' in value && 'user' in value);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [locale, setLocale] = useState<Locale>('ru');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [session, setSession] = useState<Session>();
  const [posts, setPosts] = useState<Post[]>(() => feedFailurePosts(hasRemoteApi, [], demoPosts));
  const [feedError, setFeedError] = useState('');
  const [nextCursor, setNextCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const sessionRef = useRef<Session | undefined>(undefined);
  const loadingMoreRef = useRef(false);
  const demoFollowingRef = useRef(new Set<string>());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const setActiveSession = useCallback(async (next?: Session) => {
    const normalized = next ? { ...next, runtime: runtimeMode } : undefined;
    sessionRef.current = normalized;
    setSession(normalized);
    await saveSession(normalized);
  }, []);

  const refreshSession = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.refreshToken || !hasRemoteApi) return undefined;
    const next = await api.refreshSession(current.refreshToken, current.provider);
    await setActiveSession(next);
    return next;
  }, [setActiveSession]);

  const withFreshToken = useCallback(
    async <T,>(work: (token: string) => Promise<T>) => {
      const current = sessionRef.current;
      if (!current?.accessToken) throw new Error('Нужно войти в аккаунт');
      try {
        return await work(current.accessToken);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        if (!current.refreshToken) {
          await setActiveSession(undefined);
          throw error;
        }
        try {
          const next = await refreshSession();
          if (!next) throw error;
          return await work(next.accessToken);
        } catch (refreshError) {
          await setActiveSession(undefined);
          throw refreshError;
        }
      }
    },
    [refreshSession, setActiveSession],
  );

  const loadFeed = useCallback(async () => {
    try {
      const current = sessionRef.current;
      const result = current
        ? await withFreshToken((token) => api.feed({ token }))
        : await api.feed();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setFeedError('');
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Не удалось загрузить ленту');
      setPosts((items) => feedFailurePosts(hasRemoteApi, items, demoPosts));
      setNextCursor(undefined);
    }
  }, [withFreshToken]);

  useEffect(() => {
    async function hydrate() {
      const [settings, storedSession] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEY),
        readSession(),
      ]);
      if (settings) {
        try {
          const parsed = JSON.parse(settings) as { onboarded?: boolean; locale?: Locale; theme?: ThemeMode };
          setOnboarded(Boolean(parsed.onboarded));
          if (parsed.locale === 'ru' || parsed.locale === 'kk') setLocale(parsed.locale);
          if (parsed.theme === 'light' || parsed.theme === 'dark') setTheme(parsed.theme);
        } catch {
          // A corrupt preference should not prevent the app from opening.
        }
      }

      let active = storedSession;
      const webAuthRedirect = hasRemoteApi ? readWebAuthRedirect() : undefined;
      if (webAuthRedirect?.accessToken && webAuthRedirect.refreshToken) {
        if (!active) {
          try {
            const result = await api.me(webAuthRedirect.accessToken);
            active = {
              accessToken: webAuthRedirect.accessToken,
              refreshToken: webAuthRedirect.refreshToken,
              expiresAt: webAuthRedirect.expiresAt,
              provider: 'password',
              runtime: runtimeMode,
              user: result.user,
            };
            await saveSession(active);
            clearWebAuthRedirect();
          } catch {
            // Keep the fragment so the start screen can explain why confirmation failed.
          }
        } else {
          clearWebAuthRedirect();
        }
      }
      if (
        hasRemoteApi &&
        active?.refreshToken &&
        active.expiresAt &&
        active.expiresAt * 1000 < Date.now() + 30_000
      ) {
        try {
          active = { ...(await api.refreshSession(active.refreshToken, active.provider)), runtime: runtimeMode };
          await saveSession(active);
        } catch {
          active = undefined;
          await saveSession();
        }
      }
      sessionRef.current = active;
      setSession(active);

      if (hasRemoteApi) {
        await loadFeed();
        const current = sessionRef.current;
        if (current) {
          try {
            const result = await api.notifications(current.accessToken);
            setNotifications(result.notifications);
          } catch {
            setNotifications([]);
          }
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      setLoading(false);
      setReady(true);
    }
    void hydrate();
  }, [loadFeed]);

  const persistSettings = useCallback(
    (next: { onboarded?: boolean; locale?: Locale; theme?: ThemeMode }) => {
      const value = {
        onboarded: next.onboarded ?? onboarded,
        locale: next.locale ?? locale,
        theme: next.theme ?? theme,
      };
      void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
    },
    [locale, onboarded, theme],
  );

  const completeOnboarding = useCallback(() => {
    setOnboarded(true);
    persistSettings({ onboarded: true });
  }, [persistSettings]);

  const changeLocale = useCallback(
    (value: Locale) => {
      setLocale(value);
      persistSettings({ locale: value });
    },
    [persistSettings],
  );

  const changeTheme = useCallback(
    (value: ThemeMode) => {
      setTheme(value);
      persistSettings({ theme: value });
    },
    [persistSettings],
  );

  const signIn = useCallback(
    async (mode: 'signin' | 'signup', email: string, password: string): Promise<AuthResult> => {
      if (!hasRemoteApi) {
        await setActiveSession({
          accessToken: 'demo-token',
          runtime: 'demo',
          user: { ...demoUser, name: email.split('@')[0] || demoUser.name },
        });
        return { pending: false };
      }
      const result = await api.authenticate(mode, email, password);
      if (!isSession(result)) return { pending: true, message: result.message };
      await setActiveSession(result);
      await loadFeed();
      return { pending: false };
    },
    [loadFeed, setActiveSession],
  );

  const consumeGoogleHandoff = useCallback(
    async (handoff: string) => {
      const next = await api.googleExchange(handoff);
      await setActiveSession(next);
      await loadFeed();
    },
    [loadFeed, setActiveSession],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!hasRemoteApi) {
      await setActiveSession({
        accessToken: 'demo-google-token',
        provider: 'google',
        runtime: 'demo',
        user: demoUser,
      });
      return;
    }
    const result = await api.googleStart(Platform.OS === 'web' ? 'web' : 'native');
    if (Platform.OS === 'web') {
      window.location.assign(result.url);
      return;
    }
    const { openAuthSessionAsync } = await import('expo-web-browser');
    const callback = await openAuthSessionAsync(result.url, 'bailanysta://auth/callback');
    if (callback.type === 'success' && callback.url) {
      const handoff = new URL(callback.url).searchParams.get('handoff');
      if (!handoff) throw new Error('Google не вернул ссылку входа');
      await consumeGoogleHandoff(handoff);
    }
  }, [consumeGoogleHandoff, setActiveSession]);

  const forgotPassword = useCallback(async (email: string) => {
    if (!hasRemoteApi) return 'В demo mode письмо не отправляется';
    return (await api.forgotPassword(email)).message;
  }, []);

  const updatePassword = useCallback(
    async (password: string) => {
      await withFreshToken((token) => api.updatePassword(password, token));
    },
    [withFreshToken],
  );

  const resetPassword = useCallback(async (password: string, accessToken: string) => {
    if (!hasRemoteApi) return;
    await api.updatePassword(password, accessToken);
  }, []);

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    if (current && hasRemoteApi) {
      try {
        await api.signOut(current.accessToken);
      } catch {
        /* local cleanup still matters */
      }
    }
    await setActiveSession(undefined);
    setNotifications([]);
    demoFollowingRef.current.clear();
    if (hasRemoteApi) await loadFeed();
  }, [loadFeed, setActiveSession]);

  const updateProfile = useCallback(
    async (profile: { name: string; handle: string; bio: string }) => {
      const current = sessionRef.current;
      if (!current) throw new Error('Нужно войти в аккаунт');
      const user = hasRemoteApi
        ? (await withFreshToken((token) => api.updateMe(profile, token))).user
        : { ...current.user, ...profile };
      const next = { ...current, user };
      await setActiveSession(next);
      setPosts((items) =>
        items.map((post) => (post.author.id === user.id ? { ...post, author: user } : post)),
      );
      return user;
    },
    [setActiveSession, withFreshToken],
  );

  const followUser = useCallback(
    async (userId: string) => {
      const current = sessionRef.current;
      if (!current) throw new Error('Нужно войти в аккаунт');
      if (hasRemoteApi) {
        const result = await withFreshToken((token) => api.toggleFollow(userId, token));
        const next = {
          ...current,
          user: {
            ...current.user,
            following: Math.max(0, (current.user.following ?? 0) + (result.following ? 1 : -1)),
          },
        };
        await setActiveSession(next);
        return result;
      }
      const following = !demoFollowingRef.current.has(userId);
      if (following) demoFollowingRef.current.add(userId);
      else demoFollowingRef.current.delete(userId);
      return { following, followers: 0 };
    },
    [setActiveSession, withFreshToken],
  );

  const getFollowStatus = useCallback(
    async (userId: string) => {
      const current = sessionRef.current;
      if (!current) return { following: false, followers: 0 };
      if (hasRemoteApi) return withFreshToken((token) => api.followStatus(userId, token));
      return { following: demoFollowingRef.current.has(userId), followers: 0 };
    },
    [withFreshToken],
  );

  const loadNotifications = useCallback(async () => {
    if (!sessionRef.current || !hasRemoteApi) return;
    const result = await withFreshToken((token) => api.notifications(token));
    setNotifications(result.notifications);
  }, [withFreshToken]);

  const markNotificationsRead = useCallback(async () => {
    if (!sessionRef.current || !hasRemoteApi) {
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      );
      return;
    }
    const result = await withFreshToken((token) => api.markNotificationsRead(token));
    setNotifications(result.notifications);
  }, [withFreshToken]);

  const loadMorePosts = useCallback(async () => {
    const cursor = nextCursor;
    if (!hasRemoteApi || !cursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const current = sessionRef.current;
      const result = current
        ? await withFreshToken((token) => api.feed({ cursor, token }))
        : await api.feed({ cursor });
      setPosts((items) => appendUnique(items, result.posts));
      setNextCursor(result.nextCursor);
    } catch {
      setFeedError('Не удалось загрузить следующие сигналы');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, withFreshToken]);

  const reloadFeed = useCallback(async () => {
    await loadFeed();
  }, [loadFeed]);

  const loadPost = useCallback(
    async (id: string) => {
      if (!hasRemoteApi) return undefined;
      const current = sessionRef.current;
      const result = current
        ? await withFreshToken((token) => api.post(id, token))
        : await api.post(id);
      setPosts((items) => upsertById(items, result.post));
      return result.post;
    },
    [withFreshToken],
  );

  const addPost = useCallback(
    async (draft: PostDraft) => {
      const current = sessionRef.current;
      if (!current && hasRemoteApi) throw new Error('Нужно войти в аккаунт');
      const post =
        current && hasRemoteApi
          ? (await withFreshToken((token) => api.createPost(draft, token))).post
          : {
              id: `local-${Date.now()}`,
              author: current?.user ?? demoUser,
              ...draft,
              createdAt: new Date().toISOString(),
              likes: 0,
              liked: false,
              comments: [],
            };
      setPosts((items) => [post, ...items]);
      return post;
    },
    [withFreshToken],
  );

  const aiAssist = useCallback(
    async (draft: AiDraft, mode: AiAssistMode) => {
      if (!sessionRef.current) throw new Error('Нужно войти в аккаунт');
      if (!hasRemoteApi) throw new Error('AI-помощник доступен в remote-режиме после настройки ключа');
      const result = await withFreshToken((token) => api.aiAssist(draft, mode, locale, token));
      return result.suggestion;
    },
    [locale, withFreshToken],
  );

  const updatePost = useCallback(
    async (id: string, draft: PostDraft) => {
      if (hasRemoteApi) await withFreshToken((token) => api.updatePost(id, draft, token));
      setPosts((items) => items.map((post) => (post.id === id ? { ...post, ...draft } : post)));
    },
    [withFreshToken],
  );

  const deletePost = useCallback(
    async (id: string) => {
      if (hasRemoteApi) await withFreshToken((token) => api.deletePost(id, token));
      setPosts((items) => items.filter((post) => post.id !== id));
    },
    [withFreshToken],
  );

  const toggleLike = useCallback(
    async (id: string) => {
      if (!sessionRef.current) throw new Error('Нужно войти в аккаунт');
      if (hasRemoteApi) {
        const post = posts.find((item) => item.id === id);
        const desired = post ? !post.liked : undefined;
        const result = await withFreshToken((token) => api.toggleLike(id, token, desired));
        setPosts((items) =>
          items.map((post) =>
            post.id === id ? { ...post, liked: result.liked, likes: result.likes } : post,
          ),
        );
        return;
      }
      setPosts((items) =>
        items.map((post) =>
          post.id === id ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post,
        ),
      );
    },
    [posts, withFreshToken],
  );

  const addComment = useCallback(
    async (postId: string, body: string) => {
      const current = sessionRef.current;
      if (!current) throw new Error('Нужно войти в аккаунт');
      const comment = hasRemoteApi
        ? (await withFreshToken((token) => api.addComment(postId, body, token))).comment
        : { id: `comment-${Date.now()}`, author: current.user, body, createdAt: new Date().toISOString() };
      setPosts((items) =>
        items.map((post) => (post.id === postId ? { ...post, comments: [...post.comments, comment] } : post)),
      );
    },
    [withFreshToken],
  );

  const adminList = useCallback(
    async (resource: 'users' | 'posts' | 'comments' | 'events', query = '') => {
      return withFreshToken((token) => api.adminList(resource, token, query));
    },
    [withFreshToken],
  );

  const adminModerate = useCallback(
    async (payload: {
      action: 'hide' | 'restore' | 'delete' | 'block' | 'unblock';
      targetType: 'user' | 'post' | 'comment';
      targetId: string;
    }) => {
      await withFreshToken((token) => api.adminModerate(payload, token));
    },
    [withFreshToken],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      loading,
      onboarded,
      locale,
      theme,
      colors: theme === 'dark' ? darkColors : lightColors,
      session,
      posts,
      feedError,
      loadingMore,
      notifications,
      completeOnboarding,
      changeLocale,
      changeTheme,
      signIn,
      signInWithGoogle,
      forgotPassword,
      updatePassword,
      resetPassword,
      aiAssist,
      consumeGoogleHandoff,
      refreshSession,
      signOut,
      updateProfile,
      followUser,
      getFollowStatus,
      loadNotifications,
      markNotificationsRead,
      loadMorePosts,
      loadPost,
      reloadFeed,
      addPost,
      updatePost,
      deletePost,
      toggleLike,
      addComment,
      adminList,
      adminModerate,
    }),
    [
      addComment,
      addPost,
      aiAssist,
      adminList,
      adminModerate,
      changeLocale,
      changeTheme,
      completeOnboarding,
      deletePost,
      forgotPassword,
      followUser,
      getFollowStatus,
      loadNotifications,
      loadMorePosts,
      loadPost,
      reloadFeed,
      feedError,
      loading,
      loadingMore,
      locale,
      markNotificationsRead,
      onboarded,
      notifications,
      posts,
      ready,
      refreshSession,
      session,
      signIn,
      signInWithGoogle,
      signOut,
      theme,
      toggleLike,
      updatePassword,
      resetPassword,
      consumeGoogleHandoff,
      updatePost,
      updateProfile,
    ],
  );

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp() {
  const value = React.use(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

import { Platform } from 'react-native';

import { getRuntimeConfig } from '@/lib/runtime-config';
import type { AiAssistMode, AiDraft, AiLocale, AiSuggestion } from '@/types/ai';
import type { Comment, Notification, Post, PostDraft, Session, SocialUser, Topic } from '@/types/social';

const runtimeConfig = getRuntimeConfig({
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS === 'web' ? 'web' : 'native',
});
const baseUrl = runtimeConfig.baseUrl;

export const hasRemoteApi = runtimeConfig.mode === 'remote';
export const apiConfigurationError = runtimeConfig.error;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string) {
  if (!hasRemoteApi) throw new Error('DEMO_MODE');
  if (apiConfigurationError) throw new ApiError(apiConfigurationError, 503, 'CONFIGURATION');

  const response = await fetch(`${baseUrl ?? ''}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || 'Не удалось выполнить запрос', response.status, data.code);
  return data as T;
}

type AuthResponse = Session | { pending: true; message: string };

export const api = {
  feed: (options: { cursor?: string; query?: string; topic?: Topic | 'Все'; token?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.query) params.set('q', options.query);
    if (options.topic && options.topic !== 'Все') params.set('topic', options.topic);
    return request<{ posts: Post[]; nextCursor?: string }>(
      `/feed${params.size ? `?${params.toString()}` : ''}`,
      {},
      options.token,
    );
  },
  authenticate: (mode: 'signin' | 'signup', email: string, password: string) =>
    request<AuthResponse>('/auth', {
      method: 'POST',
      body: JSON.stringify({ mode, email, password }),
    }),
  refreshSession: (refreshToken: string, provider: Session['provider'] = 'password') =>
    request<Session>('/auth/session/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, provider }),
    }),
  forgotPassword: (email: string, platform: 'web' | 'native' = Platform.OS === 'web' ? 'web' : 'native') =>
    request<{ ok: true; message: string }>('/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email, platform }),
    }),
  updatePassword: (password: string, token: string) =>
    request<{ ok: true }>('/auth/password', { method: 'POST', body: JSON.stringify({ password }) }, token),
  aiAssist: (draft: AiDraft, mode: AiAssistMode, locale: AiLocale, token: string) =>
    request<{ suggestion: AiSuggestion; disclosure: 'ai_draft' }>(
      '/ai',
      { method: 'POST', body: JSON.stringify({ action: 'draft-assist', mode, locale, draft }) },
      token,
    ),
  signOut: (token: string) => request<{ ok: true }>('/auth/signout', { method: 'POST' }, token),
  googleStart: (platform: 'web' | 'native' = Platform.OS === 'web' ? 'web' : 'native') =>
    request<{ url: string; platform: 'web' | 'native' }>(`/auth/google/start?platform=${platform}`),
  googleExchange: (handoff: string) =>
    request<Session>('/auth/google/exchange', { method: 'POST', body: JSON.stringify({ handoff }) }),
  me: (token: string) => request<{ user: SocialUser }>('/me', {}, token),
  updateMe: (profile: { name: string; handle: string; bio: string }, token: string) =>
    request<{ user: SocialUser }>('/me', { method: 'PATCH', body: JSON.stringify(profile) }, token),
  users: (query = '') =>
    request<{ users: SocialUser[] }>(`/users${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  user: (id: string, token?: string) =>
    request<{ user: SocialUser; posts: Post[]; nextCursor?: string }>(
      `/users?id=${encodeURIComponent(id)}`,
      {},
      token,
    ),
  toggleFollow: (userId: string, token: string) =>
    request<{ following: boolean; followers: number }>(
      '/follows',
      { method: 'POST', body: JSON.stringify({ userId }) },
      token,
    ),
  followStatus: (userId: string, token: string) =>
    request<{ following: boolean; followers: number }>(
      `/follows?userId=${encodeURIComponent(userId)}`,
      {},
      token,
    ),
  notifications: (token: string) => request<{ notifications: Notification[] }>('/notifications', {}, token),
  markNotificationsRead: (token: string) =>
    request<{ notifications: Notification[] }>('/notifications', { method: 'POST' }, token),
  createPost: (draft: PostDraft, token: string) =>
    request<{ post: Post }>('/posts', { method: 'POST', body: JSON.stringify(draft) }, token),
  updatePost: (id: string, draft: PostDraft, token: string) =>
    request<{ post: Post }>('/posts', { method: 'PUT', body: JSON.stringify({ id, ...draft }) }, token),
  deletePost: (id: string, token: string) =>
    request<{ ok: true }>(`/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  post: (id: string, token?: string) =>
    request<{ post: Post }>(`/posts?id=${encodeURIComponent(id)}`, {}, token),
  toggleLike: (postId: string, token: string, liked?: boolean) =>
    request<{ liked: boolean; likes: number }>(
      '/likes',
      { method: 'POST', body: JSON.stringify({ postId, ...(liked === undefined ? {} : { liked }) }) },
      token,
    ),
  addComment: (postId: string, body: string, token: string) =>
    request<{ comment: Comment }>(
      '/comments',
      { method: 'POST', body: JSON.stringify({ postId, body }) },
      token,
    ),
  adminList: (resource: 'users' | 'posts' | 'comments' | 'events', token: string, query = '') =>
    request<{
      users?: SocialUser[];
      posts?: Post[];
      comments?: {
        id: string;
        post_id: string;
        body: string;
        status: string;
        created_at: string;
        profile?: SocialUser;
      }[];
      events?: { id: string; target_type: string; target_id: string; action: string; created_at: string }[];
    }>(`/admin?resource=${resource}${query ? `&q=${encodeURIComponent(query)}` : ''}`, {}, token),
  adminModerate: (
    payload: {
      action: 'hide' | 'restore' | 'delete' | 'block' | 'unblock';
      targetType: 'user' | 'post' | 'comment';
      targetId: string;
    },
    token: string,
  ) => request<{ ok: true }>('/admin', { method: 'POST', body: JSON.stringify(payload) }, token),
};

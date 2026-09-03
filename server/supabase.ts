import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { HttpError, optionalBearerToken } from './http.js';
import type { ApiRequest } from './http.js';
import { profileDraftFromAuth } from '../src/lib/auth-logic.js';
import type { Comment, Notification, Post, SocialUser } from '../src/types/social';

export type ProfileRow = {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: 'member' | 'admin';
  status: 'active' | 'blocked';
};

export type PostRow = {
  id: string;
  user_id: string;
  type: Post['type'];
  topic: Post['topic'];
  body: string;
  tags: string[] | null;
  image_url: string | null;
  link: string | null;
  status: Post['status'];
  created_at: string;
  updated_at?: string;
  profile?: ProfileRow | ProfileRow[];
};

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  status: 'visible' | 'hidden';
  created_at: string;
  profile?: ProfileRow | ProfileRow[];
};

export const profileSelect = 'id,name,handle,bio,avatar_url,cover_url,role,status';
export const postSelect =
  'id,user_id,type,topic,body,tags,image_url,link,status,created_at,updated_at,profile:profiles!posts_user_id_fkey(' +
  profileSelect +
  ')';

function env(name: 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY' | 'SUPABASE_SECRET_KEY') {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const supabaseUrl = () => env('SUPABASE_URL');
export const publishableKey = () => env('SUPABASE_PUBLISHABLE_KEY');

function makeClient(key: string, token?: string) {
  return createClient(env('SUPABASE_URL'), key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export function database(token?: string) {
  return makeClient(env('SUPABASE_PUBLISHABLE_KEY'), token);
}

export function privilegedDatabase() {
  return makeClient(env('SUPABASE_SECRET_KEY'));
}

export async function revokeSession(token: string, client = privilegedDatabase()) {
  const { error } = await client.auth.admin.signOut(token, 'global');
  if (error) throw error;
}

export async function updateUserPassword(
  userId: string,
  password: string,
  client = privilegedDatabase(),
) {
  const { error } = await client.auth.admin.updateUserById(userId, { password });
  if (error) throw error;
}

export function bearerToken(request: ApiRequest) {
  const token = optionalBearerToken(request.headers);
  if (!token) throw new Error('Нужно войти в аккаунт');
  return token;
}

export async function userFromToken(token: string, client = database(token)) {
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Сессия закончилась. Войдите снова');
  return data.user;
}

export async function activeUserFromToken(token: string, client = database(token)) {
  const user = await userFromToken(token, client);
  const profile = await ensureProfile(user, client);
  if (profile.status === 'blocked') throw new Error('Аккаунт заблокирован администратором');
  return { user, profile };
}

export async function currentUser(request: ApiRequest) {
  const token = bearerToken(request);
  const client = database(token);
  const { user, profile } = await activeUserFromToken(token, client);
  return { client, user, profile, token };
}

export async function currentAdmin(request: ApiRequest) {
  const auth = await currentUser(request);
  if (auth.profile.role !== 'admin') throw new Error('Нужны права администратора');
  return auth;
}

export function toUser(row?: ProfileRow | ProfileRow[]): SocialUser {
  const profile = Array.isArray(row) ? row[0] : row;
  if (!profile) return { id: 'unknown', name: 'Участник', handle: 'member', bio: '' };
  return {
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    bio: profile.bio ?? '',
    avatar: profile.avatar_url ?? undefined,
    cover: profile.cover_url ?? undefined,
    role: profile.role,
    status: profile.status,
  };
}

export async function ensureProfile(user: User, client = database()) {
  const { data: existing, error: lookupError } = await client
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) {
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const draft = profileDraftFromAuth({
      id: user.id,
      email: user.email,
      name: typeof metadata?.name === 'string' ? metadata.name : undefined,
      fullName: typeof metadata?.full_name === 'string' ? metadata.full_name : undefined,
    });
    const { error: insertError } = await client.from('profiles').insert({ id: user.id, ...draft });
    if (insertError && insertError.code !== '23505') throw insertError;
  }
  return readProfile(user.id, client);
}

async function readComments(client: SupabaseClient, ids: string[]) {
  if (!ids.length) return [] as CommentRow[];
  const { data, error } = await client
    .from('comments')
    .select(
      'id,post_id,user_id,body,status,created_at,profile:profiles!comments_user_id_fkey(' +
        profileSelect +
        ')',
    )
    .in('post_id', ids)
    .eq('status', 'visible')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentRow[];
}

function applyCursor<T extends { lt: (column: string, value: string) => T; or: (value: string) => T }>(
  query: T,
  cursor?: string,
) {
  if (!cursor) return query;
  const separator = cursor.indexOf('|');
  if (separator < 0) return query.lt('created_at', cursor);
  const createdAt = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  return query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
}

function cursorFor(row: PostRow) {
  return `${row.created_at}|${row.id}`;
}

async function hydratePostRows(rows: PostRow[], client: SupabaseClient, userId?: string) {
  if (!rows.length) return [] as Post[];
  const ids = rows.map((post) => post.id);
  const [{ data: likeRows, error: likeError }, comments] = await Promise.all([
    client.from('likes').select('post_id,user_id').in('post_id', ids),
    readComments(client, ids),
  ]);
  if (likeError) throw likeError;

  return rows.map((row) => {
    const rowComments: Comment[] = comments
      .filter((comment) => comment.post_id === row.id)
      .map((comment) => ({
        id: comment.id,
        author: toUser(comment.profile),
        body: comment.body,
        createdAt: comment.created_at,
      }));
    const likes = (likeRows ?? []).filter((like) => like.post_id === row.id);
    return {
      id: row.id,
      author: toUser(row.profile),
      type: row.type,
      topic: row.topic,
      body: row.body,
      tags: row.tags ?? [],
      image: row.image_url ?? undefined,
      link: row.link ?? undefined,
      status: row.status,
      createdAt: row.created_at,
      likes: likes.length,
      liked: Boolean(userId && likes.some((like) => like.user_id === userId)),
      comments: rowComments,
    } satisfies Post;
  });
}

export async function readFeed(
  options: { token?: string; cursor?: string; query?: string; topic?: string } = {},
) {
  const client = options.token ? database(options.token) : database();
  const active = options.token ? await activeUserFromToken(options.token, client) : undefined;
  const user = active?.user;
  const search = options.query?.trim();
  const pageSize = search ? 100 : 20;
  let query = client
    .from('posts')
    .select(postSelect)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize);
  query = applyCursor(query, options.cursor);
  if (options.topic && options.topic !== 'Все') query = query.eq('topic', options.topic);

  const { data: postRows, error: postError } = await query;
  if (postError) throw postError;
  const needle = search?.toLocaleLowerCase();
  const rawRows = (postRows ?? []) as unknown as PostRow[];
  const rows = rawRows.filter((row) => {
    if (!needle) return true;
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return [row.body, row.topic, ...(row.tags ?? []), profile?.name ?? '', profile?.handle ?? '']
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle);
  });
  const posts = await hydratePostRows(rows, client, user?.id);
  return {
    posts,
    nextCursor: rawRows.length === pageSize ? cursorFor(rawRows[rawRows.length - 1]) : undefined,
  };
}

export async function readUserPosts(
  userId: string,
  options: { token?: string; cursor?: string } = {},
) {
  const client = options.token ? database(options.token) : database();
  const active = options.token ? await activeUserFromToken(options.token, client) : undefined;
  let query = client
    .from('posts')
    .select(postSelect)
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(20);
  query = applyCursor(query, options.cursor);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as PostRow[];
  return {
    posts: await hydratePostRows(rows, client, active?.user.id),
    nextCursor: rows.length === 20 ? cursorFor(rows[rows.length - 1]) : undefined,
  };
}

export async function readPost(postId: string, token?: string) {
  const client = token ? database(token) : database();
  const active = token ? await activeUserFromToken(token, client) : undefined;
  const { data, error } = await client.from('posts').select(postSelect).eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Сигнал не найден');
  const [post] = await hydratePostRows([data as unknown as PostRow], client, active?.user.id);
  if (!post) throw new Error('Сигнал не найден');
  return post;
}

export async function readProfile(userId: string, client = database()) {
  const { data, error } = await client
    .from('profiles')
    .select(profileSelect)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError('Профиль не найден', 404, 'NOT_FOUND');
  const [{ count: followers, error: followersError }, { count: following, error: followingError }] =
    await Promise.all([
      client.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
  if (followersError) throw followersError;
  if (followingError) throw followingError;
  return { ...toUser(data as ProfileRow), followers: followers ?? 0, following: following ?? 0 };
}

export function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    author: toUser(row.profile),
    type: row.type,
    topic: row.topic,
    body: row.body,
    tags: row.tags ?? [],
    image: row.image_url ?? undefined,
    link: row.link ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    likes: 0,
    liked: false,
    comments: [],
  };
}

export async function readNotifications(userId: string, client: SupabaseClient) {
  const { data, error } = await client
    .from('notifications')
    .select(
      'id,kind,body,post_id,comment_id,read_at,created_at,actor:profiles!notifications_actor_id_fkey(' +
        profileSelect +
        ')',
    )
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    kind: Notification['kind'];
    body: string;
    post_id: string | null;
    comment_id: string | null;
    read_at: string | null;
    created_at: string;
    actor?: ProfileRow | ProfileRow[];
  }>;
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    actor: toUser(row.actor),
    postId: row.post_id ?? undefined,
    commentId: row.comment_id ?? undefined,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  })) as Notification[];
}

export async function isAdmin(user: User, client = database()) {
  const profile = await readProfile(user.id, client);
  return profile.role === 'admin' && profile.status === 'active';
}

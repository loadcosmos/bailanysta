import { allowMobile, fail, HttpError } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentAdmin, postSelect, profileSelect, rowToPost } from '../server/supabase';
import { parseModerationRequest } from '../server/moderation';
import type { CommentRow, PostRow } from '../server/supabase';

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET' && request.method !== 'POST')
    return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { client, user } = await currentAdmin(request);
    if (request.method === 'GET') {
      const resource = one(request.query.resource) ?? 'users';
      const q = one(request.query.q)
        ?.trim()
        .replace(/[^a-zA-Z0-9@А-Яа-яЁё .-]/g, '')
        .slice(0, 60);
      if (resource === 'users') {
        let query = client
          .from('profiles')
          .select(profileSelect)
          .order('created_at', { ascending: false })
          .limit(100);
        if (q) query = query.or(`name.ilike.%${q}%,handle.ilike.%${q}%`);
        const { data, error } = await query;
        if (error) throw error;
        return response.status(200).json({ users: data ?? [] });
      }
      if (resource === 'posts') {
        let query = client
          .from('posts')
          .select(postSelect)
          .order('created_at', { ascending: false })
          .limit(100);
        if (q) query = query.ilike('body', `%${q}%`);
        const { data, error } = await query;
        if (error) throw error;
        return response
          .status(200)
          .json({ posts: (data ?? []).map((row) => rowToPost(row as unknown as PostRow)) });
      }
      if (resource === 'comments') {
        let query = client
          .from('comments')
          .select(
            'id,post_id,user_id,body,status,created_at,profile:profiles!comments_user_id_fkey(' +
              profileSelect +
              ')',
          )
          .order('created_at', { ascending: false })
          .limit(100);
        if (q) query = query.ilike('body', `%${q}%`);
        const { data, error } = await query;
        if (error) throw error;
        return response.status(200).json({ comments: (data ?? []) as unknown as CommentRow[] });
      }
      const { data, error } = await client
        .from('moderation_events')
        .select('id,admin_id,target_type,target_id,action,metadata,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return response.status(200).json({ events: data ?? [] });
    }

    const { action, targetType, targetId } = parseModerationRequest(request.body ?? {});
    if (targetType === 'user' && targetId === user.id)
      throw new HttpError('Нельзя изменить статус собственного аккаунта', 403, 'FORBIDDEN');
    const { error } = await client.rpc('moderate_target', {
      p_action: action,
      p_target_id: targetId,
      p_target_type: targetType,
    });
    if (error) throw error;
    return response.status(200).json({ ok: true });
  } catch (error) {
    return fail(response, error);
  }
}

import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentUser } from '../server/supabase';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET' && request.method !== 'POST')
    return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const followingId = String(
      request.body?.userId ??
        (Array.isArray(request.query.userId) ? request.query.userId[0] : request.query.userId) ??
        '',
    ).trim();
    if (!followingId) throw new Error('Не указан пользователь');
    const { client, user } = await currentUser(request);
    if (followingId === user.id) throw new Error('Нельзя подписаться на себя');
    const { data: target, error: targetError } = await client
      .from('profiles')
      .select('id')
      .eq('id', followingId)
      .eq('status', 'active')
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw new Error('Пользователь недоступен');
    const { data: existing, error: lookupError } = await client
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', followingId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (request.method === 'GET') {
      const { count, error: countError } = await client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', followingId);
      if (countError) throw countError;
      return response.status(200).json({ following: Boolean(existing), followers: count ?? 0 });
    }
    if (existing) {
      const { error } = await client
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', followingId);
      if (error) throw error;
    } else {
      const { error } = await client
        .from('follows')
        .insert({ follower_id: user.id, following_id: followingId });
      if (error) throw error;
    }
    const { count, error: countError } = await client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', followingId);
    if (countError) throw countError;
    return response.status(200).json({ following: !existing, followers: count ?? 0 });
  } catch (error) {
    return fail(response, error);
  }
}

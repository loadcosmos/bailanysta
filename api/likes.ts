import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentUser } from '../server/supabase';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const postId = String(request.body?.postId ?? '');
    if (!postId) throw new Error('Не указан сигнал');
    const { client, user } = await currentUser(request);
    const { data: post, error: postError } = await client
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('status', 'published')
      .maybeSingle();
    if (postError) throw postError;
    if (!post) throw new Error('Сигнал недоступен для реакции');
    const { data: existing, error: lookupError } = await client
      .from('likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const requested = typeof request.body?.liked === 'boolean' ? request.body.liked : !existing;
    if (requested && !existing) {
      const { error } = await client
        .from('likes')
        .upsert(
          { post_id: postId, user_id: user.id },
          { onConflict: 'user_id,post_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    } else if (!requested && existing) {
      const { error } = await client.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
      if (error) throw error;
    }

    const { count, error: countError } = await client
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (countError) throw countError;
    return response.status(200).json({ liked: requested, likes: count ?? 0 });
  } catch (error) {
    return fail(response, error);
  }
}

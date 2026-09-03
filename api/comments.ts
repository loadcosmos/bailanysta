import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentUser, readProfile } from '../server/supabase';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const postId = String(request.body?.postId ?? '');
    const body = String(request.body?.body ?? '').trim();
    if (!postId || body.length < 1 || body.length > 500)
      throw new Error('Комментарий должен содержать от 1 до 500 символов');

    const { client, user } = await currentUser(request);
    const { data: post, error: postError } = await client
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('status', 'published')
      .maybeSingle();
    if (postError) throw postError;
    if (!post) throw new Error('Сигнал недоступен для комментариев');
    const { data, error } = await client
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, body })
      .select('id,body,created_at')
      .single();
    if (error) throw error;

    return response.status(201).json({
      comment: {
        id: data.id,
        author: await readProfile(user.id, client),
        body: data.body,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    return fail(response, error);
  }
}

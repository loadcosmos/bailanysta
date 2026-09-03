import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentUser, postSelect, readPost, rowToPost } from '../server/supabase';
import type { PostRow } from '../server/supabase';
import { parsePostDraft } from '../src/lib/validation';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, POST, PUT, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();

  if (request.method === 'GET') {
    try {
      const id = Array.isArray(request.query.id) ? request.query.id[0] : String(request.query.id ?? '');
      if (!id) throw new Error('Не указан сигнал');
      const auth = request.headers.authorization;
      const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
      return response.status(200).json({ post: await readPost(id, token) });
    } catch (error) {
      return fail(response, error);
    }
  }

  try {
    const { client, user } = await currentUser(request);

    if (request.method === 'POST') {
      const draft = parsePostDraft(request.body ?? {});
      const { data, error } = await client
        .from('posts')
        .insert({ user_id: user.id, ...draft })
        .select(postSelect)
        .single();
      if (error) throw error;
      return response.status(201).json({ post: rowToPost(data as unknown as PostRow) });
    }

    if (request.method === 'PUT') {
      const id = String(request.body?.id ?? '');
      if (!id) throw new Error('Не указан сигнал');
      const draft = parsePostDraft(request.body ?? {});
      const { data, error } = await client
        .from('posts')
        .update(draft)
        .eq('id', id)
        .eq('user_id', user.id)
        .select(postSelect)
        .single();
      if (error) throw error;
      return response.status(200).json({ post: rowToPost(data as unknown as PostRow) });
    }

    if (request.method === 'DELETE') {
      const id = Array.isArray(request.query.id) ? request.query.id[0] : String(request.query.id ?? '');
      if (!id) throw new Error('Не указан сигнал');
      const { data, error } = await client
        .from('posts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Сигнал не найден или недоступен');
      return response.status(200).json({ ok: true });
    }

    return response.status(405).json({ error: 'Метод не поддерживается' });
  } catch (error) {
    return fail(response, error);
  }
}

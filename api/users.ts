import { allowMobile, fail, optionalBearerToken } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { database, profileSelect, readProfile, readUserPosts, toUser } from '../server/supabase';
import type { ProfileRow } from '../server/supabase';

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const client = database();
    const id = one(request.query.id);
    if (id) {
      const user = await readProfile(id, client);
      const token = optionalBearerToken(request.headers);
      const posts = await readUserPosts(id, { token });
      return response.status(200).json({ user, posts: posts.posts, nextCursor: posts.nextCursor });
    }
    const q = one(request.query.q)
      ?.trim()
      .replace(/[^a-zA-Z0-9@А-Яа-яЁё .-]/g, '')
      .slice(0, 60);
    let query = client
      .from('profiles')
      .select(profileSelect)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(40);
    if (q) query = query.or(`name.ilike.%${q}%,handle.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return response
      .status(200)
      .json({ users: (data ?? []).map((row) => toUser(row as unknown as ProfileRow)) });
  } catch (error) {
    return fail(response, error);
  }
}

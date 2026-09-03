import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentUser, profileSelect, readProfile } from '../server/supabase';
import { validateProfileDraft } from '../src/lib/validation';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, PATCH, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET' && request.method !== 'PATCH')
    return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { client, user } = await currentUser(request);
    if (request.method === 'GET')
      return response.status(200).json({ user: await readProfile(user.id, client) });

    const draft = validateProfileDraft(request.body ?? {});
    const { data, error } = await client
      .from('profiles')
      .update(draft)
      .eq('id', user.id)
      .select(profileSelect)
      .single();
    if (error) throw error;
    return response.status(200).json({ user: await readProfile(data.id, client) });
  } catch (error) {
    return fail(response, error);
  }
}

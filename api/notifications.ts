import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { currentUser, readNotifications } from '../server/supabase';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET' && request.method !== 'POST')
    return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { client, user } = await currentUser(request);
    if (request.method === 'POST') {
      const { error } = await client
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .is('read_at', null);
      if (error) throw error;
    }
    return response.status(200).json({ notifications: await readNotifications(user.id, client) });
  } catch (error) {
    return fail(response, error);
  }
}

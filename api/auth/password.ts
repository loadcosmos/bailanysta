import { allowMobile, fail } from '../../server/http';
import type { ApiRequest, ApiResponse } from '../../server/http';
import { validateNewPassword } from '../../src/lib/auth-logic';
import { currentUser, updateUserPassword } from '../../server/supabase';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { user } = await currentUser(request);
    const password = validateNewPassword(String(request.body?.password ?? ''));
    await updateUserPassword(user.id, password);
    return response.status(200).json({ ok: true });
  } catch (error) {
    return fail(response, error);
  }
}

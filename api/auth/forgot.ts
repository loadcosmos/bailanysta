import { allowMobile, fail } from '../../server/http';
import type { ApiRequest, ApiResponse } from '../../server/http';
import { database } from '../../server/supabase';
import { normalizePlatform } from '../../src/lib/auth-logic';

function publicUrl() {
  const configured = process.env.AUTH_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:8081';
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const email = String(request.body?.email ?? '')
      .trim()
      .toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Введите корректный email');
    const platform = normalizePlatform(request.body?.platform);
    const redirectTo =
      platform === 'native'
        ? process.env.AUTH_RESET_NATIVE_URL || 'bailanysta://auth/reset'
        : process.env.AUTH_RESET_WEB_URL || `${publicUrl()}/auth/reset`;
    const { error } = await database().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    // Do not reveal whether an address is registered.
    return response
      .status(202)
      .json({ ok: true, message: 'Если такой email зарегистрирован, письмо уже отправлено' });
  } catch (error) {
    return fail(response, error);
  }
}

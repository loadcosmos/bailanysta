import { allowMobile, fail } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { handleAiRequest } from '../server/ai-route';
import { authErrorUrl, consumeHandoff, createGoogleStart, finishGoogleCallback } from '../server/oauth';
import { currentUser, database, ensureProfile, revokeSession } from '../server/supabase';
import { normalizePlatform } from '../src/lib/auth-logic';
import { validateCredentials } from '../src/lib/validation';

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function refresh(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });
  const refreshToken = String(request.body?.refreshToken ?? '').trim();
  if (!refreshToken) throw new Error('Нужен refresh token');
  const client = database();
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) throw error ?? new Error('Сессия закончилась. Войдите снова');
  const sessionClient = database(data.session.access_token);
  const user = await ensureProfile(data.user, sessionClient);
  if (user.status === 'blocked') throw new Error('Аккаунт заблокирован администратором');
  return response.status(200).json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    provider: request.body?.provider === 'google' ? 'google' : 'password',
    runtime: 'remote',
    user,
  });
}

async function signout(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });
  const { token } = await currentUser(request);
  await revokeSession(token);
  return response.status(200).json({ ok: true });
}

async function googleStart(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Метод не поддерживается' });
  return response.status(200).json(await createGoogleStart(request.query.platform));
}

async function googleExchange(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });
  const handoff = String(request.body?.handoff ?? '').trim();
  if (!handoff || handoff.length > 80) throw new Error('Некорректная ссылка входа');
  return response.status(200).json(await consumeHandoff(handoff));
}

async function googleCallback(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Метод не поддерживается' });
  const platform = normalizePlatform(one(request.query.platform));
  try {
    const code = one(request.query.code);
    const attempt = one(request.query.attempt);
    if (!code || !attempt) throw new Error('Google не вернул код авторизации');
    const result = await finishGoogleCallback({ code, attempt, platform });
    response.setHeader('Location', result.location);
  } catch (error) {
    response.setHeader(
      'Location',
      authErrorUrl(platform, error instanceof Error ? error.message : 'Не удалось войти через Google'),
    );
  }
  return response.status(302).end();
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();

  try {
    const route = one(request.query.route);
    if (route === 'session/refresh') return await refresh(request, response);
    if (route === 'signout') return await signout(request, response);
    if (route === 'google/start') return await googleStart(request, response);
    if (route === 'google/exchange') return await googleExchange(request, response);
    if (route === 'google/callback') return await googleCallback(request, response);
    if (route === 'ai') return await handleAiRequest(request, response);
    if (route) return response.status(404).json({ error: 'Маршрут не найден' });
    if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

    const mode = request.body?.mode === 'signup' ? 'signup' : 'signin';
    const credentials = validateCredentials(
      String(request.body?.email ?? ''),
      String(request.body?.password ?? ''),
    );

    const client = database();
    const result =
      mode === 'signup'
        ? await client.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: { data: { name: credentials.email.split('@')[0] } },
          })
        : await client.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    if (!result.data.session || !result.data.user) {
      return response.status(202).json({ pending: true, message: 'Подтвердите email и затем войдите' });
    }

    const user = await ensureProfile(result.data.user, database(result.data.session.access_token));
    if (user.status === 'blocked')
      return response.status(403).json({ error: 'Аккаунт заблокирован администратором' });

    return response.status(200).json({
      accessToken: result.data.session.access_token,
      refreshToken: result.data.session.refresh_token,
      expiresAt: result.data.session.expires_at,
      provider: 'password',
      runtime: 'remote',
      user,
    });
  } catch (error) {
    return fail(response, error);
  }
}

import { allowMobile, fail, optionalBearerToken } from '../server/http';
import type { ApiRequest, ApiResponse } from '../server/http';
import { readFeed } from '../server/supabase';

export default async function handler(request: ApiRequest, response: ApiResponse) {
  allowMobile(response, 'GET, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const token = optionalBearerToken(request.headers);
    const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
    return response.status(200).json(
      await readFeed({
        token,
        cursor: one(request.query.cursor),
        query: one(request.query.q),
        topic: one(request.query.topic),
      }),
    );
  } catch (error) {
    return fail(response, error);
  }
}

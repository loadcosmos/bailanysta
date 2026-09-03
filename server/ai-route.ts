import { fail, HttpError } from './http';
import {
  AiProviderError,
  consumeAiQuota,
  generateAiDraft,
  parseAiRequest,
} from './ai';
import { currentUser } from './supabase';
import type { ApiRequest, ApiResponse } from './http';

export async function handleAiRequest(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const { user } = await currentUser(request);
    const input = parseAiRequest(request.body ?? {});
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new HttpError('AI-помощник пока не настроен', 503, 'AI_UNAVAILABLE');
    }
    if (!consumeAiQuota(user.id)) {
      response.setHeader('Retry-After', '600');
      throw new HttpError('Лимит AI временно исчерпан. Попробуйте позже.', 429, 'RATE_LIMITED');
    }

    const suggestion = await generateAiDraft(input, {
      apiKey,
      model: process.env.GEMINI_MODEL?.trim(),
    });
    return response.status(200).json({ suggestion, disclosure: 'ai_draft' });
  } catch (error) {
    if (error instanceof AiProviderError) {
      if (error.status === 429) {
        response.setHeader('Retry-After', '60');
        return response.status(429).json({ error: 'AI временно перегружен. Попробуйте позже.', code: 'RATE_LIMITED' });
      }
      return response.status(503).json({ error: error.message, code: 'AI_UNAVAILABLE' });
    }
    return fail(response, error);
  }
}

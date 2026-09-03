import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_DEFAULT_MODEL,
  AiProviderError,
  buildGeminiRequest,
  consumeAiQuota,
  generateAiDraft,
  parseAiRequest,
  parseAiSuggestion,
} from './ai.ts';

const validBody = {
  action: 'draft-assist',
  mode: 'generate',
  locale: 'ru',
  draft: {
    body: '',
    topic: 'AI',
    type: 'insight',
    tags: ['#ai', 'growth', 'growth', '', 'extra', 'ignored'],
  },
};

test('AI default model remains available for new Gemini API users', () => {
  assert.equal(AI_DEFAULT_MODEL, 'gemini-3.5-flash-lite');
});

test('AI request accepts generation with an empty body and normalizes tags', () => {
  assert.deepEqual(parseAiRequest(validBody), {
    action: 'draft-assist',
    mode: 'generate',
    locale: 'ru',
    draft: { body: '', topic: 'AI', type: 'insight', tags: ['ai', 'growth', 'growth', 'extra', 'ignored'] },
  });
});

test('AI improve mode requires a meaningful draft and known signal values', () => {
  assert.throws(
    () => parseAiRequest({ ...validBody, mode: 'improve' }),
    /от 5 до 1200/,
  );
  assert.throws(
    () => parseAiRequest({ ...validBody, draft: { ...validBody.draft, topic: 'Unknown' } }),
    /Неизвестная тема/,
  );
});

test('AI suggestions are validated against post limits and enums', () => {
  assert.deepEqual(
    parseAiSuggestion({
      body: '  Каждый день делаю один маленький шаг.  ',
      topic: 'AI',
      type: 'progress',
      tags: ['ai', 'learning'],
    }),
    { body: 'Каждый день делаю один маленький шаг.', topic: 'AI', type: 'progress', tags: ['ai', 'learning'] },
  );
  assert.throws(
    () => parseAiSuggestion({ body: 'short', topic: 'AI', type: 'unknown', tags: [] }),
    /Неизвестный тип сигнала/,
  );
  assert.throws(
    () => parseAiSuggestion({ body: 'x'.repeat(1201), topic: 'AI', type: 'insight', tags: [] }),
    /от 5 до 1200/,
  );
});

test('Gemini request uses server-side JSON output constraints and keeps draft context', () => {
  const request = buildGeminiRequest(parseAiRequest(validBody));
  assert.equal(request.contents[0].parts[0].text.includes('growth'), true);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(request.generationConfig.responseJsonSchema.properties.topic.enum, [
    'Наука',
    'AI',
    'ЗОЖ',
    'Бизнес',
    'Карьера',
  ]);
  assert.equal(request.generationConfig.responseJsonSchema.properties.tags.maxItems, 5);
});

test('AI quota allows five requests per user in a ten-minute window', () => {
  const userId = `quota-test-${Date.now()}`;
  const now = 1_000_000;
  assert.deepEqual(
    Array.from({ length: 5 }, () => consumeAiQuota(userId, now)),
    [true, true, true, true, true],
  );
  assert.equal(consumeAiQuota(userId, now), false);
  assert.equal(consumeAiQuota(userId, now + 10 * 60 * 1000 + 1), true);
});

test('AI provider request keeps the API key in a header and parses structured JSON', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const input = parseAiRequest(validBody);
  const result = await generateAiDraft(input, {
    apiKey: 'server-secret',
    fetchImpl: async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      body: 'Идея для роста каждый день.',
                      topic: 'AI',
                      type: 'insight',
                      tags: ['рост'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  assert.equal(result.body, 'Идея для роста каждый день.');
  assert.equal(capturedUrl.includes('server-secret'), false);
  assert.equal((capturedInit?.headers as Record<string, string>)['x-goog-api-key'], 'server-secret');
});

test('AI provider quota errors become a retryable provider error', async () => {
  await assert.rejects(
    () =>
      generateAiDraft(parseAiRequest(validBody), {
        apiKey: 'server-secret',
        fetchImpl: async () => new Response('{}', { status: 429 }),
      }),
    (error: unknown) => error instanceof AiProviderError && error.status === 429,
  );
});

test('AI provider timeouts become a safe gateway timeout', async () => {
  await assert.rejects(
    () =>
      generateAiDraft(parseAiRequest(validBody), {
        apiKey: 'server-secret',
        timeoutMs: 5,
        fetchImpl: async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      }),
    (error: unknown) => error instanceof AiProviderError && error.status === 504,
  );
});

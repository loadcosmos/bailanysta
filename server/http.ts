export type ApiRequest = {
  method?: string;
  headers: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  query: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => ApiResponse;
  end: () => ApiResponse;
};

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'CONFIGURATION'
  | 'BAD_REQUEST'
  | 'INTERNAL';

export class HttpError extends Error {
  status: number;
  code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function optionalBearerToken(headers: Record<string, string | undefined>) {
  const header = headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}

export function allowMobile(response: ApiResponse, methods: string) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', methods);
  response.setHeader('Cache-Control', 'no-store');
}

export function fail(response: ApiResponse, error: unknown) {
  const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос';
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: message, code: error.code });
  }
  const databaseCode =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  if (databaseCode === '23505') {
    return response.status(409).json({ error: 'Такой объект уже существует', code: 'CONFLICT' });
  }
  if (databaseCode === '23503' || databaseCode === '23514' || databaseCode === '22P02') {
    return response.status(400).json({ error: 'Некорректные данные', code: 'VALIDATION' });
  }
  if (databaseCode === '22023') {
    return response.status(400).json({ error: message, code: 'VALIDATION' });
  }
  if (databaseCode === '42501') {
    return response.status(403).json({ error: message, code: 'FORBIDDEN' });
  }
  if (databaseCode === 'PGRST116' || databaseCode === 'P0002') {
    return response.status(404).json({ error: 'Объект не найден', code: 'NOT_FOUND' });
  }
  if (databaseCode && /^[0-9A-Z]{5,8}$/.test(databaseCode)) {
    return response.status(500).json({ error: 'Не удалось выполнить запрос', code: 'INTERNAL' });
  }
  const configurationError = message.includes('SUPABASE_') || message.includes('AUTH_');
  const publicMessage = configurationError ? 'Сервис авторизации пока не настроен' : message;
  const authRequired = /нужно войти|требуется войти|авторизац/i.test(message);
  const status = configurationError
    ? 503
    : authRequired || /сессия|срок.*вышел|войдите снова/i.test(message)
      ? 401
      : /заблок|права администратора|недоступен|нельзя подписаться/i.test(message)
        ? 403
        : /не найден|не существует/i.test(message)
          ? 404
          : /конфликт|занят/i.test(message)
            ? 409
            : 400;
  const code: ApiErrorCode = configurationError
      ? 'CONFIGURATION'
      : status === 401
      ? /сессия|законч|истек|срок/i.test(message)
        ? 'SESSION_EXPIRED'
        : 'AUTH_REQUIRED'
      : status === 403
        ? 'FORBIDDEN'
        : status === 404
          ? 'NOT_FOUND'
          : status === 409
            ? 'CONFLICT'
            : 'BAD_REQUEST';
  return response.status(status).json({ error: publicMessage, code });
}

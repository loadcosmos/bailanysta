import type { PostDraft, SignalType, Topic } from '../types/social.ts';

const signalTypes: SignalType[] = ['insight', 'question', 'progress', 'resource'];
const topics: Topic[] = ['Наука', 'AI', 'ЗОЖ', 'Бизнес', 'Карьера'];
export const POST_BODY_MIN = 5;
export const POST_BODY_MAX = 1200;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;

export function validatePasswordPair(password: string, confirmation: string) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false as const, reason: 'length' as const };
  }
  if (password !== confirmation) return { ok: false as const, reason: 'mismatch' as const };
  return { ok: true as const };
}

export function validateCredentials(rawEmail: string, rawPassword: string) {
  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Укажите корректный email');
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
    throw new Error(
      `Пароль должен содержать от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов`,
    );
  return { email, password };
}

export function parsePostDraft(body: Record<string, unknown>): PostDraft {
  const type = String(body.type ?? '') as SignalType;
  const topic = String(body.topic ?? '') as Topic;
  const text = String(body.body ?? '').trim();
  if (!signalTypes.includes(type)) throw new Error('Неизвестный тип сигнала');
  if (!topics.includes(topic)) throw new Error('Неизвестная тема');
  if (text.length < POST_BODY_MIN || text.length > POST_BODY_MAX)
    throw new Error(`Текст должен содержать от ${POST_BODY_MIN} до ${POST_BODY_MAX} символов`);

  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((tag) => String(tag).trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const link = body.link ? String(body.link).trim() : undefined;
  if (link && !/^https?:\/\/\S+$/i.test(link))
    throw new Error('Ссылка должна начинаться с http:// или https://');
  return { type, topic, body: text, tags, link: link || undefined };
}

export function validateProfileDraft(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  const handle = String(body.handle ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');
  const bio = String(body.bio ?? '').trim();
  if (name.length < 2 || name.length > 60 || !/^[a-z0-9_.]{3,30}$/.test(handle) || bio.length > 180) {
    throw new Error('Проверьте профиль');
  }
  return { name, handle, bio };
}

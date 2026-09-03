export const moderationActions = ['hide', 'restore', 'delete', 'block', 'unblock'] as const;
export type ModerationAction = (typeof moderationActions)[number];
export type ModerationTargetType = 'user' | 'post' | 'comment';

export type ModerationRequest = {
  action: ModerationAction;
  targetType: ModerationTargetType;
  targetId: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseModerationRequest(body: Record<string, unknown>): ModerationRequest {
  const action = String(body.action ?? '') as ModerationAction;
  const targetType = String(body.targetType ?? '') as ModerationTargetType;
  const targetId = String(body.targetId ?? '').trim().toLowerCase();

  if (
    !moderationActions.includes(action) ||
    !['user', 'post', 'comment'].includes(targetType) ||
    !targetId
  ) {
    throw new Error('Некорректная операция модерации');
  }
  if (!uuidPattern.test(targetId)) throw new Error('Некорректный идентификатор объекта');
  if (targetType === 'user' && !['block', 'unblock'].includes(action)) {
    throw new Error('Операция недоступна для пользователя');
  }
  if (targetType === 'post' && !['hide', 'restore', 'delete'].includes(action)) {
    throw new Error('Операция недоступна для публикации');
  }
  if (targetType === 'comment' && !['hide', 'restore', 'delete'].includes(action)) {
    throw new Error('Операция недоступна для комментария');
  }
  return { action, targetType, targetId };
}

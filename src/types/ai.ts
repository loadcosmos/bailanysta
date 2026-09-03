import type { SignalType, Topic } from './social';

export type AiAssistMode = 'generate' | 'improve';
export type AiLocale = 'ru' | 'kk';

export type AiDraft = {
  body: string;
  topic: Topic;
  type: SignalType;
  tags: string[];
};

export type AiSuggestion = AiDraft;

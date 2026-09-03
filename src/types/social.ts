import type { ImageSourcePropType } from 'react-native';

export type SignalType = 'insight' | 'question' | 'progress' | 'resource';
export type Topic = 'Наука' | 'AI' | 'ЗОЖ' | 'Бизнес' | 'Карьера';
export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'blocked';
export type PostStatus = 'published' | 'hidden';

export type SocialUser = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatar?: ImageSourcePropType | string;
  cover?: ImageSourcePropType | string;
  role?: UserRole;
  status?: UserStatus;
  followers?: number;
  following?: number;
};

export type Comment = {
  id: string;
  author: SocialUser;
  body: string;
  createdAt: string;
};

export type Post = {
  id: string;
  author: SocialUser;
  type: SignalType;
  topic: Topic;
  body: string;
  tags: string[];
  image?: ImageSourcePropType | string;
  createdAt: string;
  likes: number;
  liked: boolean;
  comments: Comment[];
  link?: string;
  status?: PostStatus;
};

export type PostDraft = Pick<Post, 'type' | 'topic' | 'body' | 'tags' | 'link'>;

export type Session = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider?: 'password' | 'google';
  runtime?: 'demo' | 'remote';
  user: SocialUser;
};

export type Notification = {
  id: string;
  kind: 'like' | 'comment' | 'follow' | 'moderation';
  body: string;
  actor?: SocialUser;
  postId?: string;
  commentId?: string;
  readAt?: string;
  createdAt: string;
};

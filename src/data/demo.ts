import type { Post, SocialUser } from '@/types/social';

const hero = require('../../assets/images/bailanysta/hero.jpg');
const aiLearning = require('../../assets/images/bailanysta/ai-learning.jpg');
const trail = require('../../assets/images/bailanysta/trail.jpg');

export const demoUser: SocialUser = {
  id: 'demo-me',
  name: 'Айлин Нурбек',
  handle: 'ailin.grows',
  bio: 'Учусь замечать прогресс и делюсь тем, что действительно работает.',
  avatar: hero,
  cover: trail,
};

const aliya: SocialUser = {
  id: 'aliya',
  name: 'Алия Садыкова',
  handle: 'aliya.science',
  bio: 'Биотехнолог и вечный студент.',
  avatar: aiLearning,
};

const daniyar: SocialUser = {
  id: 'daniyar',
  name: 'Данияр Ким',
  handle: 'daniyar.moves',
  bio: 'Продукты, спорт и честные эксперименты над привычками.',
  avatar: trail,
};

export const demoPosts: Post[] = [
  {
    id: 'signal-ai',
    author: aliya,
    type: 'insight',
    topic: 'AI',
    body: 'Лучший способ понять модель — объяснить её человеку, который никогда не писал код. Сегодня проверили это на визуальном распознавании.',
    tags: ['обучение', 'искусственныйинтеллект'],
    image: aiLearning,
    createdAt: '2026-09-01T16:30:00.000Z',
    likes: 128,
    liked: false,
    comments: [
      {
        id: 'comment-1',
        author: daniyar,
        body: 'Сработало и со мной. Если не можешь объяснить просто — ещё не понял.',
        createdAt: '2026-09-01T17:05:00.000Z',
      },
    ],
  },
  {
    id: 'signal-health',
    author: daniyar,
    type: 'progress',
    topic: 'ЗОЖ',
    body: 'Тридцать дней без гонки за идеальным планом: ходьба, сон до полуночи и один честный отчёт в неделю. Маленький прогресс оказался устойчивее рывков.',
    tags: ['привычки', 'здоровье', 'фокус'],
    image: trail,
    createdAt: '2026-08-31T07:40:00.000Z',
    likes: 94,
    liked: true,
    comments: [],
  },
  {
    id: 'signal-career',
    author: demoUser,
    type: 'question',
    topic: 'Карьера',
    body: 'Какой навык вы начали развивать слишком поздно — и что помогло не бросить его через неделю?',
    tags: ['карьера', 'вопрос'],
    createdAt: '2026-08-30T12:15:00.000Z',
    likes: 57,
    liked: false,
    comments: [],
  },
];

export const appImages = { hero, aiLearning, trail };

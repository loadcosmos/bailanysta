import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendUnique,
  canUseMemberAction,
  feedEmptyCopy,
  feedFailurePosts,
  filterPosts,
  getCopy,
  upsertById,
} from './app-logic.ts';

const posts = [
  {
    id: '1',
    author: { name: 'Алия Садыкова', handle: 'aliya' },
    body: 'Как превратить чтение в ежедневную привычку',
    topic: 'ЗОЖ',
    tags: ['привычки', 'фокус'],
  },
  {
    id: '2',
    author: { name: 'Данияр Ким', handle: 'daniyar' },
    body: 'Разбираю новый подход к машинному обучению',
    topic: 'AI',
    tags: ['наука'],
  },
];

test('filterPosts searches body, author, topic and tags without case sensitivity', () => {
  assert.deepEqual(
    filterPosts(posts, 'ФОКУС').map((post) => post.id),
    ['1'],
  );
  assert.deepEqual(
    filterPosts(posts, 'данияр').map((post) => post.id),
    ['2'],
  );
  assert.deepEqual(
    filterPosts(posts, 'ai').map((post) => post.id),
    ['2'],
  );
});

test('filterPosts returns all posts for an empty query', () => {
  assert.equal(filterPosts(posts, '   ').length, 2);
});

test('getCopy falls back to Russian when Kazakh copy is missing', () => {
  assert.equal(getCopy({ ru: 'Сохранить' }, 'kk'), 'Сохранить');
  assert.equal(getCopy({ ru: 'Лента', kk: 'Таспа' }, 'kk'), 'Таспа');
});

test('member actions require a non-empty access token', () => {
  assert.equal(canUseMemberAction(undefined), false);
  assert.equal(canUseMemberAction(''), false);
  assert.equal(canUseMemberAction('token'), true);
});

test('real feed errors never replace cached content with demo posts', () => {
  const cached = [{ id: 'remote-1' }];
  const demo = [{ id: 'demo-1' }];
  assert.deepEqual(feedFailurePosts(true, cached, demo), cached);
  assert.deepEqual(feedFailurePosts(false, [], demo), demo);
});

test('feed empty copy explains the first step in both supported languages', () => {
  assert.deepEqual(feedEmptyCopy('ru'), {
    title: 'Пока тихо',
    text: 'Станьте первым, кто поделится сигналом роста.',
  });
  assert.deepEqual(feedEmptyCopy('kk'), {
    title: 'Әзірге тыныш',
    text: 'Өсу сигналыңызбен бірінші болып бөлісіңіз.',
  });
});

test('pagination appends new posts without duplicating the cursor boundary', () => {
  assert.deepEqual(
    appendUnique(
      [{ id: 'newest' }, { id: 'shared' }],
      [{ id: 'shared' }, { id: 'older' }, { id: 'older' }],
    ),
    [{ id: 'newest' }, { id: 'shared' }, { id: 'older' }],
  );
});

test('freshly loaded entities replace stale cached data without moving position', () => {
  assert.deepEqual(
    upsertById(
      [{ id: 'newest', body: 'old' }, { id: 'older', body: 'keep' }],
      { id: 'newest', body: 'fresh' },
    ),
    [{ id: 'newest', body: 'fresh' }, { id: 'older', body: 'keep' }],
  );
  assert.deepEqual(upsertById([{ id: 'existing' }], { id: 'deep-link' }), [
    { id: 'deep-link' },
    { id: 'existing' },
  ]);
});

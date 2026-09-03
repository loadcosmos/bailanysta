import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const command = process.argv[2];
const argument = process.argv[3];
const qaDirectory = path.resolve(process.cwd(), '.qa');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is required');
  return value;
}

function client() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function safeRunId(value) {
  const normalized = (value || 'run-' + Date.now().toString(36))
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  if (!normalized) throw new Error('QA_RUN_ID is empty');
  return normalized;
}

function manifestPath(runId) {
  return path.join(qaDirectory, runId + '.json');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function insertOne(supabase, table, values) {
  const { data, error } = await supabase.from(table).insert(values).select('id').single();
  if (error) throw error;
  return data.id;
}

async function updateProfile(supabase, id, values) {
  const { error } = await supabase.from('profiles').update(values).eq('id', id);
  if (error) throw error;
}

async function seed() {
  const runId = safeRunId(process.env.QA_RUN_ID);
  const outputPath = manifestPath(runId);
  if (fs.existsSync(outputPath)) {
    throw new Error('QA manifest already exists. Run npm run qa:cleanup first: ' + outputPath);
  }

  const supabase = client();
  const marker = 'QA_' + runId;
  const userDefinitions = [
    {
      key: 'author',
      name: 'QA Айдана',
      bio: 'QA-профиль автора для проверки публичного профиля.',
    },
    {
      key: 'reader',
      name: 'QA Ерлан',
      bio: 'QA-профиль читателя для лайков, комментариев и подписок.',
    },
    {
      key: 'explorer',
      name: 'QA Меруерт',
      bio: 'QA-профиль для поиска и проверки второго участника.',
    },
    {
      key: 'admin',
      name: 'QA Модератор',
      bio: 'QA-профиль администратора для безопасной модерации.',
    },
  ];
  const users = {};

  for (const definition of userDefinitions) {
    const email = 'qa.bailanysta.' + runId + '.' + definition.key + '@example.com';
    const password = 'Qa-' + runId + '-' + definition.key + '-2026!';
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: definition.name, qa_run_id: runId },
    });
    if (error || !data.user) throw error ?? new Error('Supabase did not return a QA user');
    await updateProfile(supabase, data.user.id, {
      name: definition.name,
      bio: definition.bio,
      status: 'active',
      role: definition.key === 'admin' ? 'admin' : 'member',
    });
    users[definition.key] = {
      id: data.user.id,
      email,
      password,
      name: definition.name,
    };
  }

  const postDefinitions = [
    {
      key: 'aiInsight',
      author: 'author',
      type: 'insight',
      topic: 'AI',
      body: 'Как объяснить сложную модель простыми словами: сегодня проверили идею на маленьком примере.',
      tags: ['обучение', 'ai'],
    },
    {
      key: 'healthProgress',
      author: 'reader',
      type: 'progress',
      topic: 'ЗОЖ',
      body: 'Собираю устойчивую привычку без рывков: сон, прогулка и один честный отчёт в неделю.',
      tags: ['привычки', 'прогресс'],
    },
    {
      key: 'careerQuestion',
      author: 'explorer',
      type: 'question',
      topic: 'Карьера',
      body: 'Какой навык помог вам перейти от планов к первому маленькому результату?',
      tags: ['карьера', 'вопрос'],
    },
    {
      key: 'resource',
      author: 'admin',
      type: 'resource',
      topic: 'Наука',
      body: 'Сохраняю короткий список источников, к которым возвращаюсь перед новым экспериментом.',
      tags: ['ресурсы', 'наука'],
      link: 'https://example.com/bailanysta-qa',
    },
    {
      key: 'secondAuthorPost',
      author: 'author',
      type: 'progress',
      topic: 'Бизнес',
      body: 'Вторая QA-публикация нужна для проверки списка сигналов в публичном профиле.',
      tags: ['профиль', 'qa'],
    },
  ];
  const posts = {};

  for (const definition of postDefinitions) {
    const postId = await insertOne(supabase, 'posts', {
      user_id: users[definition.author].id,
      type: definition.type,
      topic: definition.topic,
      body: marker + ': ' + definition.body,
      tags: [marker, ...definition.tags],
      link: definition.link,
      status: 'published',
    });
    posts[definition.key] = { id: postId, author: definition.author };
  }

  await supabase.from('follows').insert([
    { follower_id: users.reader.id, following_id: users.author.id },
    { follower_id: users.explorer.id, following_id: users.author.id },
  ]).then(({ error }) => {
    if (error) throw error;
  });
  await supabase.from('likes').insert([
    { user_id: users.reader.id, post_id: posts.aiInsight.id },
    { user_id: users.explorer.id, post_id: posts.aiInsight.id },
    { user_id: users.author.id, post_id: posts.healthProgress.id },
  ]).then(({ error }) => {
    if (error) throw error;
  });

  const comments = {};
  comments.readerOnAi = await insertOne(supabase, 'comments', {
    post_id: posts.aiInsight.id,
    user_id: users.reader.id,
    body: marker + ': Проверяю эту гипотезу на своём примере.',
    status: 'visible',
  });
  comments.explorerOnAi = await insertOne(supabase, 'comments', {
    post_id: posts.aiInsight.id,
    user_id: users.explorer.id,
    body: marker + ': Хороший сценарий для следующего эксперимента.',
    status: 'visible',
  });

  const manifest = {
    version: 1,
    runId,
    marker,
    createdAt: new Date().toISOString(),
    users,
    posts,
    comments,
    adminUserKey: 'admin',
  };
  fs.mkdirSync(qaDirectory, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, manifest: outputPath, runId, users, posts }, null, 2));
}

async function deleteWhere(supabase, table, column, values) {
  const ids = unique(values);
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in(column, ids);
  if (error) throw error;
}

async function cleanup() {
  const requested = argument || process.env.QA_MANIFEST || process.env.QA_RUN_ID;
  if (!requested) throw new Error('Pass a manifest path or set QA_MANIFEST/QA_RUN_ID');
  const outputPath = requested.endsWith('.json')
    ? path.resolve(requested)
    : manifestPath(safeRunId(requested));
  const manifest = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const supabase = client();
  const userEntries = Object.values(manifest.users || {});
  const userIds = userEntries.map((user) => user.id);
  const { data: markedPosts, error: postsError } = await supabase
    .from('posts')
    .select('id')
    .contains('tags', [manifest.marker]);
  if (postsError) throw postsError;
  const postIds = unique([
    ...Object.values(manifest.posts || {}).map((post) => post.id),
    ...(markedPosts || []).map((post) => post.id),
  ]);
  const { data: markedComments, error: commentsError } = await supabase
    .from('comments')
    .select('id')
    .in('post_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']);
  if (commentsError) throw commentsError;
  const commentIds = unique([
    ...Object.values(manifest.comments || {}),
    ...(markedComments || []).map((comment) => comment.id),
  ]);

  await deleteWhere(supabase, 'notifications', 'recipient_id', userIds);
  await deleteWhere(supabase, 'notifications', 'actor_id', userIds);
  await deleteWhere(supabase, 'moderation_events', 'admin_id', userIds);
  await deleteWhere(supabase, 'moderation_events', 'target_id', [...userIds, ...postIds, ...commentIds]);
  await deleteWhere(supabase, 'likes', 'post_id', postIds);
  await deleteWhere(supabase, 'likes', 'user_id', userIds);
  await deleteWhere(supabase, 'comments', 'post_id', postIds);
  await deleteWhere(supabase, 'comments', 'user_id', userIds);
  await deleteWhere(supabase, 'follows', 'follower_id', userIds);
  await deleteWhere(supabase, 'follows', 'following_id', userIds);
  await deleteWhere(supabase, 'posts', 'id', postIds);

  const keepUserIds = new Set(
    (process.env.QA_KEEP_USER_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  for (const user of userEntries) {
    if (keepUserIds.has(user.id)) continue;
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error && error.code !== 'user_not_found') throw error;
  }

  fs.rmSync(outputPath, { force: true });
  console.log(JSON.stringify({ ok: true, cleanedRunId: manifest.runId, posts: postIds.length }));
}

if (command === 'seed') await seed();
else if (command === 'cleanup') await cleanup();
else {
  console.error('Usage: npm run qa:seed | npm run qa:cleanup [manifest-path-or-run-id]');
  process.exitCode = 1;
}

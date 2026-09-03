-- Bailanysta's production schema. Apply this file to a fresh Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  bio text not null default '' check (char_length(bio) <= 180),
  avatar_url text,
  cover_url text,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('insight', 'question', 'progress', 'resource')),
  topic text not null check (topic in ('Наука', 'AI', 'ЗОЖ', 'Бизнес', 'Карьера')),
  body text not null check (char_length(body) between 5 and 1200),
  tags text[] not null default '{}',
  image_url text,
  link text,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'follow', 'moderation')),
  body text not null check (char_length(body) between 1 and 240),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  target_type text not null check (target_type in ('user', 'post', 'comment')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'delete', 'block', 'unblock')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- These short-lived tables are only used by server-side OAuth routes. They are
-- deliberately not exposed to anon/authenticated Data API roles.
create table if not exists public.auth_oauth_attempts (
  state_hash text primary key,
  code_verifier text not null,
  platform text not null check (platform in ('web', 'native')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_topic_status_idx on public.posts(topic, status, created_at desc);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists likes_post_id_idx on public.likes(post_id);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_actor_idx on public.notifications(actor_id);
create index if not exists notifications_post_idx on public.notifications(post_id);
create index if not exists notifications_comment_idx on public.notifications(comment_id);
create index if not exists moderation_events_created_idx on public.moderation_events(created_at desc);
create index if not exists moderation_events_admin_idx on public.moderation_events(admin_id);
create index if not exists posts_user_idx on public.posts(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute procedure public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base_handle text;
  display_name text;
begin
  display_name := left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Участник'), 60);
  if char_length(display_name) < 2 then display_name := 'Участник'; end if;
  base_handle := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'member'), '[^a-z0-9_.]', '', 'g'));
  if char_length(base_handle) < 3 then base_handle := 'member'; end if;
  base_handle := left(base_handle, 24);

  insert into public.profiles (id, name, handle)
  values (new.id, display_name, base_handle || '_' || substr(new.id::text, 1, 5))
  on conflict (id) do nothing;
  return new;
end;
$$;

create schema if not exists private;

create or replace function public.moderate_target(
  p_target_type text,
  p_target_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;

  if p_target_type not in ('user', 'post', 'comment')
    or p_action not in ('hide', 'restore', 'delete', 'block', 'unblock') then
    raise exception 'Некорректная операция модерации' using errcode = '22023';
  end if;

  if p_target_type = 'user' then
    if p_action not in ('block', 'unblock') then
      raise exception 'Операция недоступна для пользователя' using errcode = '22023';
    end if;
    if p_target_id = (select auth.uid()) then
      raise exception 'Нельзя изменить статус собственного аккаунта' using errcode = '42501';
    end if;
    update public.profiles
      set status = case when p_action = 'block' then 'blocked' else 'active' end
      where id = p_target_id;
  elsif p_target_type = 'post' then
    if p_action not in ('hide', 'restore', 'delete') then
      raise exception 'Операция недоступна для публикации' using errcode = '22023';
    end if;
    if p_action = 'delete' then
      delete from public.posts where id = p_target_id;
    else
      update public.posts
        set status = case when p_action = 'hide' then 'hidden' else 'published' end
        where id = p_target_id;
    end if;
  else
    if p_action not in ('hide', 'restore', 'delete') then
      raise exception 'Операция недоступна для комментария' using errcode = '22023';
    end if;
    if p_action = 'delete' then
      delete from public.comments where id = p_target_id;
    else
      update public.comments
        set status = case when p_action = 'hide' then 'hidden' else 'visible' end
        where id = p_target_id;
    end if;
  end if;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'Объект не найден' using errcode = 'P0002';
  end if;

  insert into public.moderation_events (admin_id, target_type, target_id, action)
  values ((select auth.uid()), p_target_type, p_target_id, p_action);

  return jsonb_build_object('ok', true);
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

create or replace function private.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_owner uuid;
  actor_name text;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if post_owner is null or post_owner = new.user_id then return new; end if;
  select name into actor_name from public.profiles where id = new.user_id;
  insert into public.notifications (recipient_id, actor_id, post_id, kind, body)
  values (post_owner, new.user_id, new.post_id, 'like', coalesce(actor_name, 'Кто-то') || ' отметил ваш сигнал');
  return new;
end;
$$;

create or replace function private.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  post_owner uuid;
  actor_name text;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if post_owner is null or post_owner = new.user_id then return new; end if;
  select name into actor_name from public.profiles where id = new.user_id;
  insert into public.notifications (recipient_id, actor_id, post_id, comment_id, kind, body)
  values (post_owner, new.user_id, new.post_id, new.id, 'comment', coalesce(actor_name, 'Кто-то') || ' оставил комментарий');
  return new;
end;
$$;

create or replace function private.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_name text;
begin
  select name into actor_name from public.profiles where id = new.follower_id;
  insert into public.notifications (recipient_id, actor_id, kind, body)
  values (new.following_id, new.follower_id, 'follow', coalesce(actor_name, 'Кто-то') || ' подписался на вас');
  return new;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify after insert on public.likes for each row execute procedure private.notify_like();
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute procedure private.notify_comment();
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows for each row execute procedure private.notify_follow();

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
revoke all on function private.notify_like() from public, anon, authenticated;
revoke all on function private.notify_comment() from public, anon, authenticated;
revoke all on function private.notify_follow() from public, anon, authenticated;
revoke all on function public.moderate_target(text, uuid, text) from public, anon, authenticated;
grant execute on function public.moderate_target(text, uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.moderation_events enable row level security;
alter table public.auth_oauth_attempts enable row level security;
alter table public.auth_handoffs enable row level security;

drop policy if exists "active profiles are readable" on public.profiles;
create policy "active profiles are readable" on public.profiles for select
  using (status = 'active' or (select auth.uid()) = id);
drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile" on public.profiles for insert to authenticated
  with check (
    (select auth.uid()) = id
    and role = 'member'
    and status = 'active'
  );
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id and role = 'member' and status = 'active')
  with check ((select auth.uid()) = id and role = 'member' and status = 'active');
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "published posts are readable" on public.posts;
create policy "published posts are readable" on public.posts for select
  using (
    (
      status = 'published'
      and exists (
        select 1 from public.profiles author
        where author.id = posts.user_id and author.status = 'active'
      )
    )
    or (select auth.uid()) = user_id
  );
drop policy if exists "users create own posts" on public.posts;
create policy "users create own posts" on public.posts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'published'
    and exists (
      select 1 from public.profiles author
      where author.id = posts.user_id and author.status = 'active'
    )
  );
drop policy if exists "users update own posts" on public.posts;
create policy "users update own posts" on public.posts for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles author
      where author.id = posts.user_id and author.status = 'active'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles author
      where author.id = posts.user_id and author.status = 'active'
    )
  );
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts" on public.posts for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles author
      where author.id = posts.user_id and author.status = 'active'
    )
  );
drop policy if exists "admins manage posts" on public.posts;
create policy "admins manage posts" on public.posts for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "likes are readable" on public.likes;
create policy "likes are readable" on public.likes for select
  using (
    exists (
      select 1
      from public.posts post
      join public.profiles author on author.id = post.user_id
      where post.id = likes.post_id and post.status = 'published' and author.status = 'active'
    )
  );
drop policy if exists "users add own likes" on public.likes;
create policy "users add own likes" on public.likes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles actor
      where actor.id = likes.user_id and actor.status = 'active'
    )
    and exists (
      select 1
      from public.posts post
      join public.profiles author on author.id = post.user_id
      where post.id = likes.post_id and post.status = 'published' and author.status = 'active'
    )
  );
drop policy if exists "users delete own likes" on public.likes;
create policy "users delete own likes" on public.likes for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles actor
      where actor.id = likes.user_id and actor.status = 'active'
    )
  );

drop policy if exists "visible comments are readable" on public.comments;
create policy "visible comments are readable" on public.comments for select
  using (
    (
      status = 'visible'
      and exists (
        select 1
        from public.posts post
        join public.profiles author on author.id = post.user_id
        join public.profiles commenter on commenter.id = comments.user_id
        where post.id = comments.post_id
          and post.status = 'published'
          and author.status = 'active'
          and commenter.status = 'active'
      )
    )
    or (select auth.uid()) = user_id
  );
drop policy if exists "users add own comments" on public.comments;
create policy "users add own comments" on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles commenter
      where commenter.id = comments.user_id and commenter.status = 'active'
    )
    and exists (
      select 1
      from public.posts post
      join public.profiles author on author.id = post.user_id
      where post.id = comments.post_id and post.status = 'published' and author.status = 'active'
    )
  );
drop policy if exists "users edit own comments" on public.comments;
create policy "users edit own comments" on public.comments for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles commenter
      where commenter.id = comments.user_id and commenter.status = 'active'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles commenter
      where commenter.id = comments.user_id and commenter.status = 'active'
    )
  );
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles commenter
      where commenter.id = comments.user_id and commenter.status = 'active'
    )
  );
drop policy if exists "admins manage comments" on public.comments;
create policy "admins manage comments" on public.comments for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "follows are readable" on public.follows;
create policy "follows are readable" on public.follows for select
  using (
    exists (
      select 1 from public.profiles follower
      where follower.id = follows.follower_id and follower.status = 'active'
    )
    and exists (
      select 1 from public.profiles following
      where following.id = follows.following_id and following.status = 'active'
    )
  );
drop policy if exists "users follow as themselves" on public.follows;
create policy "users follow as themselves" on public.follows for insert to authenticated
  with check (
    (select auth.uid()) = follower_id
    and exists (
      select 1 from public.profiles follower
      where follower.id = follows.follower_id and follower.status = 'active'
    )
    and exists (
      select 1 from public.profiles following
      where following.id = follows.following_id and following.status = 'active'
    )
  );
drop policy if exists "users remove own follows" on public.follows;
create policy "users remove own follows" on public.follows for delete to authenticated
  using (
    (select auth.uid()) = follower_id
    and exists (
      select 1 from public.profiles follower
      where follower.id = follows.follower_id and follower.status = 'active'
    )
  );

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);
drop policy if exists "users mark own notifications" on public.notifications;
create policy "users mark own notifications" on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id) with check ((select auth.uid()) = recipient_id);

drop policy if exists "admins read moderation events" on public.moderation_events;
create policy "admins read moderation events" on public.moderation_events for select to authenticated
  using ((select private.is_admin()));
drop policy if exists "admins write moderation events" on public.moderation_events;
create policy "admins write moderation events" on public.moderation_events for insert to authenticated
  with check ((select private.is_admin()) and (select auth.uid()) = admin_id);

-- Supabase may leave broad table grants behind on a project created from a
-- template. Start from a closed surface, then grant only what the RLS
-- policies below can safely expose.
revoke all on public.profiles, public.posts, public.likes, public.comments, public.follows,
  public.notifications, public.moderation_events, public.auth_oauth_attempts, public.auth_handoffs
  from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.likes, public.comments, public.follows to anon;
grant select, insert, update, delete on public.profiles, public.posts, public.likes, public.comments, public.follows to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.moderation_events to authenticated;

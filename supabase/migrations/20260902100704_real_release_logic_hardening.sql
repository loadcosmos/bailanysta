-- This migration mirrors the logic-hardening section in ../schema.sql.
-- It is safe to re-run against the existing real-release database.

create schema if not exists private;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base_handle text;
  display_name text;
begin
  display_name := left(coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Участник'
  ), 60);
  if char_length(display_name) < 2 then display_name := 'Участник'; end if;
  base_handle := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'member'),
    '[^a-z0-9_.]', '', 'g'
  ));
  if char_length(base_handle) < 3 then base_handle := 'member'; end if;
  base_handle := left(base_handle, 24);

  insert into public.profiles (id, name, handle)
  values (new.id, display_name, base_handle || '_' || substr(new.id::text, 1, 5))
  on conflict (id) do nothing;
  return new;
end;
$$;

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

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
revoke all on function public.moderate_target(text, uuid, text) from public, anon, authenticated;
grant execute on function public.moderate_target(text, uuid, text) to authenticated;

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id and role = 'member' and status = 'active');

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
    and exists (select 1 from public.profiles actor where actor.id = likes.user_id and actor.status = 'active')
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
    and exists (select 1 from public.profiles actor where actor.id = likes.user_id and actor.status = 'active')
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
    and exists (select 1 from public.profiles commenter where commenter.id = comments.user_id and commenter.status = 'active')
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
    and exists (select 1 from public.profiles commenter where commenter.id = comments.user_id and commenter.status = 'active')
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.profiles commenter where commenter.id = comments.user_id and commenter.status = 'active')
  );
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.profiles commenter where commenter.id = comments.user_id and commenter.status = 'active')
  );

drop policy if exists "follows are readable" on public.follows;
create policy "follows are readable" on public.follows for select
  using (
    exists (select 1 from public.profiles follower where follower.id = follows.follower_id and follower.status = 'active')
    and exists (select 1 from public.profiles following where following.id = follows.following_id and following.status = 'active')
  );
drop policy if exists "users follow as themselves" on public.follows;
create policy "users follow as themselves" on public.follows for insert to authenticated
  with check (
    (select auth.uid()) = follower_id
    and exists (select 1 from public.profiles follower where follower.id = follows.follower_id and follower.status = 'active')
    and exists (select 1 from public.profiles following where following.id = follows.following_id and following.status = 'active')
  );
drop policy if exists "users remove own follows" on public.follows;
create policy "users remove own follows" on public.follows for delete to authenticated
  using (
    (select auth.uid()) = follower_id
    and exists (select 1 from public.profiles follower where follower.id = follows.follower_id and follower.status = 'active')
  );

grant select, insert on public.moderation_events to authenticated;

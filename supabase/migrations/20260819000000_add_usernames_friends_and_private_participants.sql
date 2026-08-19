alter table public.profiles add column username text;

update public.profiles
set username = left(
  case
    when length(regexp_replace(lower(coalesce(full_name, '')), '[^a-z0-9._-]+', '_', 'g')) >= 3
      then trim(both '_' from regexp_replace(lower(full_name), '[^a-z0-9._-]+', '_', 'g'))
    else 'player'
  end,
  21
) || '_' || left(replace(id::text, '-', ''), 8);

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format_check
    check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$');

create unique index profiles_username_lower_key on public.profiles (lower(username));

create type public.friendship_status as enum ('pending', 'accepted', 'rejected');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_different_players_check check (requester_id <> addressee_id)
);

create unique index friendships_unique_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_status_idx on public.friendships (requester_id, status);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
grant select on table public.friendships to authenticated;

create policy "Players can view their friendships"
on public.friendships for select to authenticated
using (
  (select auth.uid()) in (requester_id, addressee_id)
  or private.is_administrator()
);

grant update (username, full_name, phone_number) on table public.profiles to authenticated;

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    btrim(p_username) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$'
    and not exists (
      select 1 from public.profiles p where lower(p.username) = lower(btrim(p_username))
    );
$function$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if v_username !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$' then
    v_username := 'player_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.profiles (id, username, full_name, phone_number)
  values (
    new.id,
    v_username,
    v_username,
    nullif(btrim(new.raw_user_meta_data ->> 'phone_number'), '')
  );
  return new;
end;
$function$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and (
      p_profile_id = (select auth.uid())
      or private.is_administrator()
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (select auth.uid()) in (f.requester_id, f.addressee_id)
          and p_profile_id in (f.requester_id, f.addressee_id)
      )
      or exists (
        select 1
        from public.reservations r
        where r.host_id = (select auth.uid())
          and (
            exists (
              select 1 from public.reservation_participants rp
              where rp.reservation_id = r.id and rp.player_id = p_profile_id
            )
            or exists (
              select 1 from public.join_requests jr
              where jr.reservation_id = r.id and jr.player_id = p_profile_id
            )
          )
      )
    );
$function$;

create or replace function public.search_players(p_query text)
returns table (
  player_id uuid,
  username text,
  relationship_status public.friendship_status,
  relationship_direction text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_query text := lower(btrim(p_query));
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if length(v_query) < 3 then return; end if;

  return query
  select
    p.id,
    p.username,
    f.status,
    case
      when f.id is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.requester_id = v_user_id then 'outgoing'
      else 'incoming'
    end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(v_user_id, p.id)
   and greatest(f.requester_id, f.addressee_id) = greatest(v_user_id, p.id)
  where p.id <> v_user_id
    and p.role = 'player'
    and (lower(p.username) like v_query || '%' or lower(u.email::text) = v_query)
  order by case when lower(p.username) = v_query then 0 else 1 end, lower(p.username)
  limit 12;
end;
$function$;

revoke all on function public.search_players(text) from public, anon;
grant execute on function public.search_players(text) to authenticated;

create or replace function public.list_friendships()
returns table (
  friendship_id uuid,
  player_id uuid,
  username text,
  status public.friendship_status,
  direction text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  select
    f.id,
    case when f.requester_id = v_user_id then f.addressee_id else f.requester_id end,
    p.username,
    f.status,
    case
      when f.status = 'accepted' then 'friends'
      when f.requester_id = v_user_id then 'outgoing'
      else 'incoming'
    end
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = v_user_id then f.addressee_id else f.requester_id end
  where v_user_id in (f.requester_id, f.addressee_id)
  order by case f.status when 'pending' then 0 when 'accepted' then 1 else 2 end, lower(p.username);
end;
$function$;

revoke all on function public.list_friendships() from public, anon;
grant execute on function public.list_friendships() to authenticated;

create or replace function public.send_friend_request(p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_friendship_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if p_player_id = v_user_id then
    raise exception 'You cannot add yourself.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_player_id and p.role = 'player') then
    raise exception 'Player not found.' using errcode = 'P0002';
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (v_user_id, p_player_id)
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  do update set
    requester_id = excluded.requester_id,
    addressee_id = excluded.addressee_id,
    status = 'pending',
    updated_at = now()
  where public.friendships.status = 'rejected'
  returning id into v_friendship_id;

  if v_friendship_id is null then
    raise exception 'A friendship or pending request already exists.';
  end if;
  return v_friendship_id;
end;
$function$;

revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  update public.friendships
  set status = case when p_accept then 'accepted' else 'rejected' end, updated_at = now()
  where id = p_friendship_id and addressee_id = v_user_id and status = 'pending';

  if not found then
    raise exception 'Pending friend request not found.' using errcode = 'P0002';
  end if;
  return p_friendship_id;
end;
$function$;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.create_private_reservation(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_friend_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_friend_ids uuid[];
  v_friend_count integer;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select coalesce(array_agg(distinct friend_id), '{}'::uuid[])
  into v_friend_ids
  from unnest(coalesce(p_friend_ids, '{}'::uuid[])) friend_id;
  v_friend_count := cardinality(v_friend_ids);

  if v_friend_count < 2 or v_friend_count > 3 then
    raise exception 'Choose two or three friends for a private reservation.';
  end if;
  if v_user_id = any(v_friend_ids) then
    raise exception 'The host cannot be added as a friend.';
  end if;
  if (
    select count(*)
    from unnest(v_friend_ids) friend_id
    where exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(v_user_id, friend_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(v_user_id, friend_id)
    )
  ) <> v_friend_count then
    raise exception 'Every selected player must be an accepted friend.' using errcode = '42501';
  end if;

  v_reservation_id := private.create_reservation(
    p_start_at,
    p_end_at,
    'private'::public.reservation_type,
    1::smallint
  );

  insert into public.reservation_participants (reservation_id, player_id, role)
  select v_reservation_id, friend_id, 'member'::public.participant_role
  from unnest(v_friend_ids) friend_id;

  update public.reservations
  set initial_player_count = (v_friend_count + 1)::smallint
  where id = v_reservation_id;

  insert into public.notifications (user_id, reservation_id, event_type, delivery_status)
  select friend_id, v_reservation_id, 'reservation_confirmation', 'pending'
  from unnest(v_friend_ids) friend_id;

  return v_reservation_id;
end;
$function$;

revoke all on function public.create_private_reservation(timestamptz, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_private_reservation(timestamptz, timestamptz, uuid[]) to authenticated;

create or replace function public.update_player_profile(p_username text, p_phone_number text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_username text := btrim(p_username);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if v_username !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$' then
    raise exception 'Username must be 3–30 characters and use only letters, numbers, dots, dashes, or underscores.';
  end if;

  update public.profiles
  set username = v_username, full_name = v_username, phone_number = nullif(btrim(p_phone_number), '')
  where id = v_user_id;
  return v_user_id;
exception when unique_violation then
  raise exception 'That username is already taken.' using errcode = '23505';
end;
$function$;

revoke all on function public.update_player_profile(text, text) from public, anon;
grant execute on function public.update_player_profile(text, text) to authenticated;

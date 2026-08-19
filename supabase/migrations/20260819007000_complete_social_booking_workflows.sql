alter table public.notifications
  add column if not exists friendship_id uuid references public.friendships(id) on delete cascade,
  add column if not exists join_request_id uuid references public.join_requests(id) on delete cascade,
  add column if not exists read_at timestamptz;

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

drop policy if exists "Players can mark their notifications as read" on public.notifications;
create policy "Players can mark their notifications as read"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant update (read_at) on table public.notifications to authenticated;

alter table public.reservations
  drop constraint if exists reservations_private_player_count;

alter table public.reservations
  add constraint reservations_player_count_by_type check (
    (type = 'private' and initial_player_count between 1 and 4)
    or (type = 'open' and initial_player_count between 1 and 3)
  );

create or replace function private.send_friend_request(p_player_id uuid)
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

  insert into public.notifications (user_id, friendship_id, event_type, delivery_status)
  values (p_player_id, v_friendship_id, 'join_request_created', 'pending');

  return v_friendship_id;
end;
$function$;

create or replace function private.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requester_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  update public.friendships
  set
    status = case when p_accept then 'accepted'::public.friendship_status else 'rejected'::public.friendship_status end,
    updated_at = now()
  where id = p_friendship_id
    and addressee_id = v_user_id
    and status = 'pending'
  returning requester_id into v_requester_id;

  if v_requester_id is null then
    raise exception 'Pending friend request not found.' using errcode = 'P0002';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_user_id
    and friendship_id = p_friendship_id
    and event_type = 'join_request_created';

  insert into public.notifications (user_id, friendship_id, event_type, delivery_status)
  values (
    v_requester_id,
    p_friendship_id,
    case when p_accept then 'join_request_accepted'::public.notification_event_type else 'join_request_rejected'::public.notification_event_type end,
    'pending'
  );

  return p_friendship_id;
end;
$function$;

create or replace function private.list_player_notifications()
returns table (
  notification_id uuid,
  event_type text,
  created_at timestamptz,
  read_at timestamptz,
  reservation_id uuid,
  friendship_id uuid,
  join_request_id uuid,
  actor_username text,
  reservation_start_at timestamptz,
  reservation_end_at timestamptz
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
    n.id,
    n.event_type::text,
    n.created_at,
    n.read_at,
    n.reservation_id,
    n.friendship_id,
    n.join_request_id,
    coalesce(actor.username, join_actor.username),
    r.start_at,
    r.end_at
  from public.notifications n
  left join public.friendships f on f.id = n.friendship_id
  left join public.profiles actor on actor.id = case
    when n.friendship_id is null then null
    when n.event_type = 'join_request_created' then f.requester_id
    else f.addressee_id
  end
  left join public.join_requests notification_request on notification_request.id = n.join_request_id
  left join public.profiles join_actor on join_actor.id = notification_request.player_id
  left join public.reservations r on r.id = n.reservation_id
  where n.user_id = v_user_id
  order by n.created_at desc
  limit 50;
end;
$function$;

create or replace function private.mark_notifications_read(p_notification_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_user_id
    and read_at is null
    and (p_notification_ids is null or id = any(p_notification_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function private.list_open_courts()
returns table (
  reservation_id uuid,
  host_username text,
  start_at timestamptz,
  end_at timestamptz,
  player_count integer,
  available_spots integer,
  request_status text,
  is_host boolean
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
    r.id,
    p.username,
    r.start_at,
    r.end_at,
    (r.initial_player_count + coalesce(a.accepted_count, 0))::integer,
    greatest(4 - r.initial_player_count - coalesce(a.accepted_count, 0), 0)::integer,
    jr.status::text,
    r.host_id = v_user_id
  from public.reservations r
  join public.profiles p on p.id = r.host_id
  left join lateral (
    select count(*)::integer accepted_count
    from public.join_requests accepted
    where accepted.reservation_id = r.id and accepted.status = 'accepted'
  ) a on true
  left join public.join_requests jr
    on jr.reservation_id = r.id and jr.player_id = v_user_id
  where r.type = 'open'
    and r.status = 'confirmed'
    and r.end_at > now()
    and r.initial_player_count + coalesce(a.accepted_count, 0) < 4
  order by r.start_at;
end;
$function$;

create or replace function private.list_open_court_requests()
returns table (
  join_request_id uuid,
  reservation_id uuid,
  player_username text,
  start_at timestamptz,
  end_at timestamptz,
  requested_at timestamptz
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
  select jr.id, r.id, p.username, r.start_at, r.end_at, jr.requested_at
  from public.join_requests jr
  join public.reservations r on r.id = jr.reservation_id
  join public.profiles p on p.id = jr.player_id
  where r.host_id = v_user_id
    and r.type = 'open'
    and r.status = 'confirmed'
    and r.end_at > now()
    and jr.status = 'pending'
  order by jr.requested_at;
end;
$function$;

create or replace function private.request_open_court_join(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select r.host_id, r.initial_player_count
  into v_host_id, v_initial_count
  from public.reservations r
  where r.id = p_reservation_id
    and r.type = 'open'
    and r.status = 'confirmed'
    and r.end_at > now()
  for update;

  if v_host_id is null then
    raise exception 'Open Court not found.' using errcode = 'P0002';
  end if;
  if v_host_id = v_user_id then
    raise exception 'The host is already in this reservation.';
  end if;

  select count(*)::integer into v_accepted_count
  from public.join_requests jr
  where jr.reservation_id = p_reservation_id and jr.status = 'accepted';
  if v_initial_count + v_accepted_count >= 4 then
    raise exception 'This Open Court is full.';
  end if;

  insert into public.join_requests (reservation_id, player_id, status, requested_at, decided_at)
  values (p_reservation_id, v_user_id, 'pending', now(), null)
  on conflict (reservation_id, player_id)
  do update set status = 'pending', requested_at = now(), decided_at = null, updated_at = now()
  where public.join_requests.status in ('rejected', 'cancelled')
  returning id into v_request_id;

  if v_request_id is null then
    raise exception 'You already requested to join this Open Court.';
  end if;

  insert into public.notifications (user_id, reservation_id, join_request_id, event_type, delivery_status)
  values (v_host_id, p_reservation_id, v_request_id, 'join_request_created', 'pending');
  return v_request_id;
end;
$function$;

create or replace function private.respond_open_court_join(p_join_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_id uuid;
  v_player_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select jr.reservation_id, jr.player_id, r.initial_player_count
  into v_reservation_id, v_player_id, v_initial_count
  from public.join_requests jr
  join public.reservations r on r.id = jr.reservation_id
  where jr.id = p_join_request_id
    and jr.status = 'pending'
    and r.host_id = v_user_id
    and r.type = 'open'
    and r.status = 'confirmed'
    and r.end_at > now()
  for update of r, jr;

  if v_reservation_id is null then
    raise exception 'Pending join request not found.' using errcode = 'P0002';
  end if;

  if p_accept then
    select count(*)::integer into v_accepted_count
    from public.join_requests jr
    where jr.reservation_id = v_reservation_id and jr.status = 'accepted';
    if v_initial_count + v_accepted_count >= 4 then
      raise exception 'This Open Court is already full.';
    end if;

    insert into public.reservation_participants (reservation_id, player_id, role)
    values (v_reservation_id, v_player_id, 'member')
    on conflict (reservation_id, player_id) do nothing;
  end if;

  update public.join_requests
  set
    status = case when p_accept then 'accepted'::public.join_request_status else 'rejected'::public.join_request_status end,
    decided_at = now(),
    updated_at = now()
  where id = p_join_request_id;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_user_id
    and reservation_id = v_reservation_id
    and join_request_id = p_join_request_id
    and event_type = 'join_request_created';

  insert into public.notifications (user_id, reservation_id, join_request_id, event_type, delivery_status)
  values (
    v_player_id,
    v_reservation_id,
    p_join_request_id,
    case when p_accept then 'join_request_accepted'::public.notification_event_type else 'join_request_rejected'::public.notification_event_type end,
    'pending'
  );
  return p_join_request_id;
end;
$function$;

create or replace function public.list_player_notifications()
returns table (
  notification_id uuid, event_type text, created_at timestamptz, read_at timestamptz,
  reservation_id uuid, friendship_id uuid, join_request_id uuid, actor_username text,
  reservation_start_at timestamptz, reservation_end_at timestamptz
)
language sql stable set search_path = ''
as $function$ select * from private.list_player_notifications(); $function$;

create or replace function public.mark_notifications_read(p_notification_ids uuid[] default null)
returns integer language sql set search_path = ''
as $function$ select private.mark_notifications_read(p_notification_ids); $function$;

create or replace function public.list_open_courts()
returns table (
  reservation_id uuid, host_username text, start_at timestamptz, end_at timestamptz,
  player_count integer, available_spots integer, request_status text, is_host boolean
)
language sql stable set search_path = ''
as $function$ select * from private.list_open_courts(); $function$;

create or replace function public.list_open_court_requests()
returns table (
  join_request_id uuid, reservation_id uuid, player_username text,
  start_at timestamptz, end_at timestamptz, requested_at timestamptz
)
language sql stable set search_path = ''
as $function$ select * from private.list_open_court_requests(); $function$;

create or replace function public.request_open_court_join(p_reservation_id uuid)
returns uuid language sql set search_path = ''
as $function$ select private.request_open_court_join(p_reservation_id); $function$;

create or replace function public.respond_open_court_join(p_join_request_id uuid, p_accept boolean)
returns uuid language sql set search_path = ''
as $function$ select private.respond_open_court_join(p_join_request_id, p_accept); $function$;

revoke all on function private.list_player_notifications() from public;
revoke all on function private.mark_notifications_read(uuid[]) from public;
revoke all on function private.list_open_courts() from public;
revoke all on function private.list_open_court_requests() from public;
revoke all on function private.request_open_court_join(uuid) from public;
revoke all on function private.respond_open_court_join(uuid, boolean) from public;

revoke all on function public.list_player_notifications() from public;
revoke all on function public.mark_notifications_read(uuid[]) from public;
revoke all on function public.list_open_courts() from public;
revoke all on function public.list_open_court_requests() from public;
revoke all on function public.request_open_court_join(uuid) from public;
revoke all on function public.respond_open_court_join(uuid, boolean) from public;

grant execute on function public.list_player_notifications() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.list_open_courts() to authenticated;
grant execute on function public.list_open_court_requests() to authenticated;
grant execute on function public.request_open_court_join(uuid) to authenticated;
grant execute on function public.respond_open_court_join(uuid, boolean) to authenticated;

do $block$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$block$;

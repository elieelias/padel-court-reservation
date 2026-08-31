-- Complete the player-facing waitlist workflow.
--
-- There are two waitlist cases:
-- 1. A full Open Court: the first player is promoted automatically when a spot opens.
-- 2. A reserved court time: waiting players are notified when the host cancels it.

create or replace function private.promote_open_court_waitlist(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_initial_count integer;
  v_accepted_count integer;
  v_waitlist_id uuid;
  v_player_id uuid;
  v_request_id uuid;
begin
  -- Lock the reservation first so two simultaneous departures cannot promote
  -- more players than the four-player court capacity.
  select reservation.initial_player_count
  into v_initial_count
  from public.reservations reservation
  where reservation.id = p_reservation_id
    and reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.start_at > now()
  for update;

  if v_initial_count is null then
    return null;
  end if;

  select count(*)::integer
  into v_accepted_count
  from public.join_requests request
  where request.reservation_id = p_reservation_id
    and request.status = 'accepted';

  if v_initial_count + v_accepted_count >= 4 then
    return null;
  end if;

  -- SKIP LOCKED preserves FIFO order without allowing concurrent workers to
  -- promote the same player.
  select waitlist.id, waitlist.player_id
  into v_waitlist_id, v_player_id
  from public.reservation_waitlist waitlist
  where waitlist.reservation_id = p_reservation_id
    and waitlist.status = 'waiting'
  order by waitlist.joined_at, waitlist.id
  for update skip locked
  limit 1;

  if v_waitlist_id is null then
    return null;
  end if;

  insert into public.reservation_participants (reservation_id, player_id, role)
  values (p_reservation_id, v_player_id, 'member')
  on conflict (reservation_id, player_id) do nothing;

  insert into public.join_requests (
    reservation_id, player_id, status, requested_at, decided_at, updated_at
  ) values (
    p_reservation_id, v_player_id, 'accepted', now(), now(), now()
  )
  on conflict (reservation_id, player_id)
  do update set status = 'accepted', decided_at = now(), updated_at = now()
  returning id into v_request_id;

  update public.reservation_waitlist
  set status = 'promoted', resolved_at = now(), updated_at = now()
  where id = v_waitlist_id;

  insert into public.notifications (
    user_id, reservation_id, join_request_id, waitlist_id,
    event_type, event_key, delivery_status
  ) values (
    v_player_id, p_reservation_id, v_request_id, v_waitlist_id,
    'join_request_accepted', 'waitlist_promoted', 'pending'
  );

  return v_player_id;
end;
$function$;

-- A compact queue view for the signed-in player. It powers the dedicated
-- "My waitlist" section without exposing any other player's position.
create or replace function private.list_my_waitlists()
returns table (
  waitlist_id uuid,
  reservation_id uuid,
  reservation_type text,
  host_username text,
  start_at timestamptz,
  end_at timestamptz,
  queue_position integer,
  player_count integer,
  available_spots integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  select
    own_waitlist.id,
    reservation.id,
    reservation.type::text,
    host.username,
    reservation.start_at,
    reservation.end_at,
    (
      select count(*)::integer
      from public.reservation_waitlist ahead
      where ahead.reservation_id = reservation.id
        and ahead.status = 'waiting'
        and (ahead.joined_at, ahead.id) <= (own_waitlist.joined_at, own_waitlist.id)
    ),
    (
      reservation.initial_player_count + case
        when reservation.type = 'open' then (
          select count(*)::integer
          from public.join_requests accepted
          where accepted.reservation_id = reservation.id
            and accepted.status = 'accepted'
        )
        else 0
      end
    )::integer,
    case
      when reservation.type = 'open' then greatest(
        4 - reservation.initial_player_count - (
          select count(*)::integer
          from public.join_requests accepted
          where accepted.reservation_id = reservation.id
            and accepted.status = 'accepted'
        ),
        0
      )::integer
      else 0
    end
  from public.reservation_waitlist own_waitlist
  join public.reservations reservation on reservation.id = own_waitlist.reservation_id
  join public.profiles host on host.id = reservation.host_id
  where own_waitlist.player_id = v_user_id
    and own_waitlist.status = 'waiting'
    and reservation.status = 'confirmed'
    and reservation.start_at > now()
  order by reservation.start_at, own_waitlist.joined_at;
end;
$function$;

-- Only an Open Court host can see the identities of players queued for that
-- reservation. Other players can see only their own queue position.
create or replace function private.list_open_court_waitlist(p_reservation_id uuid)
returns table (
  waitlist_id uuid,
  player_username text,
  queue_position integer,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.reservations reservation
    where reservation.id = p_reservation_id
      and reservation.type = 'open'
      and reservation.host_id = v_user_id
  ) then
    return;
  end if;

  return query
  select
    waitlist.id,
    profile.username,
    row_number() over (order by waitlist.joined_at, waitlist.id)::integer,
    waitlist.joined_at
  from public.reservation_waitlist waitlist
  join public.profiles profile on profile.id = waitlist.player_id
  where waitlist.reservation_id = p_reservation_id
    and waitlist.status = 'waiting'
  order by waitlist.joined_at, waitlist.id;
end;
$function$;

create or replace function public.list_my_waitlists()
returns table (
  waitlist_id uuid, reservation_id uuid, reservation_type text,
  host_username text, start_at timestamptz, end_at timestamptz,
  queue_position integer, player_count integer, available_spots integer
)
language sql
stable
set search_path = ''
as $function$ select * from private.list_my_waitlists(); $function$;

create or replace function public.list_open_court_waitlist(p_reservation_id uuid)
returns table (
  waitlist_id uuid, player_username text, queue_position integer, joined_at timestamptz
)
language sql
stable
set search_path = ''
as $function$ select * from private.list_open_court_waitlist(p_reservation_id); $function$;

revoke all on function private.list_my_waitlists() from public;
revoke all on function private.list_open_court_waitlist(uuid) from public;
revoke all on function public.list_my_waitlists() from public, anon;
revoke all on function public.list_open_court_waitlist(uuid) from public, anon;

grant execute on function public.list_my_waitlists() to authenticated;
grant execute on function public.list_open_court_waitlist(uuid) to authenticated;
grant execute on function private.list_my_waitlists() to authenticated;
grant execute on function private.list_open_court_waitlist(uuid) to authenticated;
grant execute on function private.join_reservation_waitlist(uuid) to authenticated;
grant execute on function private.leave_reservation_waitlist(uuid) to authenticated;

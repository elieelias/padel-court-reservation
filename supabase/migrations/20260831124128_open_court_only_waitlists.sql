-- Waitlists are only for places in Open Courts, never private court bookings.
CREATE OR REPLACE FUNCTION private.list_calendar_waitlist_opportunities(p_date date)
 RETURNS TABLE(reservation_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, reservation_type text, waitlist_status text, waitlist_position integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_day_start timestamptz := p_date::timestamp at time zone 'Asia/Beirut';
  v_day_end timestamptz := (p_date + 1)::timestamp at time zone 'Asia/Beirut';
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  select
    reservation.id,
    reservation.start_at,
    reservation.end_at,
    reservation.type::text,
    own_waitlist.status,
    case when own_waitlist.status = 'waiting' then (
      select count(*)::integer
      from public.reservation_waitlist ahead
      where ahead.reservation_id = reservation.id
        and ahead.status = 'waiting'
        and (ahead.joined_at, ahead.id) <= (own_waitlist.joined_at, own_waitlist.id)
    ) else null end
  from public.reservations reservation
  left join public.reservation_waitlist own_waitlist
    on own_waitlist.reservation_id = reservation.id and own_waitlist.player_id = v_user_id
  where reservation.status in ('pending', 'confirmed')
    and reservation.start_at < v_day_end
    and reservation.end_at > v_day_start
    and reservation.type = 'open'
    and reservation.start_at > now()
    and reservation.initial_player_count + private.open_court_pending_invites(reservation.id) + (
      select count(*)::integer from public.join_requests accepted
      where accepted.reservation_id = reservation.id and accepted.status = 'accepted'
    ) >= 4
    and reservation.host_id <> v_user_id
    and not exists (
      select 1 from public.reservation_participants participant
      where participant.reservation_id = reservation.id and participant.player_id = v_user_id
    )
  order by reservation.start_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.join_reservation_waitlist(p_reservation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_type public.reservation_type;
  v_host_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
  v_waitlist_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select reservation.type, reservation.host_id, reservation.initial_player_count
  into v_reservation_type, v_host_id, v_initial_count
  from public.reservations reservation
  where reservation.id = p_reservation_id
    and reservation.status in ('pending', 'confirmed')
    and reservation.start_at > now()
  for update;

  if v_host_id is null then
    raise exception 'Upcoming reservation not found.' using errcode = 'P0002';
  end if;
  if v_reservation_type <> 'open' then
    raise exception 'Waitlists are only available for Open Courts.' using errcode = '22023';
  end if;
  if v_host_id = v_user_id or exists (
    select 1 from public.reservation_participants participant
    where participant.reservation_id = p_reservation_id and participant.player_id = v_user_id
  ) then
    raise exception 'You are already included in this reservation.';
  end if;

  if exists (select 1 from public.reservation_invitations where reservation_id = p_reservation_id and invitee_id = v_user_id and status = 'pending') then
    raise exception 'Respond to your reservation invitation first.';
  end if;

  if v_reservation_type = 'open' then
    select count(*)::integer into v_accepted_count
    from public.join_requests request
    where request.reservation_id = p_reservation_id and request.status = 'accepted';
    if v_initial_count + v_accepted_count + private.open_court_pending_invites(p_reservation_id) < 4 then
      raise exception 'This Open Court still has an available place.';
    end if;
  end if;

  insert into public.reservation_waitlist (
    reservation_id, player_id, status, joined_at, resolved_at, updated_at
  ) values (
    p_reservation_id, v_user_id, 'waiting', now(), null, now()
  )
  on conflict (reservation_id, player_id)
  do update set status = 'waiting', joined_at = now(), resolved_at = null, updated_at = now()
  where public.reservation_waitlist.status in ('left', 'cancelled', 'notified', 'promoted')
  returning id into v_waitlist_id;

  if v_waitlist_id is null then
    raise exception 'You are already on this waitlist.';
  end if;

  insert into public.notifications (
    user_id, reservation_id, waitlist_id, event_type, event_key, delivery_status
  ) values (
    v_host_id, p_reservation_id, v_waitlist_id, 'join_request_created', 'waitlist_joined', 'pending'
  );

  return v_waitlist_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.list_my_waitlists()
 RETURNS TABLE(waitlist_id uuid, reservation_id uuid, reservation_type text, host_username text, start_at timestamp with time zone, end_at timestamp with time zone, queue_position integer, player_count integer, available_spots integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        4 - reservation.initial_player_count - private.open_court_pending_invites(reservation.id) - (
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
    and reservation.status in ('pending', 'confirmed')
    and reservation.type = 'open'
    and reservation.start_at > now()
  order by reservation.start_at, own_waitlist.joined_at;
end;
$function$
;

-- Clients must use the authenticated, ownership-checked RPCs for changes.
-- These private helpers retain their existing security and grants.
revoke insert, update, delete on public.reservation_waitlist from authenticated, anon;

-- Retain historical rows, but retire any old private-booking waiting entries.
update public.reservation_waitlist w
set status = 'cancelled', resolved_at = now(), updated_at = now()
from public.reservations r
where r.id = w.reservation_id and r.type = 'private' and w.status = 'waiting';

create or replace function private.admin_list_open_courts()
returns table (
  reservation_id uuid,
  host_id uuid,
  host_username text,
  host_full_name text,
  host_email text,
  host_phone_number text,
  start_at timestamptz,
  end_at timestamptz,
  price numeric,
  payment_status public.payment_status,
  pass_code text,
  initial_player_count integer,
  accepted_count integer,
  pending_count integer,
  occupied_spots integer,
  available_spots integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return query
  select
    reservation.id,
    reservation.host_id,
    host.username,
    host.full_name,
    account.email::text,
    host.phone_number,
    reservation.start_at,
    reservation.end_at,
    reservation.price,
    reservation.payment_status,
    reservation.pass_code,
    reservation.initial_player_count::integer,
    coalesce(request_counts.accepted_count, 0)::integer,
    coalesce(request_counts.pending_count, 0)::integer,
    (reservation.initial_player_count + coalesce(request_counts.accepted_count, 0))::integer,
    greatest(4 - reservation.initial_player_count - coalesce(request_counts.accepted_count, 0), 0)::integer
  from public.reservations reservation
  join public.profiles host on host.id = reservation.host_id
  join auth.users account on account.id = reservation.host_id
  left join lateral (
    select
      count(*) filter (where request.status = 'accepted')::integer as accepted_count,
      count(*) filter (where request.status = 'pending')::integer as pending_count
    from public.join_requests request
    where request.reservation_id = reservation.id
  ) request_counts on true
  where reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.end_at > now()
  order by reservation.start_at, reservation.created_at;
end;
$function$;

create or replace function public.admin_list_open_courts()
returns table (
  reservation_id uuid,
  host_id uuid,
  host_username text,
  host_full_name text,
  host_email text,
  host_phone_number text,
  start_at timestamptz,
  end_at timestamptz,
  price numeric,
  payment_status public.payment_status,
  pass_code text,
  initial_player_count integer,
  accepted_count integer,
  pending_count integer,
  occupied_spots integer,
  available_spots integer
)
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_list_open_courts();
$function$;

create or replace function private.admin_list_open_court_requests(p_reservation_id uuid)
returns table (
  join_request_id uuid,
  player_id uuid,
  player_username text,
  player_full_name text,
  player_email text,
  player_phone_number text,
  request_status public.join_request_status,
  requested_at timestamptz,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.reservations reservation
    where reservation.id = p_reservation_id
      and reservation.type = 'open'
  ) then
    raise exception 'Open Court not found.' using errcode = 'P0002';
  end if;

  return query
  select
    request.id,
    request.player_id,
    player.username,
    player.full_name,
    account.email::text,
    player.phone_number,
    request.status,
    request.requested_at,
    request.decided_at
  from public.join_requests request
  join public.profiles player on player.id = request.player_id
  join auth.users account on account.id = request.player_id
  where request.reservation_id = p_reservation_id
    and request.status in ('pending', 'accepted')
  order by
    case request.status when 'pending' then 0 else 1 end,
    request.requested_at;
end;
$function$;

create or replace function public.admin_list_open_court_requests(p_reservation_id uuid)
returns table (
  join_request_id uuid,
  player_id uuid,
  player_username text,
  player_full_name text,
  player_email text,
  player_phone_number text,
  request_status public.join_request_status,
  requested_at timestamptz,
  decided_at timestamptz
)
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_list_open_court_requests(p_reservation_id);
$function$;

create or replace function private.admin_respond_open_court_request(
  p_join_request_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation_id uuid;
  v_host_id uuid;
  v_player_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  select request.reservation_id, reservation.host_id, request.player_id, reservation.initial_player_count
  into v_reservation_id, v_host_id, v_player_id, v_initial_count
  from public.join_requests request
  join public.reservations reservation on reservation.id = request.reservation_id
  where request.id = p_join_request_id
    and request.status = 'pending'
    and reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.end_at > now()
  for update of reservation, request;

  if v_reservation_id is null then
    raise exception 'Pending Open Court request not found.' using errcode = 'P0002';
  end if;

  if p_accept then
    select count(*)::integer
    into v_accepted_count
    from public.join_requests request
    where request.reservation_id = v_reservation_id
      and request.status = 'accepted';

    if v_initial_count + v_accepted_count >= 4 then
      raise exception 'This Open Court is already full.';
    end if;

    insert into public.reservation_participants (reservation_id, player_id, role)
    values (v_reservation_id, v_player_id, 'member')
    on conflict (reservation_id, player_id) do nothing;
  end if;

  update public.join_requests
  set
    status = case
      when p_accept then 'accepted'::public.join_request_status
      else 'rejected'::public.join_request_status
    end,
    decided_at = now(),
    updated_at = now()
  where id = p_join_request_id;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_host_id
    and join_request_id = p_join_request_id
    and event_type = 'join_request_created';

  insert into public.notifications (
    user_id,
    reservation_id,
    join_request_id,
    event_type,
    delivery_status
  )
  values (
    v_player_id,
    v_reservation_id,
    p_join_request_id,
    case
      when p_accept then 'join_request_accepted'::public.notification_event_type
      else 'join_request_rejected'::public.notification_event_type
    end,
    'pending'
  );

  return p_join_request_id;
end;
$function$;

create or replace function public.admin_respond_open_court_request(
  p_join_request_id uuid,
  p_accept boolean
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.admin_respond_open_court_request(p_join_request_id, p_accept);
$function$;

create or replace function private.admin_remove_open_court_participant(p_join_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation_id uuid;
  v_player_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  select request.reservation_id, request.player_id
  into v_reservation_id, v_player_id
  from public.join_requests request
  join public.reservations reservation on reservation.id = request.reservation_id
  where request.id = p_join_request_id
    and request.status = 'accepted'
    and reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.end_at > now()
  for update of reservation, request;

  if v_reservation_id is null then
    raise exception 'Accepted Open Court player not found.' using errcode = 'P0002';
  end if;

  delete from public.reservation_participants
  where reservation_id = v_reservation_id
    and player_id = v_player_id
    and role = 'member';

  update public.join_requests
  set status = 'cancelled', decided_at = now(), updated_at = now()
  where id = p_join_request_id;

  insert into public.notifications (
    user_id,
    reservation_id,
    join_request_id,
    event_type,
    delivery_status
  )
  values (
    v_player_id,
    v_reservation_id,
    p_join_request_id,
    'reservation_cancellation',
    'pending'
  );

  return p_join_request_id;
end;
$function$;

create or replace function public.admin_remove_open_court_participant(p_join_request_id uuid)
returns uuid
language sql
set search_path = ''
as $function$
  select private.admin_remove_open_court_participant(p_join_request_id);
$function$;

revoke all on function private.admin_list_open_courts() from public, anon;
revoke all on function private.admin_list_open_court_requests(uuid) from public, anon;
revoke all on function private.admin_respond_open_court_request(uuid, boolean) from public, anon;
revoke all on function private.admin_remove_open_court_participant(uuid) from public, anon;
grant execute on function private.admin_list_open_courts() to authenticated;
grant execute on function private.admin_list_open_court_requests(uuid) to authenticated;
grant execute on function private.admin_respond_open_court_request(uuid, boolean) to authenticated;
grant execute on function private.admin_remove_open_court_participant(uuid) to authenticated;

revoke all on function public.admin_list_open_courts() from public, anon;
revoke all on function public.admin_list_open_court_requests(uuid) from public, anon;
revoke all on function public.admin_respond_open_court_request(uuid, boolean) from public, anon;
revoke all on function public.admin_remove_open_court_participant(uuid) from public, anon;
grant execute on function public.admin_list_open_courts() to authenticated;
grant execute on function public.admin_list_open_court_requests(uuid) to authenticated;
grant execute on function public.admin_respond_open_court_request(uuid, boolean) to authenticated;
grant execute on function public.admin_remove_open_court_participant(uuid) to authenticated;

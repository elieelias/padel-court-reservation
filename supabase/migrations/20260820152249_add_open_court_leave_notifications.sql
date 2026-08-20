create or replace function private.leave_open_court(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_join_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select r.host_id, jr.id
  into v_host_id, v_join_request_id
  from public.reservations r
  join public.join_requests jr
    on jr.reservation_id = r.id
   and jr.player_id = v_user_id
   and jr.status = 'accepted'
  where r.id = p_reservation_id
    and r.type = 'open'
    and r.status = 'confirmed'
    and r.start_at > now()
    and r.host_id <> v_user_id
  for update of r, jr;

  if v_join_request_id is null then
    raise exception 'An upcoming Open Court spot was not found.' using errcode = 'P0002';
  end if;

  delete from public.reservation_participants
  where reservation_id = p_reservation_id
    and player_id = v_user_id
    and role = 'member';

  update public.join_requests
  set status = 'cancelled', decided_at = now(), updated_at = now()
  where id = v_join_request_id;

  insert into public.notifications (
    user_id,
    reservation_id,
    join_request_id,
    event_type,
    delivery_status
  )
  values (
    v_host_id,
    p_reservation_id,
    v_join_request_id,
    'participant_removed',
    'pending'
  );

  return p_reservation_id;
end;
$function$;

create or replace function public.leave_open_court(p_reservation_id uuid)
returns uuid
language sql
set search_path = ''
as $function$
  select private.leave_open_court(p_reservation_id);
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
    and (
      r.initial_player_count + coalesce(a.accepted_count, 0) < 4
      or r.host_id = v_user_id
      or jr.status in ('pending', 'accepted')
    )
  order by r.start_at;
end;
$function$;

revoke all on function private.leave_open_court(uuid) from public;
revoke all on function public.leave_open_court(uuid) from public, anon;
grant execute on function private.leave_open_court(uuid) to authenticated;
grant execute on function public.leave_open_court(uuid) to authenticated;

create or replace function private.admin_search_reservations(
  p_search text default null,
  p_status public.reservation_status default null,
  p_payment_status public.payment_status default null,
  p_type public.reservation_type default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  reservation_id uuid,
  host_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  type public.reservation_type,
  status public.reservation_status,
  price numeric,
  initial_player_count smallint,
  payment_status public.payment_status,
  payment_confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  pass_token uuid,
  pass_code text,
  host_username text,
  host_full_name text,
  host_email text,
  host_phone_number text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
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
    reservation.start_at,
    reservation.end_at,
    reservation.type,
    reservation.status,
    reservation.price,
    reservation.initial_player_count,
    reservation.payment_status,
    reservation.payment_confirmed_at,
    reservation.cancelled_at,
    reservation.created_at,
    reservation.updated_at,
    reservation.pass_token,
    reservation.pass_code,
    host.username,
    host.full_name,
    host_user.email::text,
    host.phone_number,
    count(*) over()
  from public.reservations reservation
  join public.profiles host on host.id = reservation.host_id
  left join auth.users host_user on host_user.id = reservation.host_id
  where (p_status is null or reservation.status = p_status)
    and (p_payment_status is null or reservation.payment_status = p_payment_status)
    and (p_type is null or reservation.type = p_type)
    and (p_start_at is null or reservation.start_at >= p_start_at)
    and (p_end_at is null or reservation.start_at < p_end_at)
    and (
      v_search = ''
      or lower(reservation.pass_code) like '%' || v_search || '%'
      or lower(host.username) like '%' || v_search || '%'
      or lower(coalesce(host.full_name, '')) like '%' || v_search || '%'
      or lower(coalesce(host_user.email::text, '')) like '%' || v_search || '%'
      or lower(coalesce(host.phone_number, '')) like '%' || v_search || '%'
      or exists (
        select 1
        from public.reservation_participants participant
        join public.profiles participant_profile on participant_profile.id = participant.player_id
        left join auth.users participant_user on participant_user.id = participant.player_id
        where participant.reservation_id = reservation.id
          and (
            lower(participant_profile.username) like '%' || v_search || '%'
            or lower(coalesce(participant_profile.full_name, '')) like '%' || v_search || '%'
            or lower(coalesce(participant_user.email::text, '')) like '%' || v_search || '%'
            or lower(coalesce(participant_profile.phone_number, '')) like '%' || v_search || '%'
          )
      )
    )
  order by reservation.start_at desc, reservation.id
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

create or replace function public.admin_search_reservations(
  p_search text default null,
  p_status public.reservation_status default null,
  p_payment_status public.payment_status default null,
  p_type public.reservation_type default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  reservation_id uuid,
  host_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  type public.reservation_type,
  status public.reservation_status,
  price numeric,
  initial_player_count smallint,
  payment_status public.payment_status,
  payment_confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  pass_token uuid,
  pass_code text,
  host_username text,
  host_full_name text,
  host_email text,
  host_phone_number text,
  total_count bigint
)
language sql
stable
set search_path = ''
as $function$
  select *
  from private.admin_search_reservations(
    p_search,
    p_status,
    p_payment_status,
    p_type,
    p_start_at,
    p_end_at,
    p_limit,
    p_offset
  );
$function$;

revoke all on function private.admin_search_reservations(text, public.reservation_status, public.payment_status, public.reservation_type, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function private.admin_search_reservations(text, public.reservation_status, public.payment_status, public.reservation_type, timestamptz, timestamptz, integer, integer) to authenticated;
revoke all on function public.admin_search_reservations(text, public.reservation_status, public.payment_status, public.reservation_type, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_search_reservations(text, public.reservation_status, public.payment_status, public.reservation_type, timestamptz, timestamptz, integer, integer) to authenticated;

comment on function public.admin_search_reservations(text, public.reservation_status, public.payment_status, public.reservation_type, timestamptz, timestamptz, integer, integer) is
  'Administrator-only paginated reservation archive search across hosts, participants, pass codes, dates, status, type, and payment status.';

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

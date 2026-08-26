grant execute on function private.list_open_courts() to authenticated;
grant execute on function private.list_private_reservation_invitations() to authenticated;
grant execute on function private.list_calendar_waitlist_opportunities(date) to authenticated;

create or replace function private.admin_lookup_reservation_receipt(p_receipt_value text)
returns table (
  id uuid,
  host_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  type public.reservation_type,
  status public.reservation_status,
  price numeric,
  payment_status public.payment_status,
  payment_confirmed_at timestamptz,
  initial_player_count smallint,
  pass_token uuid,
  pass_code text,
  created_at timestamptz,
  updated_at timestamptz,
  cancelled_at timestamptz,
  host_email text,
  host_full_name text,
  host_phone_number text,
  host_username text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_receipt_value text := btrim(coalesce(p_receipt_value, ''));
  v_token_text text;
  v_token uuid;
  v_pass_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  if v_receipt_value = '' then return; end if;

  -- Accept the old app payload, a raw UUID, or the UUID inside the new HTTPS receipt URL.
  v_token_text := substring(
    v_receipt_value
    from '(?i)([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})'
  );

  if v_token_text is not null then
    v_token := v_token_text::uuid;
  else
    v_pass_code := upper(regexp_replace(v_receipt_value, '[[:space:]-]+', '', 'g'));
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
    reservation.payment_status,
    reservation.payment_confirmed_at,
    reservation.initial_player_count,
    reservation.pass_token,
    reservation.pass_code,
    reservation.created_at,
    reservation.updated_at,
    reservation.cancelled_at,
    user_account.email::text,
    profile.full_name,
    profile.phone_number,
    profile.username
  from public.reservations reservation
  join public.profiles profile on profile.id = reservation.host_id
  join auth.users user_account on user_account.id = reservation.host_id
  where
    (v_token is not null and reservation.pass_token = v_token)
    or (v_pass_code is not null and upper(reservation.pass_code) = v_pass_code)
  limit 1;
end;
$function$;

create or replace function public.lookup_reservation_receipt(p_pass_token uuid)
returns table (
  facility_name text,
  start_at timestamptz,
  end_at timestamptz,
  reservation_type text,
  reservation_status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    settings.facility_name,
    reservation.start_at,
    reservation.end_at,
    reservation.type::text,
    reservation.status::text
  from public.reservations reservation
  cross join public.facility_settings settings
  where reservation.pass_token = p_pass_token
    and settings.id = 1
  limit 1;
$function$;

revoke all on function public.lookup_reservation_receipt(uuid) from public;
grant execute on function public.lookup_reservation_receipt(uuid) to anon, authenticated;

comment on function public.lookup_reservation_receipt(uuid) is
  'Returns non-sensitive validation details to anyone holding the unguessable receipt token.';

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

  if v_receipt_value = '' then
    return;
  end if;

  v_token_text := substring(
    v_receipt_value
    from '(?i)padel-one:reservation:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})'
  );

  if v_token_text is null and v_receipt_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_token_text := v_receipt_value;
  end if;

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

create or replace function public.admin_lookup_reservation_receipt(p_receipt_value text)
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
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_lookup_reservation_receipt(p_receipt_value);
$function$;

revoke all on function private.admin_lookup_reservation_receipt(text) from public, anon;
revoke all on function public.admin_lookup_reservation_receipt(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.admin_lookup_reservation_receipt(text) to authenticated;
grant execute on function public.admin_lookup_reservation_receipt(text) to authenticated;

comment on function public.admin_lookup_reservation_receipt(text) is
  'Looks up one reservation receipt by QR payload, token, or backup code for an authenticated administrator.';

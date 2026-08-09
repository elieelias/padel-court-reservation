create or replace function private.admin_list_players()
returns table (
  id uuid,
  email text,
  full_name text,
  phone_number text,
  role public.user_role,
  created_at timestamptz,
  last_sign_in_at timestamptz
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
    p.id,
    u.email::text,
    p.full_name,
    p.phone_number,
    p.role,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'player'::public.user_role
  order by lower(coalesce(p.full_name, u.email::text)), p.created_at;
end;
$function$;

create or replace function public.admin_list_players()
returns table (
  id uuid,
  email text,
  full_name text,
  phone_number text,
  role public.user_role,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_list_players();
$function$;

revoke all on function private.admin_list_players() from public, anon;
grant execute on function private.admin_list_players() to authenticated;
revoke all on function public.admin_list_players() from public, anon;
grant execute on function public.admin_list_players() to authenticated;

create or replace function private.admin_update_player_profile(
  p_player_id uuid,
  p_full_name text,
  p_phone_number text
)
returns uuid
language plpgsql
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

  update public.profiles
  set
    full_name = nullif(btrim(p_full_name), ''),
    phone_number = nullif(btrim(p_phone_number), '')
  where id = p_player_id
    and role = 'player'::public.user_role;

  if not found then
    raise exception 'Player account not found.' using errcode = 'P0002';
  end if;

  return p_player_id;
end;
$function$;

create or replace function public.admin_update_player_profile(
  p_player_id uuid,
  p_full_name text,
  p_phone_number text
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.admin_update_player_profile(p_player_id, p_full_name, p_phone_number);
$function$;

revoke all on function private.admin_update_player_profile(uuid, text, text) from public, anon;
grant execute on function private.admin_update_player_profile(uuid, text, text) to authenticated;
revoke all on function public.admin_update_player_profile(uuid, text, text) from public, anon;
grant execute on function public.admin_update_player_profile(uuid, text, text) to authenticated;

create or replace function private.admin_update_reservation(
  p_reservation_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_type public.reservation_type,
  p_status public.reservation_status,
  p_price numeric,
  p_initial_player_count smallint
)
returns uuid
language plpgsql
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

  if p_end_at <= p_start_at then
    raise exception 'Reservation end time must be after its start time.';
  end if;

  if p_price < 0 then
    raise exception 'Reservation price cannot be negative.';
  end if;

  if p_status not in ('pending', 'confirmed', 'completed') then
    raise exception 'Use the administrator cancellation action to cancel a reservation.';
  end if;

  if p_type = 'open' and (p_initial_player_count < 1 or p_initial_player_count > 4) then
    raise exception 'Open Court player count must be between 1 and 4.';
  end if;

  update public.reservations
  set
    start_at = p_start_at,
    end_at = p_end_at,
    type = p_type,
    status = p_status,
    price = p_price,
    initial_player_count = case
      when p_type = 'private' then 1
      else p_initial_player_count
    end
  where id = p_reservation_id
    and status in ('pending', 'confirmed', 'completed');

  if not found then
    raise exception 'Editable reservation not found.' using errcode = 'P0002';
  end if;

  return p_reservation_id;
end;
$function$;

create or replace function public.admin_update_reservation(
  p_reservation_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_type public.reservation_type,
  p_status public.reservation_status,
  p_price numeric,
  p_initial_player_count smallint
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.admin_update_reservation(
    p_reservation_id,
    p_start_at,
    p_end_at,
    p_type,
    p_status,
    p_price,
    p_initial_player_count
  );
$function$;

revoke all on function private.admin_update_reservation(uuid, timestamptz, timestamptz, public.reservation_type, public.reservation_status, numeric, smallint) from public, anon;
grant execute on function private.admin_update_reservation(uuid, timestamptz, timestamptz, public.reservation_type, public.reservation_status, numeric, smallint) to authenticated;
revoke all on function public.admin_update_reservation(uuid, timestamptz, timestamptz, public.reservation_type, public.reservation_status, numeric, smallint) from public, anon;
grant execute on function public.admin_update_reservation(uuid, timestamptz, timestamptz, public.reservation_type, public.reservation_status, numeric, smallint) to authenticated;

create or replace function private.admin_cancel_reservation(p_reservation_id uuid)
returns uuid
language plpgsql
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

  update public.reservations
  set status = 'cancelled', cancelled_at = now()
  where id = p_reservation_id
    and status in ('pending', 'confirmed');

  if not found then
    raise exception 'Active reservation not found.' using errcode = 'P0002';
  end if;

  insert into public.notifications (user_id, reservation_id, event_type, delivery_status)
  select rp.player_id, p_reservation_id, 'reservation_cancellation', 'pending'
  from public.reservation_participants rp
  where rp.reservation_id = p_reservation_id;

  return p_reservation_id;
end;
$function$;

create or replace function public.admin_cancel_reservation(p_reservation_id uuid)
returns uuid
language sql
set search_path = ''
as $function$
  select private.admin_cancel_reservation(p_reservation_id);
$function$;

revoke all on function private.admin_cancel_reservation(uuid) from public, anon;
grant execute on function private.admin_cancel_reservation(uuid) to authenticated;
revoke all on function public.admin_cancel_reservation(uuid) from public, anon;
grant execute on function public.admin_cancel_reservation(uuid) to authenticated;

create or replace function private.admin_confirm_cash_payment(p_reservation_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  update public.reservations
  set
    payment_status = 'paid',
    payment_confirmed_at = coalesce(payment_confirmed_at, now())
  where id = p_reservation_id
    and status not in ('cancelled', 'expired')
  returning payment_confirmed_at into v_confirmed_at;

  if not found then
    raise exception 'Payable reservation not found.' using errcode = 'P0002';
  end if;

  return v_confirmed_at;
end;
$function$;

create or replace function public.admin_confirm_cash_payment(p_reservation_id uuid)
returns timestamptz
language sql
set search_path = ''
as $function$
  select private.admin_confirm_cash_payment(p_reservation_id);
$function$;

revoke all on function private.admin_confirm_cash_payment(uuid) from public, anon;
grant execute on function private.admin_confirm_cash_payment(uuid) to authenticated;
revoke all on function public.admin_confirm_cash_payment(uuid) from public, anon;
grant execute on function public.admin_confirm_cash_payment(uuid) to authenticated;

comment on function public.admin_list_players() is 'Administrator-only list of player accounts and contact information.';
comment on function public.admin_update_player_profile(uuid, text, text) is 'Administrator-only player profile update.';
comment on function public.admin_update_reservation(uuid, timestamptz, timestamptz, public.reservation_type, public.reservation_status, numeric, smallint) is 'Administrator-only reservation update with server validation.';
comment on function public.admin_cancel_reservation(uuid) is 'Administrator-only reservation cancellation.';
comment on function public.admin_confirm_cash_payment(uuid) is 'Administrator-only cash payment confirmation using database time.';

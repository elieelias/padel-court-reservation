grant update (full_name, phone_number) on table public.profiles to authenticated;

create or replace function private.cancel_reservation(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_start_at timestamptz;
  v_status public.reservation_status;
  v_cancellation_hours smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select r.start_at, r.status
  into v_start_at, v_status
  from public.reservations r
  where r.id = p_reservation_id and r.host_id = v_user_id
  for update;

  if not found then
    raise exception 'Reservation not found or you are not its host.' using errcode = '42501';
  end if;

  if v_status not in ('pending', 'confirmed') then
    raise exception 'Only an active reservation can be cancelled.';
  end if;

  select fs.cancellation_hours into v_cancellation_hours
  from public.facility_settings fs where fs.id = 1;

  if v_cancellation_hours is null then
    raise exception 'Facility settings have not been configured.';
  end if;

  if v_start_at <= now() + make_interval(hours => v_cancellation_hours) then
    raise exception 'This reservation is past the cancellation deadline.';
  end if;

  update public.reservations
  set status = 'cancelled', cancelled_at = now()
  where id = p_reservation_id;

  insert into public.notifications (user_id, reservation_id, event_type, delivery_status)
  select rp.player_id, p_reservation_id, 'reservation_cancellation', 'pending'
  from public.reservation_participants rp
  where rp.reservation_id = p_reservation_id
  on conflict do nothing;

  return p_reservation_id;
end;
$function$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns uuid
language sql
set search_path = ''
as $function$
  select private.cancel_reservation(p_reservation_id);
$function$;

revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;

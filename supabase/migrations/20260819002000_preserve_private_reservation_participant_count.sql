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
      when p_type = 'private' then (
        select count(*)::smallint
        from public.reservation_participants rp
        where rp.reservation_id = p_reservation_id
      )
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

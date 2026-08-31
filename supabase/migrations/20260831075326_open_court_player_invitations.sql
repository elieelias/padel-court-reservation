-- Named invitations replace the anonymous headcount on new Open Courts.
set local search_path = public, extensions;

-- Both booking types use the same invitation inbox and explicit response.
create or replace function private.respond_reservation_invitation(p_invitation_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); booking public.reservations%rowtype;
  booking_id uuid; invitation public.reservation_invitations%rowtype; occupied integer;
begin
  if actor is null then raise exception 'Authentication is required.' using errcode='28000'; end if;
  if p_accept is null then raise exception 'Choose accept or decline.'; end if;
  select reservation_id into booking_id from public.reservation_invitations where id=p_invitation_id and invitee_id=actor;
  -- Lock the booking before its invitation, matching host removals and join requests.
  select * into booking from public.reservations where id=booking_id for update;
  if not found or booking.status not in ('pending','confirmed') or booking.start_at <= now() then
    raise exception 'Upcoming reservation invitation not found.' using errcode='P0002';
  end if;
  select * into invitation from public.reservation_invitations where id=p_invitation_id and invitee_id=actor and status='pending' for update;
  if not found then raise exception 'Pending reservation invitation not found.' using errcode='P0002'; end if;
  if p_accept then
    if booking.type='open' then
      select booking.initial_player_count + count(*) into occupied from public.join_requests where reservation_id=booking_id and status='accepted';
    else
      select count(*) into occupied from public.reservation_participants where reservation_id=booking_id;
    end if;
    if occupied >= 4 then raise exception 'This reservation already has four confirmed players.'; end if;
  end if;
  -- Release the invitation hold before recording the accepted place (never count both).
  update public.reservation_invitations set status=case when p_accept then 'accepted' else 'declined' end,
    responded_at=now(), updated_at=now() where id=p_invitation_id;
  if p_accept then
    insert into public.reservation_participants(reservation_id,player_id,role)
    values(booking_id,actor,'member') on conflict do nothing;
    if booking.type='open' then
      insert into public.join_requests(reservation_id,player_id,status,decided_at)
      values(booking_id,actor,'accepted',now())
      on conflict(reservation_id,player_id) do update set status='accepted',decided_at=now();
      update public.reservation_waitlist set status='left',resolved_at=now()
      where reservation_id=booking_id and player_id=actor and status='waiting';
    end if;
  elsif booking.type='open' then
    perform private.promote_open_court_waitlist(booking_id);
  end if;
  update public.notifications set read_at=coalesce(read_at,now())
    where user_id=actor and invitation_id=p_invitation_id and event_key='reservation_invitation';
  insert into public.notifications(user_id,reservation_id,invitation_id,event_type,event_key,delivery_status)
  values(booking.host_id,booking_id,p_invitation_id,
    case when p_accept then 'reservation_confirmation'::public.notification_event_type else 'join_request_rejected'::public.notification_event_type end,
    case when p_accept then 'reservation_invitation_accepted' else 'reservation_invitation_declined' end,'pending');
  return p_invitation_id;
end;
$$;

-- Internal helper: pending invitations hold a place but do not confirm a player.
create function private.open_court_pending_invites(p_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.reservation_invitations
  where reservation_id = p_id and status = 'pending';
$$;
revoke all on function private.open_court_pending_invites(uuid) from public, anon, authenticated;

create function private.create_open_reservation(p_start_at timestamptz, p_end_at timestamptz, p_friend_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare booking_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '28000'; end if;
  -- Reuse atomic friend validation and invitation creation. No invitation is auto-accepted.
  booking_id := private.create_private_reservation(p_start_at,p_end_at,p_friend_ids);
  update public.reservations set type = 'open', initial_player_count = 1 where id = booking_id;
  return booking_id;
end;
$$;
create function public.create_open_reservation(p_start_at timestamptz,p_end_at timestamptz,p_friend_ids uuid[])
returns uuid language sql set search_path = '' as $$
  select private.create_open_reservation(p_start_at,p_end_at,p_friend_ids);
$$;
revoke all on function private.create_open_reservation(timestamptz,timestamptz,uuid[]) from public, anon;
revoke all on function public.create_open_reservation(timestamptz,timestamptz,uuid[]) from public, anon;
grant execute on function private.create_open_reservation(timestamptz,timestamptz,uuid[]) to authenticated;
grant execute on function public.create_open_reservation(timestamptz,timestamptz,uuid[]) to authenticated;

CREATE OR REPLACE FUNCTION private.create_reservation(p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_type reservation_type, p_initial_player_count smallint DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_id uuid;
  v_timezone text;
  v_default_price numeric(10, 2);
  v_discount_enabled boolean;
  v_discount_name text;
  v_discount_percentage numeric(5, 2);
  v_discount_starts_at timestamptz;
  v_discount_ends_at timestamptz;
  v_applied_discount_percentage numeric(5, 2) := 0;
  v_discount_amount numeric(10, 2) := 0;
  v_final_price numeric(10, 2);
  v_local_start timestamp;
  v_local_end timestamp;
  v_opening_time time;
  v_closing_time time;
  v_slot_duration smallint;
  v_duration_seconds bigint;
  v_start_offset_seconds bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = v_user_id) then
    raise exception 'A player profile is required before making a reservation.';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'The reservation end time must be later than its start time.';
  end if;
  if p_start_at <= now() then
    raise exception 'Reservations must start in the future.';
  end if;
  if p_type = 'private' and p_initial_player_count <> 1 then
    raise exception 'A private reservation must use an initial player count of one.';
  end if;
  if p_type = 'open' and p_initial_player_count <> 1 then
    raise exception 'Select and invite your players instead of entering a guest count.';
  end if;
  if p_initial_player_count not between 1 and 4 then
    raise exception 'The initial player count must be between one and four.';
  end if;

  select
    settings.timezone,
    settings.default_price,
    settings.discount_enabled,
    settings.discount_name,
    settings.discount_percentage,
    settings.discount_starts_at,
    settings.discount_ends_at
  into
    v_timezone,
    v_default_price,
    v_discount_enabled,
    v_discount_name,
    v_discount_percentage,
    v_discount_starts_at,
    v_discount_ends_at
  from public.facility_settings settings
  where settings.id = 1;

  if v_timezone is null or v_default_price is null then
    raise exception 'Facility settings have not been configured.';
  end if;

  if v_discount_enabled
    and v_discount_percentage > 0
    and (v_discount_starts_at is null or p_start_at >= v_discount_starts_at)
    and (v_discount_ends_at is null or p_start_at < v_discount_ends_at)
  then
    v_applied_discount_percentage := v_discount_percentage;
    v_discount_amount := round(v_default_price * v_applied_discount_percentage / 100, 2);
  end if;
  v_final_price := greatest(v_default_price - v_discount_amount, 0);

  v_local_start := p_start_at at time zone v_timezone;
  v_local_end := p_end_at at time zone v_timezone;
  if v_local_start::date <> v_local_end::date then
    raise exception 'A reservation must start and end on the same local date.';
  end if;

  select rule.opening_time, rule.closing_time, rule.slot_duration_minutes
  into v_opening_time, v_closing_time, v_slot_duration
  from public.schedule_rules rule
  where rule.day_of_week = extract(dow from v_local_start)::smallint
    and rule.is_open;

  if not found then
    raise exception 'The facility is closed on the selected day.';
  end if;
  if v_local_start::time < v_opening_time or v_local_end::time > v_closing_time then
    raise exception 'The selected time is outside the facility opening hours.';
  end if;

  v_duration_seconds := extract(epoch from (p_end_at - p_start_at))::bigint;
  v_start_offset_seconds := extract(epoch from (v_local_start::time - v_opening_time))::bigint;
  if mod(v_duration_seconds, v_slot_duration::bigint * 60) <> 0 then
    raise exception 'The reservation duration must use complete schedule slots.';
  end if;
  if mod(v_start_offset_seconds, v_slot_duration::bigint * 60) <> 0 then
    raise exception 'The reservation must begin on a valid schedule boundary.';
  end if;

  if exists (
    select 1 from public.blocked_periods period
    where tstzrange(period.start_at, period.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'The selected time is blocked by the facility.';
  end if;
  if exists (
    select 1 from public.reservations reservation
    where reservation.status in ('pending', 'confirmed')
      and tstzrange(reservation.start_at, reservation.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'The selected time is no longer available.';
  end if;

  begin
    insert into public.reservations (
      host_id,
      start_at,
      end_at,
      type,
      status,
      price,
      base_price,
      discount_percentage,
      discount_amount,
      discount_name,
      payment_status,
      initial_player_count
    ) values (
      v_user_id,
      p_start_at,
      p_end_at,
      p_type,
      'pending',
      v_final_price,
      v_default_price,
      v_applied_discount_percentage,
      v_discount_amount,
      case when v_applied_discount_percentage > 0 then nullif(btrim(v_discount_name), '') else null end,
      'unpaid',
      p_initial_player_count
    ) returning id into v_reservation_id;
  exception
    when exclusion_violation then
      raise exception 'The selected time is no longer available. Please refresh and choose another slot.';
  end;

  insert into public.reservation_participants (reservation_id, player_id, role)
  values (v_reservation_id, v_user_id, 'host');

  -- The deferred lifecycle trigger sends the correct final status notification.

  return v_reservation_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_recurring_reservations(p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_type reservation_type, p_initial_player_count smallint, p_friend_ids uuid[], p_occurrence_count smallint)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_series_id uuid;
  v_reservation_id uuid;
  v_reservation_ids uuid[] := '{}'::uuid[];
  v_occurrence smallint;
  v_offset interval;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if p_occurrence_count not between 2 and 4 then
    raise exception 'A recurring reservation must contain between two and four weekly bookings.';
  end if;
  if p_type = 'open' and p_initial_player_count <> 1 then
    raise exception 'Select and invite your players instead of entering a guest count.';
  end if;

  insert into public.reservation_series (host_id, occurrence_count)
  values (v_user_id, p_occurrence_count)
  returning id into v_series_id;

  -- One database function call is one transaction: any unavailable week rolls back the entire series.
  for v_occurrence in 1..p_occurrence_count loop
    v_offset := make_interval(days => (v_occurrence - 1) * 7);

    if p_type = 'private' then
      v_reservation_id := private.create_private_reservation(
        p_start_at + v_offset,
        p_end_at + v_offset,
        coalesce(p_friend_ids, '{}'::uuid[])
      );
    else
      v_reservation_id := private.create_open_reservation(
        p_start_at + v_offset,
        p_end_at + v_offset,
        coalesce(p_friend_ids, '{}'::uuid[])
      );
    end if;

    update public.reservations
    set series_id = v_series_id,
        series_occurrence = v_occurrence
    where id = v_reservation_id
      and host_id = v_user_id;

    if not found then
      raise exception 'The recurring reservation could not be linked to its series.';
    end if;

    v_reservation_ids := array_append(v_reservation_ids, v_reservation_id);
  end loop;

  return v_reservation_ids;
end;
$function$;

CREATE OR REPLACE FUNCTION private.request_open_court_join(p_reservation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select r.host_id, r.initial_player_count
  into v_host_id, v_initial_count
  from public.reservations r
  where r.id = p_reservation_id
    and r.type = 'open'
    and r.status in ('pending', 'confirmed')
    and r.start_at > now()
  for update;

  if v_host_id is null then
    raise exception 'Open Court not found.' using errcode = 'P0002';
  end if;
  if v_host_id = v_user_id then
    raise exception 'The host is already in this reservation.';
  end if;

  if exists (select 1 from public.reservation_invitations where reservation_id = p_reservation_id and invitee_id = v_user_id and status = 'pending') then
    raise exception 'Respond to your reservation invitation first.';
  end if;

  select count(*)::integer into v_accepted_count
  from public.join_requests jr
  where jr.reservation_id = p_reservation_id and jr.status = 'accepted';
  if v_initial_count + v_accepted_count + private.open_court_pending_invites(p_reservation_id) >= 4 then
    raise exception 'This Open Court is full.';
  end if;

  insert into public.join_requests (reservation_id, player_id, status, requested_at, decided_at)
  values (p_reservation_id, v_user_id, 'pending', now(), null)
  on conflict (reservation_id, player_id)
  do update set status = 'pending', requested_at = now(), decided_at = null, updated_at = now()
  where public.join_requests.status in ('rejected', 'cancelled')
  returning id into v_request_id;

  if v_request_id is null then
    raise exception 'You already requested to join this Open Court.';
  end if;

  insert into public.notifications (user_id, reservation_id, join_request_id, event_type, delivery_status)
  values (v_host_id, p_reservation_id, v_request_id, 'join_request_created', 'pending');
  return v_request_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.respond_open_court_join(p_join_request_id uuid, p_accept boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_id uuid;
  v_player_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select jr.reservation_id, jr.player_id, r.initial_player_count
  into v_reservation_id, v_player_id, v_initial_count
  from public.join_requests jr
  join public.reservations r on r.id = jr.reservation_id
  where jr.id = p_join_request_id
    and jr.status = 'pending'
    and r.host_id = v_user_id
    and r.type = 'open'
    and r.status in ('pending', 'confirmed')
    and r.start_at > now()
  for update of r, jr;

  if v_reservation_id is null then
    raise exception 'Pending join request not found.' using errcode = 'P0002';
  end if;

  if p_accept then
    select count(*)::integer into v_accepted_count
    from public.join_requests jr
    where jr.reservation_id = v_reservation_id and jr.status = 'accepted';
    if v_initial_count + v_accepted_count + private.open_court_pending_invites(v_reservation_id) >= 4 then
      raise exception 'This Open Court is already full.';
    end if;

    insert into public.reservation_participants (reservation_id, player_id, role)
    values (v_reservation_id, v_player_id, 'member')
    on conflict (reservation_id, player_id) do nothing;
  end if;

  update public.join_requests
  set
    status = case when p_accept then 'accepted'::public.join_request_status else 'rejected'::public.join_request_status end,
    decided_at = now(),
    updated_at = now()
  where id = p_join_request_id;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_user_id
    and reservation_id = v_reservation_id
    and join_request_id = p_join_request_id
    and event_type = 'join_request_created';

  insert into public.notifications (user_id, reservation_id, join_request_id, event_type, delivery_status)
  values (
    v_player_id,
    v_reservation_id,
    p_join_request_id,
    case when p_accept then 'join_request_accepted'::public.notification_event_type else 'join_request_rejected'::public.notification_event_type end,
    'pending'
  );
  return p_join_request_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.admin_respond_open_court_request(p_join_request_id uuid, p_accept boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and reservation.status in ('pending', 'confirmed')
    and reservation.start_at > now()
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

    if v_initial_count + v_accepted_count + private.open_court_pending_invites(v_reservation_id) >= 4 then
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

CREATE OR REPLACE FUNCTION private.promote_open_court_waitlist(p_reservation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_initial_count integer;
  v_accepted_count integer;
  v_waitlist_id uuid;
  v_player_id uuid;
  v_request_id uuid;
begin
  -- Lock the reservation first so two simultaneous departures cannot promote
  -- more players than the four-player court capacity.
  select reservation.initial_player_count
  into v_initial_count
  from public.reservations reservation
  where reservation.id = p_reservation_id
    and reservation.type = 'open'
    and reservation.status in ('pending', 'confirmed')
    and reservation.start_at > now()
  for update;

  if v_initial_count is null then
    return null;
  end if;

  select count(*)::integer
  into v_accepted_count
  from public.join_requests request
  where request.reservation_id = p_reservation_id
    and request.status = 'accepted';

  if v_initial_count + v_accepted_count + private.open_court_pending_invites(p_reservation_id) >= 4 then
    return null;
  end if;

  -- SKIP LOCKED preserves FIFO order without allowing concurrent workers to
  -- promote the same player.
  select waitlist.id, waitlist.player_id
  into v_waitlist_id, v_player_id
  from public.reservation_waitlist waitlist
  where waitlist.reservation_id = p_reservation_id
    and waitlist.status = 'waiting'
  order by waitlist.joined_at, waitlist.id
  for update skip locked
  limit 1;

  if v_waitlist_id is null then
    return null;
  end if;

  insert into public.reservation_participants (reservation_id, player_id, role)
  values (p_reservation_id, v_player_id, 'member')
  on conflict (reservation_id, player_id) do nothing;

  insert into public.join_requests (
    reservation_id, player_id, status, requested_at, decided_at, updated_at
  ) values (
    p_reservation_id, v_player_id, 'accepted', now(), now(), now()
  )
  on conflict (reservation_id, player_id)
  do update set status = 'accepted', decided_at = now(), updated_at = now()
  returning id into v_request_id;

  update public.reservation_waitlist
  set status = 'promoted', resolved_at = now(), updated_at = now()
  where id = v_waitlist_id;

  insert into public.notifications (
    user_id, reservation_id, join_request_id, waitlist_id,
    event_type, event_key, delivery_status
  ) values (
    v_player_id, p_reservation_id, v_request_id, v_waitlist_id,
    'join_request_accepted', 'waitlist_promoted', 'pending'
  );

  return v_player_id;
end;
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION private.queue_pending_open_court_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_is_full boolean;
  v_pending record;
  v_waitlist_id uuid;
begin
  if new.status <> 'accepted' then return new; end if;

  select reservation.initial_player_count + (
    select count(*) from public.join_requests accepted
    where accepted.reservation_id = reservation.id and accepted.status = 'accepted'
  ) + private.open_court_pending_invites(new.reservation_id) >= 4
  into v_is_full
  from public.reservations reservation
  where reservation.id = new.reservation_id
    and reservation.type = 'open'
    and reservation.status in ('pending', 'confirmed');

  if not coalesce(v_is_full, false) then return new; end if;

  for v_pending in
    select request.id, request.player_id, request.requested_at
    from public.join_requests request
    where request.reservation_id = new.reservation_id
      and request.status = 'pending'
    order by request.requested_at, request.id
    for update
  loop
    v_waitlist_id := null;
    insert into public.reservation_waitlist (
      reservation_id, player_id, status, joined_at, resolved_at, updated_at
    ) values (
      new.reservation_id, v_pending.player_id, 'waiting', v_pending.requested_at, null, now()
    )
    on conflict (reservation_id, player_id)
    do update set status = 'waiting', joined_at = least(public.reservation_waitlist.joined_at, excluded.joined_at), resolved_at = null, updated_at = now()
    where public.reservation_waitlist.status in ('left', 'cancelled', 'notified')
    returning id into v_waitlist_id;

    update public.join_requests
    set status = 'cancelled', decided_at = now(), updated_at = now()
    where id = v_pending.id;

    update public.notifications
    set read_at = coalesce(read_at, now()), updated_at = now()
    where join_request_id = v_pending.id and event_type = 'join_request_created';

    if v_waitlist_id is not null then
      insert into public.notifications (
        user_id, reservation_id, join_request_id, waitlist_id, event_type, event_key, delivery_status
      ) values (
        v_pending.player_id, new.reservation_id, v_pending.id, v_waitlist_id,
        'join_request_created', 'waitlist_added', 'pending'
      );
    end if;
  end loop;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.list_open_courts()
 RETURNS TABLE(reservation_id uuid, host_username text, start_at timestamp with time zone, end_at timestamp with time zone, player_count integer, available_spots integer, request_status text, is_host boolean, waitlist_status text, waitlist_position integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  select
    reservation.id,
    host.username,
    reservation.start_at,
    reservation.end_at,
    (reservation.initial_player_count + coalesce(accepted.accepted_count, 0))::integer,
    greatest(4 - reservation.initial_player_count - coalesce(accepted.accepted_count, 0) - private.open_court_pending_invites(reservation.id), 0)::integer,
    case when exists (select 1 from public.reservation_invitations i where i.reservation_id = reservation.id and i.invitee_id = v_user_id and i.status = 'pending')
      then 'invited' else request.status::text end,
    reservation.host_id = v_user_id,
    own_waitlist.status,
    case when own_waitlist.status = 'waiting' then (
      select count(*)::integer
      from public.reservation_waitlist ahead
      where ahead.reservation_id = reservation.id
        and ahead.status = 'waiting'
        and (ahead.joined_at, ahead.id) <= (own_waitlist.joined_at, own_waitlist.id)
    ) else null end
  from public.reservations reservation
  join public.profiles host on host.id = reservation.host_id
  left join lateral (
    select count(*)::integer accepted_count
    from public.join_requests accepted_request
    where accepted_request.reservation_id = reservation.id and accepted_request.status = 'accepted'
  ) accepted on true
  left join public.join_requests request
    on request.reservation_id = reservation.id and request.player_id = v_user_id
  left join public.reservation_waitlist own_waitlist
    on own_waitlist.reservation_id = reservation.id and own_waitlist.player_id = v_user_id
  where reservation.type = 'open'
    and reservation.status in ('pending', 'confirmed')
    and reservation.end_at > now()
  order by reservation.start_at;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_open_court_details(p_reservation_id uuid)
 RETURNS TABLE(reservation_id uuid, host_username text, start_at timestamp with time zone, end_at timestamp with time zone, player_count integer, available_spots integer, participant_username text, participant_role text, unregistered_player_count integer)
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
  with target as (
    select
      reservation.id,
      reservation.host_id,
      reservation.start_at,
      reservation.end_at,
      reservation.initial_player_count::integer,
      host.username as host_username,
      (
        select count(*)::integer
        from public.join_requests accepted_request
        where accepted_request.reservation_id = reservation.id
          and accepted_request.status = 'accepted'
      ) as accepted_count
    from public.reservations reservation
    join public.profiles host on host.id = reservation.host_id
    where reservation.id = p_reservation_id
      and reservation.type = 'open'
      and reservation.status in ('pending', 'confirmed')
      and reservation.end_at > now()
  ),
  registered_players as (
    select
      target.id as reservation_id,
      participant_profile.username,
      participant.role::text as role
    from target
    join public.reservation_participants participant on participant.reservation_id = target.id
    join public.profiles participant_profile on participant_profile.id = participant.player_id
    union
    select target.id, target.host_username, 'host'
    from target
  )
  select
    target.id,
    target.host_username,
    target.start_at,
    target.end_at,
    (target.initial_player_count + target.accepted_count)::integer,
    greatest(4 - target.initial_player_count - target.accepted_count - private.open_court_pending_invites(target.id), 0)::integer,
    registered_players.username,
    registered_players.role,
    greatest(target.initial_player_count - 1, 0)::integer
  from target
  join registered_players on registered_players.reservation_id = target.id
  order by
    case when registered_players.role = 'host' then 0 else 1 end,
    lower(registered_players.username);
end;
$function$;

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
    and reservation.start_at > now()
  order by reservation.start_at, own_waitlist.joined_at;
end;
$function$;

CREATE OR REPLACE FUNCTION private.admin_list_open_courts()
 RETURNS TABLE(reservation_id uuid, host_id uuid, host_username text, host_full_name text, host_email text, host_phone_number text, start_at timestamp with time zone, end_at timestamp with time zone, price numeric, payment_status payment_status, pass_code text, initial_player_count integer, accepted_count integer, pending_count integer, occupied_spots integer, available_spots integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    greatest(4 - reservation.initial_player_count - coalesce(request_counts.accepted_count, 0) - private.open_court_pending_invites(reservation.id), 0)::integer
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
    and reservation.status in ('pending', 'confirmed')
    and reservation.end_at > now()
  order by reservation.start_at, reservation.created_at;
end;
$function$;

CREATE OR REPLACE FUNCTION private.reconcile_reservation_lineup(p_id uuid, p_notify boolean DEFAULT true)
 RETURNS reservation_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  booking public.reservations%rowtype;
  desired public.reservation_status;
  occupied integer;
begin
  select * into booking from public.reservations where id = p_id for update;
  if not found then return null; end if;
  if booking.status not in ('pending', 'confirmed') then return booking.status; end if;
  if booking.type = 'private' then
    select case when exists (
      select 1 from public.reservation_invitations i
      where i.reservation_id = p_id and i.status in ('pending', 'declined')
    ) then 'pending'::public.reservation_status else 'confirmed'::public.reservation_status end into desired;
    select count(*) into occupied from public.reservation_participants where reservation_id = p_id;
    if occupied > 4 then raise exception 'A reservation cannot have more than four players.'; end if;
    if occupied > 0 and occupied <> booking.initial_player_count then
      update public.reservations set initial_player_count = occupied where id = p_id;
    end if;
  else
    select booking.initial_player_count + count(*) into occupied
    from public.join_requests where reservation_id = p_id and status = 'accepted';
    if occupied + private.open_court_pending_invites(p_id) > 4 then raise exception 'An Open Court cannot have more than four accepted or invited players.'; end if;
    desired := case when occupied = 4 then 'confirmed'::public.reservation_status else 'pending'::public.reservation_status end;
  end if;
  if desired <> booking.status then
    update public.reservations set status = desired where id = p_id;
    if p_notify then
      insert into public.notifications(user_id, reservation_id, event_type, event_key, delivery_status)
      select player_id, p_id, 'reservation_confirmation',
        case when desired = 'confirmed' then 'reservation_ready' else 'reservation_pending' end, 'pending'
      from public.reservation_participants where reservation_id = p_id;
    end if;
  end if;
  return desired;
end;
$function$;

CREATE OR REPLACE FUNCTION private.invite_reservation_friend(p_reservation_id uuid, p_player_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare booking public.reservations%rowtype; invitation_id uuid; occupied integer; cutoff integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '28000'; end if;
  select * into booking from public.reservations where id = p_reservation_id for update;
  if not found or booking.host_id <> auth.uid() then raise exception 'Only the host can invite players.' using errcode = '42501'; end if;
  select cancellation_hours into cutoff from public.facility_settings where id = 1;
  if booking.status not in ('pending','confirmed') or booking.start_at <= now() + make_interval(hours => coalesce(cutoff, 2)) then
    raise exception 'This reservation cannot accept new invitations.';
  end if;
  if p_player_id = auth.uid() or not exists (
    select 1 from public.friendships where status = 'accepted' and
    least(requester_id, addressee_id) = least(auth.uid(), p_player_id) and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_player_id)
  ) then raise exception 'Choose an accepted friend.' using errcode = '42501'; end if;
  if exists (select 1 from public.reservation_participants where reservation_id = p_reservation_id and player_id = p_player_id) then
    raise exception 'This player is already included in the reservation.';
  end if;
  select count(*) into occupied from (
    select player_id from public.reservation_participants where reservation_id = p_reservation_id
    union select invitee_id from public.reservation_invitations where reservation_id = p_reservation_id and status <> 'cancelled'
  ) lineup where player_id <> p_player_id;
  if booking.type = 'open' then
    select booking.initial_player_count + count(*) + private.open_court_pending_invites(p_reservation_id)
    into occupied from public.join_requests where reservation_id = p_reservation_id and status = 'accepted';
  end if;
  if occupied >= 4 then raise exception 'Remove an invitation before adding a replacement.'; end if;
  insert into public.reservation_invitations(reservation_id, invitee_id)
  values (p_reservation_id, p_player_id)
  on conflict (reservation_id, invitee_id) do update set status = 'pending', responded_at = null, updated_at = now()
    where public.reservation_invitations.status in ('declined','cancelled')
  returning id into invitation_id;
  if invitation_id is null then raise exception 'This player is already invited or has accepted.'; end if;
  if booking.type = 'open' then
    update public.join_requests set status = 'cancelled', decided_at = now()
      where reservation_id = p_reservation_id and player_id = p_player_id and status = 'pending';
    update public.reservation_waitlist set status = 'left', resolved_at = now()
      where reservation_id = p_reservation_id and player_id = p_player_id and status = 'waiting';
  end if;
  insert into public.notifications(user_id,reservation_id,invitation_id,event_type,event_key,delivery_status)
  values(p_player_id,p_reservation_id,invitation_id,'reservation_confirmation','reservation_invitation','pending');
  return invitation_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.remove_reservation_player(p_reservation_id uuid, p_player_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid(); booking public.reservations%rowtype;
  v_invitation_id uuid; v_request_id uuid; accepted boolean; cancellation_hours integer;
begin
  if actor is null then raise exception 'Authentication is required.' using errcode = '28000'; end if;
  select * into booking from public.reservations where id = p_reservation_id for update;
  if not found or (actor <> booking.host_id and actor is distinct from p_player_id) then
    raise exception 'You cannot manage this reservation.' using errcode = '42501';
  end if;
  if booking.status not in ('pending', 'confirmed') or booking.start_at <= now() then
    raise exception 'Only an upcoming active reservation can be changed.';
  end if;
  if p_player_id = booking.host_id then raise exception 'The host must cancel the whole reservation instead of leaving.'; end if;
  select settings.cancellation_hours into cancellation_hours from public.facility_settings settings where id = 1;
  if p_player_id is null then
    if actor <> booking.host_id or booking.type <> 'open' or booking.initial_player_count <= 1 then
      raise exception 'No guest place can be removed.' using errcode = '42501';
    end if;
    accepted := true;
  else
    select exists(select 1 from public.reservation_participants where reservation_id = p_reservation_id and player_id = p_player_id) into accepted;
    select id into v_invitation_id from public.reservation_invitations
      where reservation_id = p_reservation_id and invitee_id = p_player_id and status <> 'cancelled' for update;
    select id into v_request_id from public.join_requests
      where reservation_id = p_reservation_id and player_id = p_player_id and status in ('accepted','pending') for update;
    if not accepted and v_invitation_id is null and v_request_id is null then
      raise exception 'This player has no active place or invitation.' using errcode = 'P0002';
    end if;
  end if;
  if accepted and booking.start_at <= now() + make_interval(hours => coalesce(cancellation_hours, 2)) then
    raise exception 'This reservation is past the cancellation deadline.';
  end if;
  if p_player_id is null then
    update public.reservations set initial_player_count = initial_player_count - 1 where id = p_reservation_id;
  else
    delete from public.reservation_participants where reservation_id = p_reservation_id and player_id = p_player_id and role = 'member';
    if booking.type = 'private' or v_invitation_id is not null then
      -- Keep a member's departure unresolved until the host adjusts the intended lineup.
      insert into public.reservation_invitations(reservation_id, invitee_id, status, responded_at)
      values (p_reservation_id, p_player_id, case when actor = booking.host_id then 'cancelled' else 'declined' end, now())
      on conflict (reservation_id, invitee_id) do update set status = excluded.status, responded_at = now(), updated_at = now()
      returning id into v_invitation_id;
    end if;
    update public.join_requests set status = 'cancelled', decided_at = now() where id = v_request_id;
    update public.reservation_waitlist set status = 'left', resolved_at = now(), updated_at = now()
      where reservation_id = p_reservation_id and player_id = p_player_id and status in ('waiting','promoted');
    update public.notifications set read_at = coalesce(read_at, now())
      where (v_invitation_id is not null and public.notifications.invitation_id = v_invitation_id)
         or (v_request_id is not null and public.notifications.join_request_id = v_request_id);
    insert into public.notifications(user_id, reservation_id, invitation_id, join_request_id, event_type, event_key, delivery_status)
    values (case when actor = booking.host_id then p_player_id else booking.host_id end,
      p_reservation_id, v_invitation_id, v_request_id, 'participant_removed',
      case when actor = booking.host_id then 'reservation_player_removed' else 'reservation_player_left' end, 'pending');
  end if;
  if booking.type = 'open' then perform private.promote_open_court_waitlist(p_reservation_id); end if;
  return p_reservation_id;
end;
$function$;

create or replace function private.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requester_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  update public.friendships
  set
    status = case when p_accept then 'accepted'::public.friendship_status else 'rejected'::public.friendship_status end,
    updated_at = now()
  where id = p_friendship_id
    and addressee_id = v_user_id
    and status = 'pending'
  returning requester_id into v_requester_id;

  if v_requester_id is null then
    raise exception 'Pending friend request not found.' using errcode = 'P0002';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_user_id
    and friendship_id = p_friendship_id
    and event_type = 'join_request_created';

  insert into public.notifications (user_id, friendship_id, event_type, delivery_status)
  values (
    v_requester_id,
    p_friendship_id,
    case when p_accept then 'join_request_accepted'::public.notification_event_type else 'join_request_rejected'::public.notification_event_type end,
    'pending'
  );

  return p_friendship_id;
end;
$function$;

create or replace function private.respond_open_court_join(p_join_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
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
    and r.status = 'confirmed'
    and r.end_at > now()
  for update of r, jr;

  if v_reservation_id is null then
    raise exception 'Pending join request not found.' using errcode = 'P0002';
  end if;

  if p_accept then
    select count(*)::integer into v_accepted_count
    from public.join_requests jr
    where jr.reservation_id = v_reservation_id and jr.status = 'accepted';
    if v_initial_count + v_accepted_count >= 4 then
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

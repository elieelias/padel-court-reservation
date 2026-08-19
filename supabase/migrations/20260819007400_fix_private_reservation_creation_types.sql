create or replace function private.create_private_reservation(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_friend_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_friend_ids uuid[];
  v_friend_count integer;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select coalesce(array_agg(distinct friend_id), '{}'::uuid[])
  into v_friend_ids
  from unnest(coalesce(p_friend_ids, '{}'::uuid[])) friend_id;
  v_friend_count := cardinality(v_friend_ids);

  if v_friend_count < 2 or v_friend_count > 3 then
    raise exception 'Choose two or three friends for a private reservation.';
  end if;
  if v_user_id = any(v_friend_ids) then
    raise exception 'The host cannot be added as a friend.';
  end if;
  if (
    select count(*)
    from unnest(v_friend_ids) friend_id
    where exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(v_user_id, friend_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(v_user_id, friend_id)
    )
  ) <> v_friend_count then
    raise exception 'Every selected player must be an accepted friend.' using errcode = '42501';
  end if;

  v_reservation_id := private.create_reservation(
    p_start_at,
    p_end_at,
    'private'::public.reservation_type,
    1::smallint
  );

  insert into public.reservation_participants (reservation_id, player_id, role)
  select v_reservation_id, friend_id, 'member'::public.participant_role
  from unnest(v_friend_ids) friend_id;

  update public.reservations
  set initial_player_count = (v_friend_count + 1)::smallint
  where id = v_reservation_id;

  insert into public.notifications (user_id, reservation_id, event_type, delivery_status)
  select friend_id, v_reservation_id, 'reservation_confirmation', 'pending'
  from unnest(v_friend_ids) friend_id;

  return v_reservation_id;
end;
$function$;

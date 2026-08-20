create or replace function private.get_player_public_profile(p_username text)
returns table (
  player_id uuid,
  username text,
  friend_count integer,
  reservation_count integer,
  relationship_status text,
  relationship_direction text,
  is_self boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select p.id
  into v_player_id
  from public.profiles p
  where p.role = 'player'
    and lower(p.username) = lower(btrim(p_username))
  limit 1;

  if v_player_id is null then return; end if;

  return query
  select
    profile.id,
    profile.username,
    (select count(*)::integer from public.friendships friendship
      where friendship.status = 'accepted'
        and profile.id in (friendship.requester_id, friendship.addressee_id)),
    (select count(distinct reservation.id)::integer from public.reservations reservation
      where reservation.status <> 'cancelled'
        and (reservation.host_id = profile.id or exists (
          select 1 from public.reservation_participants participant
          where participant.reservation_id = reservation.id and participant.player_id = profile.id
        ))),
    friendship.status::text,
    case
      when profile.id = v_user_id then 'self'
      when friendship.id is null then 'none'
      when friendship.status = 'accepted' then 'friends'
      when friendship.requester_id = v_user_id then 'outgoing'
      else 'incoming'
    end,
    profile.id = v_user_id
  from public.profiles profile
  left join public.friendships friendship
    on least(friendship.requester_id, friendship.addressee_id) = least(v_user_id, profile.id)
   and greatest(friendship.requester_id, friendship.addressee_id) = greatest(v_user_id, profile.id)
  where profile.id = v_player_id;
end;
$function$;

create or replace function public.get_player_public_profile(p_username text)
returns table (
  player_id uuid, username text, friend_count integer, reservation_count integer,
  relationship_status text, relationship_direction text, is_self boolean
)
language sql stable set search_path = ''
as $function$ select * from private.get_player_public_profile(p_username); $function$;

create or replace function private.get_open_court_details(p_reservation_id uuid)
returns table (
  reservation_id uuid, host_username text, start_at timestamptz, end_at timestamptz,
  player_count integer, available_spots integer, participant_username text,
  participant_role text, unregistered_player_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  with target as (
    select
      reservation.id,
      reservation.start_at,
      reservation.end_at,
      reservation.initial_player_count::integer,
      host.username as host_username,
      (select count(*)::integer from public.join_requests accepted_request
        where accepted_request.reservation_id = reservation.id and accepted_request.status = 'accepted') as accepted_count
    from public.reservations reservation
    join public.profiles host on host.id = reservation.host_id
    where reservation.id = p_reservation_id
      and reservation.type = 'open'
      and reservation.status = 'confirmed'
      and reservation.end_at > now()
  ),
  registered_players as (
    select target.id as reservation_id, participant_profile.username, participant.role::text as role
    from target
    join public.reservation_participants participant on participant.reservation_id = target.id
    join public.profiles participant_profile on participant_profile.id = participant.player_id
    union
    select target.id, target.host_username, 'host' from target
  )
  select
    target.id,
    target.host_username,
    target.start_at,
    target.end_at,
    (target.initial_player_count + target.accepted_count)::integer,
    greatest(4 - target.initial_player_count - target.accepted_count, 0)::integer,
    registered_players.username,
    registered_players.role,
    greatest(target.initial_player_count - 1, 0)::integer
  from target
  join registered_players on registered_players.reservation_id = target.id
  order by case when registered_players.role = 'host' then 0 else 1 end, lower(registered_players.username);
end;
$function$;

create or replace function public.get_open_court_details(p_reservation_id uuid)
returns table (
  reservation_id uuid, host_username text, start_at timestamptz, end_at timestamptz,
  player_count integer, available_spots integer, participant_username text,
  participant_role text, unregistered_player_count integer
)
language sql stable set search_path = ''
as $function$ select * from private.get_open_court_details(p_reservation_id); $function$;

revoke all on function private.get_player_public_profile(text) from public;
revoke all on function private.get_open_court_details(uuid) from public;
revoke all on function public.get_player_public_profile(text) from public, anon;
revoke all on function public.get_open_court_details(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_player_public_profile(text) to authenticated;
grant execute on function private.get_open_court_details(uuid) to authenticated;
grant execute on function public.get_player_public_profile(text) to authenticated;
grant execute on function public.get_open_court_details(uuid) to authenticated;

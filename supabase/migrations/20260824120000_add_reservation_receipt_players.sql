create or replace function private.get_reservation_receipt_players(p_reservation_ids uuid[])
returns table (
  reservation_id uuid,
  username text,
  participant_role text,
  unregistered_player_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  with accessible_reservations as (
    select reservation.id, reservation.initial_player_count::integer
    from public.reservations reservation
    where reservation.id = any(coalesce(p_reservation_ids, array[]::uuid[]))
      and (
        reservation.host_id = v_user_id
        or exists (
          select 1
          from public.reservation_participants viewer
          where viewer.reservation_id = reservation.id
            and viewer.player_id = v_user_id
        )
      )
  ),
  registered_players as (
    select
      participant.reservation_id,
      profile.username,
      participant.role::text as participant_role,
      accessible.initial_player_count,
      count(*) over (partition by participant.reservation_id)::integer as registered_count
    from accessible_reservations accessible
    join public.reservation_participants participant
      on participant.reservation_id = accessible.id
    join public.profiles profile
      on profile.id = participant.player_id
  )
  select
    player.reservation_id,
    player.username,
    player.participant_role,
    greatest(player.initial_player_count - player.registered_count, 0)::integer
  from registered_players player
  order by
    player.reservation_id,
    case when player.participant_role = 'host' then 0 else 1 end,
    lower(player.username);
end;
$function$;

create or replace function public.get_reservation_receipt_players(p_reservation_ids uuid[])
returns table (
  reservation_id uuid,
  username text,
  participant_role text,
  unregistered_player_count integer
)
language sql
stable
set search_path = ''
as $function$
  select * from private.get_reservation_receipt_players(p_reservation_ids);
$function$;

revoke all on function private.get_reservation_receipt_players(uuid[]) from public;
revoke all on function public.get_reservation_receipt_players(uuid[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_reservation_receipt_players(uuid[]) to authenticated;
grant execute on function public.get_reservation_receipt_players(uuid[]) to authenticated;

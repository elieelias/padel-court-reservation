create or replace function private.admin_get_player_details(p_player_id uuid)
returns table (
  friend_count integer,
  reservations_played integer
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

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_player_id
      and profile.role = 'player'::public.user_role
  ) then
    raise exception 'Player account not found.' using errcode = 'P0002';
  end if;

  return query
  select
    (
      select count(*)::integer
      from public.friendships friendship
      where friendship.status = 'accepted'::public.friendship_status
        and p_player_id in (friendship.requester_id, friendship.addressee_id)
    ),
    (
      select count(distinct reservation.id)::integer
      from public.reservations reservation
      where reservation.end_at <= now()
        and reservation.status not in ('cancelled', 'expired')
        and (
          reservation.host_id = p_player_id
          or exists (
            select 1
            from public.reservation_participants participant
            where participant.reservation_id = reservation.id
              and participant.player_id = p_player_id
          )
        )
    );
end;
$function$;

create or replace function public.admin_get_player_details(p_player_id uuid)
returns table (
  friend_count integer,
  reservations_played integer
)
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_get_player_details(p_player_id);
$function$;

revoke all on function private.admin_get_player_details(uuid) from public, anon;
grant execute on function private.admin_get_player_details(uuid) to authenticated;
revoke all on function public.admin_get_player_details(uuid) from public, anon;
grant execute on function public.admin_get_player_details(uuid) to authenticated;

comment on function public.admin_get_player_details(uuid) is
  'Administrator-only player friendship and played-reservation totals.';
alter type public.user_role add value if not exists 'deleted';

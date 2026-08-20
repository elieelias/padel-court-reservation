alter function public.username_available(text) set schema private;
alter function public.search_players(text) set schema private;
alter function public.list_friendships() set schema private;
alter function public.send_friend_request(uuid) set schema private;
alter function public.respond_friend_request(uuid, boolean) set schema private;
alter function public.create_private_reservation(timestamptz, timestamptz, uuid[]) set schema private;
alter function public.update_player_profile(text, text) set schema private;

create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$ select private.username_available(p_username); $function$;

create function public.search_players(p_query text)
returns table (
  player_id uuid,
  username text,
  relationship_status public.friendship_status,
  relationship_direction text
)
language sql
stable
set search_path = ''
as $function$ select * from private.search_players(p_query); $function$;

create function public.list_friendships()
returns table (
  friendship_id uuid,
  player_id uuid,
  username text,
  status public.friendship_status,
  direction text
)
language sql
stable
set search_path = ''
as $function$ select * from private.list_friendships(); $function$;

create function public.send_friend_request(p_player_id uuid)
returns uuid
language sql
set search_path = ''
as $function$ select private.send_friend_request(p_player_id); $function$;

create function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns uuid
language sql
set search_path = ''
as $function$ select private.respond_friend_request(p_friendship_id, p_accept); $function$;

create function public.create_private_reservation(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_friend_ids uuid[]
)
returns uuid
language sql
set search_path = ''
as $function$ select private.create_private_reservation(p_start_at, p_end_at, p_friend_ids); $function$;

create function public.update_player_profile(p_username text, p_phone_number text)
returns uuid
language sql
set search_path = ''
as $function$ select private.update_player_profile(p_username, p_phone_number); $function$;

revoke all on function private.username_available(text) from public;
revoke all on function private.search_players(text) from public;
revoke all on function private.list_friendships() from public;
revoke all on function private.send_friend_request(uuid) from public;
revoke all on function private.respond_friend_request(uuid, boolean) from public;
revoke all on function private.create_private_reservation(timestamptz, timestamptz, uuid[]) from public;
revoke all on function private.update_player_profile(text, text) from public;

grant execute on function private.username_available(text) to anon, authenticated;
grant execute on function private.search_players(text) to authenticated;
grant execute on function private.list_friendships() to authenticated;
grant execute on function private.send_friend_request(uuid) to authenticated;
grant execute on function private.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function private.create_private_reservation(timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function private.update_player_profile(text, text) to authenticated;

revoke all on function public.username_available(text) from public;
revoke all on function public.search_players(text) from public;
revoke all on function public.list_friendships() from public;
revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.create_private_reservation(timestamptz, timestamptz, uuid[]) from public;
revoke all on function public.update_player_profile(text, text) from public;

grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.list_friendships() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.create_private_reservation(timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function public.update_player_profile(text, text) to authenticated;

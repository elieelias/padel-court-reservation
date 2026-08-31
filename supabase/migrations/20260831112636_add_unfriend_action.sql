-- Version matches the migration applied to the linked Supabase project.
-- Either member can remove an accepted connection, but not someone else's
-- friendship or a pending request. Existing SELECT policy remains in force.
create policy "Players can remove their accepted friendships"
on public.friendships for delete to authenticated
using (
  status = 'accepted'::public.friendship_status
  and (select auth.uid()) in (requester_id, addressee_id)
);

grant delete on table public.friendships to authenticated;

-- SECURITY INVOKER keeps the same RLS checks for RPC and direct API requests.
create function public.remove_friend(p_friendship_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  delete from public.friendships
  where id = p_friendship_id
    and status = 'accepted'::public.friendship_status
    and auth.uid() in (requester_id, addressee_id);

  if not found then
    raise exception 'Friendship not found. Refresh your friends list.' using errcode = 'P0002';
  end if;

  -- The existing FK removes obsolete friend-request notifications only.
  -- Reservations, their participants and invitations are separate and unchanged.
  return p_friendship_id;
end;
$function$;

revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

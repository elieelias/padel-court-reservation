-- All changes, including generated notification entries, are rolled back.
begin;
create temporary table unfriend_fixture (a uuid, b uuid, outsider uuid, friendship_id uuid);
insert into unfriend_fixture(a,b,outsider)
select ids[1], ids[2], ids[3]
from (select array_agg(id order by created_at) ids from public.profiles where role = 'player') players;
create function pg_temp.assert_unfriend(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
select pg_temp.assert_unfriend(outsider is not null, 'Three player fixtures are required') from unfriend_fixture;

-- Snapshot booking data to prove that unfriending never changes lineups or history.
create temporary table booking_snapshot as
select 'reservations' as name, md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text, '[]')) as digest from public.reservations r
union all select 'participants', md5(coalesce(jsonb_agg(to_jsonb(p) order by reservation_id,player_id)::text, '[]')) from public.reservation_participants p
union all select 'invitations', md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text, '[]')) from public.reservation_invitations i;

insert into public.friendships(requester_id,addressee_id,status)
select a,b,'accepted' from unfriend_fixture
on conflict (least(requester_id,addressee_id),greatest(requester_id,addressee_id))
do update set requester_id=excluded.requester_id,addressee_id=excluded.addressee_id,status='accepted';
update unfriend_fixture x set friendship_id=f.id from public.friendships f where f.requester_id=x.a and f.addressee_id=x.b;
grant all on unfriend_fixture to authenticated, anon;

select set_config('request.jwt.claim.sub',outsider::text,true) from unfriend_fixture;
set local role authenticated;
do $$ begin
  perform public.remove_friend((select friendship_id from unfriend_fixture));
  raise exception 'FAILED: outsider removed a friendship';
exception when no_data_found then null; end $$;
-- Direct table access must enforce the same rule as the RPC.
do $$ declare n integer; begin
  delete from public.friendships where id=(select friendship_id from unfriend_fixture);
  get diagnostics n = row_count;
  perform pg_temp.assert_unfriend(n=0,'RLS rejects outsider deletion');
end $$;

select set_config('request.jwt.claim.sub','',true);
do $$ begin
  perform public.remove_friend((select friendship_id from unfriend_fixture));
  raise exception 'FAILED: missing identity removed a friendship';
exception when invalid_authorization_specification then null; end $$;
set local role anon;
do $$ begin
  perform public.remove_friend((select friendship_id from unfriend_fixture));
  raise exception 'FAILED: anonymous caller has RPC access';
exception when insufficient_privilege then null; end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',b::text,true) from unfriend_fixture;
select public.remove_friend(friendship_id) from unfriend_fixture;
select pg_temp.assert_unfriend(not exists(select 1 from public.list_friendships() f where f.player_id=x.a),'recipient list no longer includes requester') from unfriend_fixture x;
select set_config('request.jwt.claim.sub',a::text,true) from unfriend_fixture;
select pg_temp.assert_unfriend(not exists(select 1 from public.list_friendships() f where f.player_id=x.b),'requester list no longer includes recipient') from unfriend_fixture x;

-- Re-adding must go through a fresh invitation, not silently restore acceptance.
update unfriend_fixture set friendship_id=public.send_friend_request(b);
select pg_temp.assert_unfriend(exists(select 1 from public.list_friendships() f where f.friendship_id=x.friendship_id and f.status='pending'),'re-add creates a pending request') from unfriend_fixture x;
do $$ begin
  perform public.remove_friend((select friendship_id from unfriend_fixture));
  raise exception 'FAILED: pending request treated as a friendship';
exception when no_data_found then null; end $$;
do $$ declare n integer; begin
  delete from public.friendships where id=(select friendship_id from unfriend_fixture);
  get diagnostics n = row_count;
  perform pg_temp.assert_unfriend(n=0,'RLS rejects deletion of pending request');
end $$;
select set_config('request.jwt.claim.sub',b::text,true) from unfriend_fixture;
select public.respond_friend_request(friendship_id,true) from unfriend_fixture;
select set_config('request.jwt.claim.sub',a::text,true) from unfriend_fixture;
select public.remove_friend(friendship_id) from unfriend_fixture;
do $$ begin
  perform public.remove_friend((select friendship_id from unfriend_fixture));
  raise exception 'FAILED: repeated removal reported success';
exception when no_data_found then null; end $$;

reset role;
select pg_temp.assert_unfriend(not exists(select 1 from public.friendships f join unfriend_fixture x on f.id=x.friendship_id),'requester can unfriend too');
select pg_temp.assert_unfriend(not exists(select 1 from public.notifications n join unfriend_fixture x on n.friendship_id=x.friendship_id),'obsolete friendship notifications removed');
select pg_temp.assert_unfriend(not exists(
  select * from booking_snapshot except (
    select 'reservations', md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text, '[]')) from public.reservations r
    union all select 'participants', md5(coalesce(jsonb_agg(to_jsonb(p) order by reservation_id,player_id)::text, '[]')) from public.reservation_participants p
    union all select 'invitations', md5(coalesce(jsonb_agg(to_jsonb(i) order by id)::text, '[]')) from public.reservation_invitations i
  )
),'all reservations, participants and invitations are unchanged');
rollback;

-- Run against a test database or through an authorized SQL session.
-- All fixture changes and notification outbox entries are rolled back.
begin;
create temporary table lineup_fixture (host uuid, a uuid, b uuid, outsider uuid, starts timestamptz, private_id uuid, open_id uuid);
insert into lineup_fixture(host,a,b,outsider)
select ids[1],ids[2],ids[3],ids[4] from (select array_agg(id order by created_at) ids from public.profiles) players;
create function pg_temp.assert_lineup(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
select pg_temp.assert_lineup(outsider is not null, 'At least four test players are required') from lineup_fixture;
update lineup_fixture set starts = (
  select (day::date + time '18:00') at time zone 'Asia/Beirut'
  from generate_series(current_date + 2, current_date + 25, interval '1 day') day
  join public.schedule_rules rule on rule.day_of_week = extract(dow from day) and rule.is_open
  where rule.opening_time <= time '18:00' and rule.closing_time >= time '20:00'
    and not exists(select 1 from public.reservations r where r.status in ('pending','confirmed') and tstzrange(r.start_at,r.end_at,'[)') && tstzrange((day::date + time '18:00') at time zone 'Asia/Beirut',(day::date + time '20:00') at time zone 'Asia/Beirut','[)'))
    and not exists(select 1 from public.blocked_periods r where tstzrange(r.start_at,r.end_at,'[)') && tstzrange((day::date + time '18:00') at time zone 'Asia/Beirut',(day::date + time '20:00') at time zone 'Asia/Beirut','[)'))
  order by day limit 1
);
select pg_temp.assert_lineup(starts is not null, 'A free test slot is required') from lineup_fixture;
insert into public.friendships(requester_id,addressee_id,status)
select host, friend, 'accepted' from lineup_fixture cross join lateral unnest(array[a,b]) friend on conflict do nothing;
update public.friendships f set status='accepted' from lineup_fixture x
where (f.requester_id=x.host and f.addressee_id in (x.a,x.b)) or (f.addressee_id=x.host and f.requester_id in (x.a,x.b));
grant all on lineup_fixture to authenticated;

select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
set local role authenticated;
update lineup_fixture set private_id = public.create_private_reservation(starts,starts+interval '1 hour',array[a,b]);
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', outsider::text, true) from lineup_fixture;
select pg_temp.assert_lineup(not exists(
  select 1 from public.list_calendar_waitlist_opportunities((starts at time zone 'Asia/Beirut')::date) o
  where o.reservation_id=private_id
),'private booking is not a calendar waitlist opportunity') from lineup_fixture;
select pg_temp.assert_lineup(exists(
  select 1 from public.get_calendar_blocks((starts at time zone 'Asia/Beirut')::date) b
  where b.start_at=starts and b.block_type='reserved'
),'private booking remains reserved on the calendar') from lineup_fixture;
do $$ begin
  perform public.join_reservation_waitlist(private_id) from lineup_fixture;
  raise exception 'FAILED: private waitlist join was accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  insert into public.reservation_waitlist(reservation_id,player_id)
  select private_id,outsider from lineup_fixture;
  raise exception 'FAILED: direct waitlist write bypassed RPC';
exception when insufficient_privilege then null; end $$;
-- Older private entries must not reappear in My Waitlist.
reset role;
insert into public.reservation_waitlist(reservation_id,player_id) select private_id,outsider from lineup_fixture;
set local role authenticated;
select pg_temp.assert_lineup(not exists(
  select 1 from public.list_my_waitlists() w where w.reservation_id=private_id
),'legacy private waitlists are hidden') from lineup_fixture;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  perform public.join_reservation_waitlist(private_id) from lineup_fixture;
  raise exception 'FAILED: unauthenticated waitlist join was accepted';
exception when invalid_authorization_specification then null; end $$;
rollback;

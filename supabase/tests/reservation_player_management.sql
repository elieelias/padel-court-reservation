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
select pg_temp.assert_lineup(r.status='pending','private starts pending') from public.reservations r join lineup_fixture x on r.id=x.private_id;
select pg_temp.assert_lineup(jsonb_array_length(public.get_reservation_lineup(private_id)->'players')=3,'host sees three invited players') from lineup_fixture;

select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select public.respond_reservation_invitation(i.id,true) from public.reservation_invitations i join lineup_fixture x on i.reservation_id=x.private_id and i.invitee_id=x.a;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','one acceptance is not enough') from public.reservations r join lineup_fixture x on r.id=x.private_id;
select set_config('request.jwt.claim.sub', b::text, true) from lineup_fixture;
select public.respond_reservation_invitation(i.id,true) from public.reservation_invitations i join lineup_fixture x on i.reservation_id=x.private_id and i.invitee_id=x.b;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='confirmed','all private invitations accepted') from public.reservations r join lineup_fixture x on r.id=x.private_id;

select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select public.leave_reservation(private_id) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select pg_temp.assert_lineup(r.status='pending','private departure reopens lineup') from public.reservations r join lineup_fixture x on r.id=x.private_id;
select pg_temp.assert_lineup(exists(select 1 from public.notifications n where n.reservation_id=private_id and n.event_key='reservation_player_left'),'host departure notification') from lineup_fixture;
select public.remove_reservation_player(private_id,a) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='confirmed','host resolves declined invitation') from public.reservations r join lineup_fixture x on r.id=x.private_id;
select public.remove_reservation_player(private_id,b) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(jsonb_array_length(public.get_reservation_lineup(private_id)->'players')=1,'host removes accepted participant') from lineup_fixture;
select public.invite_reservation_friend(private_id,a) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','replacement invitation awaits response') from public.reservations r join lineup_fixture x on r.id=x.private_id;
select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select public.respond_reservation_invitation(i.id,false) from public.reservation_invitations i join lineup_fixture x on i.reservation_id=x.private_id and i.invitee_id=x.a;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select pg_temp.assert_lineup(r.status='pending','decline does not silently confirm') from public.reservations r join lineup_fixture x on r.id=x.private_id;

update lineup_fixture set open_id=public.create_reservation(starts+interval '1 hour',starts+interval '2 hours','open',1::smallint);
-- Preserve regression coverage for bookings created with guests before named invitations.
reset role;
update public.reservations set initial_player_count=3 where id=(select open_id from lineup_fixture);
set local role authenticated;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','open court with three players is pending') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(exists(select 1 from public.list_open_courts() c where c.reservation_id=open_id),'pending open court is discoverable') from lineup_fixture;
select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select public.request_open_court_join(open_id) from lineup_fixture;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select public.respond_open_court_join(j.id,true) from public.join_requests j join lineup_fixture x on j.reservation_id=x.open_id and j.player_id=x.a;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='confirmed','open court with four players confirms') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select set_config('request.jwt.claim.sub', b::text, true) from lineup_fixture;
select public.join_reservation_waitlist(open_id) from lineup_fixture;
select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select public.leave_open_court(open_id) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select pg_temp.assert_lineup(r.status='confirmed','waitlist refill keeps booking confirmed') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(exists(select 1 from public.reservation_participants p where p.reservation_id=open_id and p.player_id=b),'waitlisted member promoted') from lineup_fixture;
select public.remove_reservation_player(open_id,b) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','host removal without refill makes booking pending') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select public.remove_reservation_player(open_id,null) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup((public.get_reservation_lineup(open_id)->>'guest_count')::integer=1,'host can remove an unnamed guest') from lineup_fixture;

-- Test permission failures inside subtransactions so the main fixture survives.
select set_config('request.jwt.claim.sub', outsider::text, true) from lineup_fixture;
do $$ begin
  begin
    perform public.remove_reservation_player(open_id,a) from lineup_fixture;
    raise exception 'FAILED: outsider removal was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_reservation_lineup(private_id) from lineup_fixture;
    raise exception 'FAILED: outsider viewed private lineup';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
do $$ begin
  begin
    perform public.leave_reservation(open_id) from lineup_fixture;
    raise exception 'FAILED: host was allowed to leave';
  exception when raise_exception then
    if sqlerrm <> 'The host must cancel the whole reservation instead of leaving.' then raise; end if;
  end;
end $$;

-- Raising the cutoff inside the rolled-back fixture tests the same server boundary
-- without moving bookings over a real customer's court time.
reset role;
select pg_temp.assert_lineup(starts + interval '1 hour' < now() + interval '168 hours', 'The cutoff test needs a slot within seven days') from lineup_fixture;
update public.facility_settings set cancellation_hours=168 where id=1;
set local role authenticated;
do $$ begin
  begin
    perform public.remove_reservation_player(open_id,null) from lineup_fixture;
    raise exception 'FAILED: removal ignored the cancellation cutoff';
  exception when raise_exception then
    if sqlerrm <> 'This reservation is past the cancellation deadline.' then raise; end if;
  end;
  begin
    perform public.cancel_reservation(open_id) from lineup_fixture;
    raise exception 'FAILED: cancellation ignored the cutoff';
  exception when raise_exception then
    if sqlerrm <> 'This reservation is past the cancellation deadline.' then raise; end if;
  end;
end $$;
reset role;
select 'PASS: private acceptance/decline/replacement, host removal, member departure, notifications, Open Court capacity, waitlist promotion, cancellation cutoff and authorization' result;
rollback;

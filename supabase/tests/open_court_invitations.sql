-- Run against a test database or through an authorized SQL session.
-- All fixture changes and notification outbox entries are rolled back.
begin;
create temporary table lineup_fixture (host uuid, a uuid, b uuid, outsider uuid, waiter uuid, starts timestamptz, private_id uuid, open_id uuid, recurring_ids uuid[]);
insert into lineup_fixture(host,a,b,outsider,waiter)
select ids[1],ids[2],ids[3],ids[4],ids[5] from (select array_agg(id order by created_at) ids from public.profiles) players;
create function pg_temp.assert_lineup(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
select pg_temp.assert_lineup(waiter is not null, 'At least five test players are required') from lineup_fixture;
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
update lineup_fixture set open_id=public.create_open_reservation(starts,starts+interval '1 hour',array[a,b]);
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending' and r.initial_player_count=1,'only host starts accepted') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(c.player_count=1 and c.available_spots=1,'two invitations hold two places without confirming players') from public.list_open_courts() c join lineup_fixture x on c.reservation_id=x.open_id;
select pg_temp.assert_lineup(jsonb_array_length(public.get_reservation_lineup(open_id)->'players')=3,'host sees named pending invitations') from lineup_fixture;

select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select pg_temp.assert_lineup(exists(select 1 from public.list_private_reservation_invitations() i where i.reservation_id=open_id and i.status='pending'),'Open Court invitations appear in inbox') from lineup_fixture;
select pg_temp.assert_lineup(c.request_status='invited','Open Court links invitee to invitation') from public.list_open_courts() c join lineup_fixture x on c.reservation_id=x.open_id;
do $$ begin
  begin
    perform public.request_open_court_join(open_id) from lineup_fixture;
    raise exception 'FAILED: invitation bypass allowed';
  exception when raise_exception then
    if sqlerrm <> 'Respond to your reservation invitation first.' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub', outsider::text, true) from lineup_fixture;
select public.request_open_court_join(open_id) from lineup_fixture;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select public.respond_open_court_join(j.id,true) from public.join_requests j join lineup_fixture x on j.reservation_id=x.open_id and j.player_id=x.outsider;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','accepted community player does not auto-accept invitations') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(c.player_count=2 and c.available_spots=0,'remaining two places held for invitees') from public.list_open_courts() c join lineup_fixture x on c.reservation_id=x.open_id;

select set_config('request.jwt.claim.sub', waiter::text, true) from lineup_fixture;
do $$ begin
  begin
    perform public.request_open_court_join(open_id) from lineup_fixture;
    raise exception 'FAILED: invited place was stolen';
  exception when raise_exception then
    if sqlerrm <> 'This Open Court is full.' then raise; end if;
  end;
end $$;
select public.join_reservation_waitlist(open_id) from lineup_fixture;
select set_config('request.jwt.claim.sub', a::text, true) from lineup_fixture;
select public.respond_reservation_invitation(i.id,true) from public.reservation_invitations i join lineup_fixture x on i.reservation_id=x.open_id and i.invitee_id=x.a;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','one invited player still pending') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(c.player_count=3 and c.available_spots=0,'invitation acceptance is counted exactly once') from public.list_open_courts() c join lineup_fixture x on c.reservation_id=x.open_id;

select set_config('request.jwt.claim.sub', b::text, true) from lineup_fixture;
select public.respond_reservation_invitation(i.id,false) from public.reservation_invitations i join lineup_fixture x on i.reservation_id=x.open_id and i.invitee_id=x.b;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select pg_temp.assert_lineup(r.status='confirmed','decline frees a place and waitlist fills it') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(c.player_count=4 and c.available_spots=0,'four accepted players, zero guests') from public.list_open_courts() c join lineup_fixture x on c.reservation_id=x.open_id;
select pg_temp.assert_lineup((public.get_reservation_lineup(open_id)->>'guest_count')::integer=0,'new booking has no anonymous guests') from lineup_fixture;
select public.remove_reservation_player(open_id,a) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='pending','host removes accepted invitee, booking becomes pending') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select public.invite_reservation_friend(open_id,b) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', b::text, true) from lineup_fixture;
select public.respond_reservation_invitation(i.id,true) from public.reservation_invitations i join lineup_fixture x on i.reservation_id=x.open_id and i.invitee_id=x.b;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup(r.status='confirmed','replacement acceptance confirms Open Court') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select public.leave_reservation(open_id) from lineup_fixture;
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', host::text, true) from lineup_fixture;
select pg_temp.assert_lineup(r.status='pending','invited player can leave their accepted spot') from public.reservations r join lineup_fixture x on r.id=x.open_id;
select pg_temp.assert_lineup(exists(select 1 from public.notifications n where n.reservation_id=open_id and n.event_key='reservation_player_left'),'host notified about invitee departure') from lineup_fixture;
do $$ begin
  begin
    perform public.create_reservation(starts+interval '1 hour',starts+interval '2 hours','open',3::smallint) from lineup_fixture;
    raise exception 'FAILED: new anonymous guest count was allowed';
  exception when raise_exception then
    if sqlerrm <> 'Select and invite your players instead of entering a guest count.' then raise; end if;
  end;
end $$;
-- Find two free weekly occurrences independently of the earlier one-off test slot.
reset role;
update lineup_fixture set starts = (
  select (day::date + time '18:00') at time zone 'Asia/Beirut'
  from generate_series(current_date + 2, current_date + 18, interval '1 day') day
  join public.schedule_rules rule on rule.day_of_week=extract(dow from day) and rule.is_open
  where rule.opening_time<=time '18:00' and rule.closing_time>=time '19:00'
    and not exists(select 1 from public.reservations r cross join generate_series(0,1) week
      where r.status in ('pending','confirmed') and tstzrange(r.start_at,r.end_at,'[)') && tstzrange((day::date+week*7+time '18:00') at time zone 'Asia/Beirut',(day::date+week*7+time '19:00') at time zone 'Asia/Beirut','[)'))
    and not exists(select 1 from public.blocked_periods r cross join generate_series(0,1) week
      where tstzrange(r.start_at,r.end_at,'[)') && tstzrange((day::date+week*7+time '18:00') at time zone 'Asia/Beirut',(day::date+week*7+time '19:00') at time zone 'Asia/Beirut','[)'))
  order by day limit 1
);
select pg_temp.assert_lineup(starts is not null,'two weekly test slots available') from lineup_fixture;
set local role authenticated;
update lineup_fixture set recurring_ids=public.create_recurring_reservations(starts,starts+interval '1 hour','open',1::smallint,array[a,b],2::smallint);
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_lineup((select count(*) from public.reservations r where r.id=any(recurring_ids) and r.type='open' and r.status='pending' and r.initial_player_count=1)=2,'both weekly bookings start pending with just the host') from lineup_fixture;
select pg_temp.assert_lineup((select count(*) from public.reservation_invitations i where i.reservation_id=any(recurring_ids) and i.status='pending')=4,'each weekly booking has its own two invitations') from lineup_fixture;
reset role;
select 'PASS: named Open Court invitations, held capacity, explicit acceptance, declines, waitlist refill, replacements, departure, recurring invitations and rejection of guest counts' result;
rollback;

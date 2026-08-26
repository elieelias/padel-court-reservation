create table if not exists public.reservation_invitations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (reservation_id, invitee_id)
);

create table if not exists public.reservation_waitlist (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'notified', 'left', 'cancelled')),
  joined_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (reservation_id, player_id)
);

create index if not exists reservation_invitations_invitee_status_idx
  on public.reservation_invitations (invitee_id, status, created_at desc);
create index if not exists reservation_invitations_reservation_status_idx
  on public.reservation_invitations (reservation_id, status, created_at);
create index if not exists reservation_waitlist_reservation_order_idx
  on public.reservation_waitlist (reservation_id, joined_at, id)
  where status = 'waiting';
create index if not exists reservation_waitlist_player_status_idx
  on public.reservation_waitlist (player_id, status, joined_at desc);

alter table public.reservation_invitations enable row level security;
alter table public.reservation_waitlist enable row level security;

drop policy if exists "reservation_invitations_select_related" on public.reservation_invitations;
create policy "reservation_invitations_select_related"
on public.reservation_invitations for select to authenticated
using (
  invitee_id = (select auth.uid())
  or exists (
    select 1 from public.reservations reservation
    where reservation.id = reservation_id
      and reservation.host_id = (select auth.uid())
  )
);

drop policy if exists "reservation_waitlist_select_related" on public.reservation_waitlist;
create policy "reservation_waitlist_select_related"
on public.reservation_waitlist for select to authenticated
using (
  player_id = (select auth.uid())
  or exists (
    select 1 from public.reservations reservation
    where reservation.id = reservation_id
      and reservation.host_id = (select auth.uid())
  )
);

grant select on public.reservation_invitations to authenticated;
grant select on public.reservation_waitlist to authenticated;
revoke all on public.reservation_invitations from anon;
revoke all on public.reservation_waitlist from anon;

alter table public.notifications
  add column if not exists invitation_id uuid references public.reservation_invitations(id) on delete cascade,
  add column if not exists waitlist_id uuid references public.reservation_waitlist(id) on delete cascade,
  add column if not exists event_key text;

alter table public.notifications drop constraint if exists notifications_event_key_check;
alter table public.notifications add constraint notifications_event_key_check check (
  event_key is null or event_key in (
    'reservation_invitation',
    'reservation_invitation_accepted',
    'reservation_invitation_declined',
    'waitlist_joined',
    'waitlist_added',
    'waitlist_promoted',
    'court_available'
  )
);

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

  if v_friend_count > 3 then
    raise exception 'A private reservation can invite no more than three friends.';
  end if;
  if v_user_id = any(v_friend_ids) then
    raise exception 'The host cannot invite themselves.';
  end if;
  if (
    select count(*)
    from unnest(v_friend_ids) friend_id
    where exists (
      select 1 from public.friendships friendship
      where friendship.status = 'accepted'
        and least(friendship.requester_id, friendship.addressee_id) = least(v_user_id, friend_id)
        and greatest(friendship.requester_id, friendship.addressee_id) = greatest(v_user_id, friend_id)
    )
  ) <> v_friend_count then
    raise exception 'Every invited player must be an accepted friend.' using errcode = '42501';
  end if;

  v_reservation_id := private.create_reservation(
    p_start_at,
    p_end_at,
    'private'::public.reservation_type,
    1::smallint
  );

  insert into public.reservation_invitations (reservation_id, invitee_id)
  select v_reservation_id, friend_id
  from unnest(v_friend_ids) friend_id;

  insert into public.notifications (
    user_id, reservation_id, invitation_id, event_type, event_key, delivery_status
  )
  select
    invitation.invitee_id,
    invitation.reservation_id,
    invitation.id,
    'reservation_confirmation',
    'reservation_invitation',
    'pending'
  from public.reservation_invitations invitation
  where invitation.reservation_id = v_reservation_id;

  return v_reservation_id;
end;
$function$;

create or replace function private.list_private_reservation_invitations()
returns table (
  invitation_id uuid,
  reservation_id uuid,
  host_username text,
  invitee_username text,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  is_host boolean,
  created_at timestamptz
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
  select
    invitation.id,
    reservation.id,
    host.username,
    invitee.username,
    reservation.start_at,
    reservation.end_at,
    invitation.status,
    reservation.host_id = v_user_id,
    invitation.created_at
  from public.reservation_invitations invitation
  join public.reservations reservation on reservation.id = invitation.reservation_id
  join public.profiles host on host.id = reservation.host_id
  join public.profiles invitee on invitee.id = invitation.invitee_id
  where (invitation.invitee_id = v_user_id or reservation.host_id = v_user_id)
    and reservation.status in ('pending', 'confirmed')
    and reservation.end_at > now()
  order by reservation.start_at, invitation.created_at;
end;
$function$;

create or replace function private.respond_reservation_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_id uuid;
  v_host_id uuid;
  v_participant_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select invitation.reservation_id, reservation.host_id
  into v_reservation_id, v_host_id
  from public.reservation_invitations invitation
  join public.reservations reservation on reservation.id = invitation.reservation_id
  where invitation.id = p_invitation_id
    and invitation.invitee_id = v_user_id
    and invitation.status = 'pending'
    and reservation.type = 'private'
    and reservation.status in ('pending', 'confirmed')
    and reservation.end_at > now()
  for update of invitation, reservation;

  if v_reservation_id is null then
    raise exception 'Pending reservation invitation not found.' using errcode = 'P0002';
  end if;

  if p_accept then
    select count(*)::integer into v_participant_count
    from public.reservation_participants participant
    where participant.reservation_id = v_reservation_id;

    if v_participant_count >= 4 then
      raise exception 'This reservation already has four confirmed players.';
    end if;

    insert into public.reservation_participants (reservation_id, player_id, role)
    values (v_reservation_id, v_user_id, 'member')
    on conflict (reservation_id, player_id) do nothing;
  end if;

  update public.reservation_invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now(),
      updated_at = now()
  where id = p_invitation_id;

  update public.reservations reservation
  set initial_player_count = (
    select count(*)::smallint
    from public.reservation_participants participant
    where participant.reservation_id = reservation.id
  ), updated_at = now()
  where reservation.id = v_reservation_id;

  update public.notifications
  set read_at = coalesce(read_at, now()), updated_at = now()
  where user_id = v_user_id
    and invitation_id = p_invitation_id
    and event_key = 'reservation_invitation';

  insert into public.notifications (
    user_id, reservation_id, invitation_id, event_type, event_key, delivery_status
  ) values (
    v_host_id,
    v_reservation_id,
    p_invitation_id,
    case when p_accept then 'reservation_confirmation'::public.notification_event_type else 'join_request_rejected'::public.notification_event_type end,
    case when p_accept then 'reservation_invitation_accepted' else 'reservation_invitation_declined' end,
    'pending'
  );

  return p_invitation_id;
end;
$function$;

create or replace function private.join_reservation_waitlist(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_type public.reservation_type;
  v_host_id uuid;
  v_initial_count integer;
  v_accepted_count integer;
  v_waitlist_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select reservation.type, reservation.host_id, reservation.initial_player_count
  into v_reservation_type, v_host_id, v_initial_count
  from public.reservations reservation
  where reservation.id = p_reservation_id
    and reservation.status = 'confirmed'
    and reservation.start_at > now()
  for update;

  if v_host_id is null then
    raise exception 'Upcoming reservation not found.' using errcode = 'P0002';
  end if;
  if v_host_id = v_user_id or exists (
    select 1 from public.reservation_participants participant
    where participant.reservation_id = p_reservation_id and participant.player_id = v_user_id
  ) then
    raise exception 'You are already included in this reservation.';
  end if;

  if v_reservation_type = 'open' then
    select count(*)::integer into v_accepted_count
    from public.join_requests request
    where request.reservation_id = p_reservation_id and request.status = 'accepted';
    if v_initial_count + v_accepted_count < 4 then
      raise exception 'This Open Court still has an available place.';
    end if;
  end if;

  insert into public.reservation_waitlist (
    reservation_id, player_id, status, joined_at, resolved_at, updated_at
  ) values (
    p_reservation_id, v_user_id, 'waiting', now(), null, now()
  )
  on conflict (reservation_id, player_id)
  do update set status = 'waiting', joined_at = now(), resolved_at = null, updated_at = now()
  where public.reservation_waitlist.status in ('left', 'cancelled', 'notified')
  returning id into v_waitlist_id;

  if v_waitlist_id is null then
    raise exception 'You are already on this waitlist.';
  end if;

  insert into public.notifications (
    user_id, reservation_id, waitlist_id, event_type, event_key, delivery_status
  ) values (
    v_host_id, p_reservation_id, v_waitlist_id, 'join_request_created', 'waitlist_joined', 'pending'
  );

  return v_waitlist_id;
end;
$function$;

create or replace function private.leave_reservation_waitlist(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_waitlist_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  update public.reservation_waitlist
  set status = 'left', resolved_at = now(), updated_at = now()
  where reservation_id = p_reservation_id
    and player_id = v_user_id
    and status = 'waiting'
  returning id into v_waitlist_id;

  if v_waitlist_id is null then
    raise exception 'Active waitlist entry not found.' using errcode = 'P0002';
  end if;
  return v_waitlist_id;
end;
$function$;

create or replace function private.promote_open_court_waitlist(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_waitlist_id uuid;
  v_player_id uuid;
  v_request_id uuid;
begin
  select waitlist.id, waitlist.player_id
  into v_waitlist_id, v_player_id
  from public.reservation_waitlist waitlist
  join public.reservations reservation on reservation.id = waitlist.reservation_id
  where waitlist.reservation_id = p_reservation_id
    and waitlist.status = 'waiting'
    and reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.start_at > now()
  order by waitlist.joined_at, waitlist.id
  for update of waitlist skip locked
  limit 1;

  if v_waitlist_id is null then return null; end if;

  insert into public.reservation_participants (reservation_id, player_id, role)
  values (p_reservation_id, v_player_id, 'member')
  on conflict (reservation_id, player_id) do nothing;

  insert into public.join_requests (
    reservation_id, player_id, status, requested_at, decided_at, updated_at
  ) values (
    p_reservation_id, v_player_id, 'accepted', now(), now(), now()
  )
  on conflict (reservation_id, player_id)
  do update set status = 'accepted', decided_at = now(), updated_at = now()
  returning id into v_request_id;

  update public.reservation_waitlist
  set status = 'promoted', resolved_at = now(), updated_at = now()
  where id = v_waitlist_id;

  insert into public.notifications (
    user_id, reservation_id, join_request_id, waitlist_id, event_type, event_key, delivery_status
  ) values (
    v_player_id, p_reservation_id, v_request_id, v_waitlist_id,
    'join_request_accepted', 'waitlist_promoted', 'pending'
  );

  return v_player_id;
end;
$function$;

create or replace function private.queue_pending_open_court_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_is_full boolean;
  v_pending record;
  v_waitlist_id uuid;
begin
  if new.status <> 'accepted' then return new; end if;

  select reservation.initial_player_count + (
    select count(*) from public.join_requests accepted
    where accepted.reservation_id = reservation.id and accepted.status = 'accepted'
  ) >= 4
  into v_is_full
  from public.reservations reservation
  where reservation.id = new.reservation_id
    and reservation.type = 'open'
    and reservation.status = 'confirmed';

  if not coalesce(v_is_full, false) then return new; end if;

  for v_pending in
    select request.id, request.player_id, request.requested_at
    from public.join_requests request
    where request.reservation_id = new.reservation_id
      and request.status = 'pending'
    order by request.requested_at, request.id
    for update
  loop
    v_waitlist_id := null;
    insert into public.reservation_waitlist (
      reservation_id, player_id, status, joined_at, resolved_at, updated_at
    ) values (
      new.reservation_id, v_pending.player_id, 'waiting', v_pending.requested_at, null, now()
    )
    on conflict (reservation_id, player_id)
    do update set status = 'waiting', joined_at = least(public.reservation_waitlist.joined_at, excluded.joined_at), resolved_at = null, updated_at = now()
    where public.reservation_waitlist.status in ('left', 'cancelled', 'notified')
    returning id into v_waitlist_id;

    update public.join_requests
    set status = 'cancelled', decided_at = now(), updated_at = now()
    where id = v_pending.id;

    update public.notifications
    set read_at = coalesce(read_at, now()), updated_at = now()
    where join_request_id = v_pending.id and event_type = 'join_request_created';

    if v_waitlist_id is not null then
      insert into public.notifications (
        user_id, reservation_id, join_request_id, waitlist_id, event_type, event_key, delivery_status
      ) values (
        v_pending.player_id, new.reservation_id, v_pending.id, v_waitlist_id,
        'join_request_created', 'waitlist_added', 'pending'
      );
    end if;
  end loop;

  return new;
end;
$function$;

drop trigger if exists queue_pending_open_court_requests on public.join_requests;
create trigger queue_pending_open_court_requests
after insert or update of status on public.join_requests
for each row execute function private.queue_pending_open_court_requests();

create or replace function private.leave_open_court(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_join_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select reservation.host_id, request.id
  into v_host_id, v_join_request_id
  from public.reservations reservation
  join public.join_requests request
    on request.reservation_id = reservation.id
   and request.player_id = v_user_id
   and request.status = 'accepted'
  where reservation.id = p_reservation_id
    and reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.start_at > now()
    and reservation.host_id <> v_user_id
  for update of reservation, request;

  if v_join_request_id is null then
    raise exception 'An upcoming Open Court spot was not found.' using errcode = 'P0002';
  end if;

  delete from public.reservation_participants
  where reservation_id = p_reservation_id
    and player_id = v_user_id
    and role = 'member';

  update public.join_requests
  set status = 'cancelled', decided_at = now(), updated_at = now()
  where id = v_join_request_id;

  insert into public.notifications (
    user_id, reservation_id, join_request_id, event_type, delivery_status
  ) values (
    v_host_id, p_reservation_id, v_join_request_id, 'participant_removed', 'pending'
  );

  perform private.promote_open_court_waitlist(p_reservation_id);
  return p_reservation_id;
end;
$function$;

create or replace function private.admin_remove_open_court_participant(p_join_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation_id uuid;
  v_player_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  select request.reservation_id, request.player_id
  into v_reservation_id, v_player_id
  from public.join_requests request
  join public.reservations reservation on reservation.id = request.reservation_id
  where request.id = p_join_request_id
    and request.status = 'accepted'
    and reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.end_at > now()
  for update of reservation, request;

  if v_reservation_id is null then
    raise exception 'Accepted Open Court player not found.' using errcode = 'P0002';
  end if;

  delete from public.reservation_participants
  where reservation_id = v_reservation_id and player_id = v_player_id and role = 'member';
  update public.join_requests
  set status = 'cancelled', decided_at = now(), updated_at = now()
  where id = p_join_request_id;

  insert into public.notifications (
    user_id, reservation_id, join_request_id, event_type, delivery_status
  ) values (
    v_player_id, v_reservation_id, p_join_request_id, 'reservation_cancellation', 'pending'
  );

  perform private.promote_open_court_waitlist(v_reservation_id);
  return p_join_request_id;
end;
$function$;

create or replace function private.cancel_reservation(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_start_at timestamptz;
  v_status public.reservation_status;
  v_cancellation_hours smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select reservation.start_at, reservation.status
  into v_start_at, v_status
  from public.reservations reservation
  where reservation.id = p_reservation_id and reservation.host_id = v_user_id
  for update;

  if not found then
    raise exception 'Reservation not found or you are not its host.' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'confirmed') then
    raise exception 'Only an active reservation can be cancelled.';
  end if;

  select settings.cancellation_hours into v_cancellation_hours
  from public.facility_settings settings where settings.id = 1;
  if v_cancellation_hours is null then
    raise exception 'Facility settings have not been configured.';
  end if;
  if v_start_at <= now() + make_interval(hours => v_cancellation_hours) then
    raise exception 'This reservation is past the cancellation deadline.';
  end if;

  update public.reservations
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_reservation_id;

  insert into public.notifications (user_id, reservation_id, event_type, delivery_status)
  select participant.player_id, p_reservation_id, 'reservation_cancellation', 'pending'
  from public.reservation_participants participant
  where participant.reservation_id = p_reservation_id
    and participant.player_id <> v_user_id;

  update public.reservation_invitations invitation
  set status = 'cancelled', responded_at = coalesce(responded_at, now()), updated_at = now()
  where invitation.reservation_id = p_reservation_id and invitation.status = 'pending';

  insert into public.notifications (user_id, reservation_id, invitation_id, event_type, delivery_status)
  select invitation.invitee_id, p_reservation_id, invitation.id, 'reservation_cancellation', 'pending'
  from public.reservation_invitations invitation
  where invitation.reservation_id = p_reservation_id and invitation.status = 'cancelled';

  update public.reservation_waitlist waitlist
  set status = 'notified', resolved_at = now(), updated_at = now()
  where waitlist.reservation_id = p_reservation_id and waitlist.status = 'waiting';

  insert into public.notifications (
    user_id, reservation_id, waitlist_id, event_type, event_key, delivery_status
  )
  select
    waitlist.player_id, p_reservation_id, waitlist.id,
    'reservation_confirmation', 'court_available', 'pending'
  from public.reservation_waitlist waitlist
  where waitlist.reservation_id = p_reservation_id and waitlist.status = 'notified';

  return p_reservation_id;
end;
$function$;

drop function if exists public.list_open_courts();
drop function if exists private.list_open_courts();

create function private.list_open_courts()
returns table (
  reservation_id uuid,
  host_username text,
  start_at timestamptz,
  end_at timestamptz,
  player_count integer,
  available_spots integer,
  request_status text,
  is_host boolean,
  waitlist_status text,
  waitlist_position integer
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
  select
    reservation.id,
    host.username,
    reservation.start_at,
    reservation.end_at,
    (reservation.initial_player_count + coalesce(accepted.accepted_count, 0))::integer,
    greatest(4 - reservation.initial_player_count - coalesce(accepted.accepted_count, 0), 0)::integer,
    request.status::text,
    reservation.host_id = v_user_id,
    own_waitlist.status,
    case when own_waitlist.status = 'waiting' then (
      select count(*)::integer
      from public.reservation_waitlist ahead
      where ahead.reservation_id = reservation.id
        and ahead.status = 'waiting'
        and (ahead.joined_at, ahead.id) <= (own_waitlist.joined_at, own_waitlist.id)
    ) else null end
  from public.reservations reservation
  join public.profiles host on host.id = reservation.host_id
  left join lateral (
    select count(*)::integer accepted_count
    from public.join_requests accepted_request
    where accepted_request.reservation_id = reservation.id and accepted_request.status = 'accepted'
  ) accepted on true
  left join public.join_requests request
    on request.reservation_id = reservation.id and request.player_id = v_user_id
  left join public.reservation_waitlist own_waitlist
    on own_waitlist.reservation_id = reservation.id and own_waitlist.player_id = v_user_id
  where reservation.type = 'open'
    and reservation.status = 'confirmed'
    and reservation.end_at > now()
  order by reservation.start_at;
end;
$function$;

create or replace function private.list_calendar_waitlist_opportunities(p_date date)
returns table (
  reservation_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  reservation_type text,
  waitlist_status text,
  waitlist_position integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_day_start timestamptz := p_date::timestamp at time zone 'Asia/Beirut';
  v_day_end timestamptz := (p_date + 1)::timestamp at time zone 'Asia/Beirut';
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  return query
  select
    reservation.id,
    reservation.start_at,
    reservation.end_at,
    reservation.type::text,
    own_waitlist.status,
    case when own_waitlist.status = 'waiting' then (
      select count(*)::integer
      from public.reservation_waitlist ahead
      where ahead.reservation_id = reservation.id
        and ahead.status = 'waiting'
        and (ahead.joined_at, ahead.id) <= (own_waitlist.joined_at, own_waitlist.id)
    ) else null end
  from public.reservations reservation
  left join public.reservation_waitlist own_waitlist
    on own_waitlist.reservation_id = reservation.id and own_waitlist.player_id = v_user_id
  where reservation.status = 'confirmed'
    and reservation.start_at < v_day_end
    and reservation.end_at > v_day_start
    and reservation.start_at > now()
    and reservation.host_id <> v_user_id
    and not exists (
      select 1 from public.reservation_participants participant
      where participant.reservation_id = reservation.id and participant.player_id = v_user_id
    )
  order by reservation.start_at;
end;
$function$;

create or replace function private.list_player_notifications()
returns table (
  notification_id uuid,
  event_type text,
  created_at timestamptz,
  read_at timestamptz,
  reservation_id uuid,
  friendship_id uuid,
  join_request_id uuid,
  actor_username text,
  reservation_start_at timestamptz,
  reservation_end_at timestamptz
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
  select
    notification.id,
    coalesce(notification.event_key, notification.event_type::text),
    notification.created_at,
    notification.read_at,
    notification.reservation_id,
    notification.friendship_id,
    notification.join_request_id,
    coalesce(friend_actor.username, join_actor.username, invitation_actor.username, waitlist_actor.username, reservation_host.username),
    reservation.start_at,
    reservation.end_at
  from public.notifications notification
  left join public.friendships friendship on friendship.id = notification.friendship_id
  left join public.profiles friend_actor on friend_actor.id = case
    when notification.friendship_id is null then null
    when notification.event_type = 'join_request_created' then friendship.requester_id
    else friendship.addressee_id
  end
  left join public.join_requests notification_request on notification_request.id = notification.join_request_id
  left join public.profiles join_actor on join_actor.id = notification_request.player_id
  left join public.reservation_invitations invitation on invitation.id = notification.invitation_id
  left join public.reservations reservation on reservation.id = notification.reservation_id
  left join public.profiles invitation_actor on invitation_actor.id = case
    when notification.event_key = 'reservation_invitation' then reservation.host_id
    else invitation.invitee_id
  end
  left join public.reservation_waitlist waitlist on waitlist.id = notification.waitlist_id
  left join public.profiles waitlist_actor on waitlist_actor.id = waitlist.player_id
  left join public.profiles reservation_host on reservation_host.id = reservation.host_id
  where notification.user_id = v_user_id
  order by notification.created_at desc
  limit 50;
end;
$function$;

create or replace function public.list_private_reservation_invitations()
returns table (
  invitation_id uuid, reservation_id uuid, host_username text, invitee_username text,
  start_at timestamptz, end_at timestamptz, status text, is_host boolean, created_at timestamptz
)
language sql stable set search_path = ''
as $function$ select * from private.list_private_reservation_invitations(); $function$;

create or replace function public.respond_reservation_invitation(p_invitation_id uuid, p_accept boolean)
returns uuid language sql set search_path = ''
as $function$ select private.respond_reservation_invitation(p_invitation_id, p_accept); $function$;

create or replace function public.join_reservation_waitlist(p_reservation_id uuid)
returns uuid language sql set search_path = ''
as $function$ select private.join_reservation_waitlist(p_reservation_id); $function$;

create or replace function public.leave_reservation_waitlist(p_reservation_id uuid)
returns uuid language sql set search_path = ''
as $function$ select private.leave_reservation_waitlist(p_reservation_id); $function$;

create function public.list_open_courts()
returns table (
  reservation_id uuid, host_username text, start_at timestamptz, end_at timestamptz,
  player_count integer, available_spots integer, request_status text, is_host boolean,
  waitlist_status text, waitlist_position integer
)
language sql stable set search_path = ''
as $function$ select * from private.list_open_courts(); $function$;

create or replace function public.list_calendar_waitlist_opportunities(p_date date)
returns table (
  reservation_id uuid, start_at timestamptz, end_at timestamptz,
  reservation_type text, waitlist_status text, waitlist_position integer
)
language sql stable set search_path = ''
as $function$ select * from private.list_calendar_waitlist_opportunities(p_date); $function$;

revoke all on function private.list_private_reservation_invitations() from public;
revoke all on function private.respond_reservation_invitation(uuid, boolean) from public;
revoke all on function private.join_reservation_waitlist(uuid) from public;
revoke all on function private.leave_reservation_waitlist(uuid) from public;
revoke all on function private.promote_open_court_waitlist(uuid) from public;
revoke all on function private.queue_pending_open_court_requests() from public;
revoke all on function private.list_open_courts() from public;
revoke all on function private.list_calendar_waitlist_opportunities(date) from public;

revoke all on function public.list_private_reservation_invitations() from public, anon;
revoke all on function public.respond_reservation_invitation(uuid, boolean) from public, anon;
revoke all on function public.join_reservation_waitlist(uuid) from public, anon;
revoke all on function public.leave_reservation_waitlist(uuid) from public, anon;
revoke all on function public.list_open_courts() from public, anon;
revoke all on function public.list_calendar_waitlist_opportunities(date) from public, anon;

grant execute on function public.list_private_reservation_invitations() to authenticated;
grant execute on function public.respond_reservation_invitation(uuid, boolean) to authenticated;
grant execute on function public.join_reservation_waitlist(uuid) to authenticated;
grant execute on function public.leave_reservation_waitlist(uuid) to authenticated;
grant execute on function public.list_open_courts() to authenticated;
grant execute on function public.list_calendar_waitlist_opportunities(date) to authenticated;

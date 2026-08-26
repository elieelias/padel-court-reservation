alter table public.notifications
  add column if not exists event_key text;

create table if not exists public.email_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid unique references public.notifications(id) on delete cascade,
  admin_notification_id uuid unique references public.admin_account_notifications(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  event_type text not null,
  event_key text,
  context_type text,
  actor_username text,
  reservation_id uuid references public.reservations(id) on delete set null,
  reservation_start_at timestamptz,
  reservation_end_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_notification_outbox_one_source_check check (
    (notification_id is not null)::integer + (admin_notification_id is not null)::integer = 1
  )
);

create index if not exists email_notification_outbox_delivery_idx
  on public.email_notification_outbox (available_at, created_at, id)
  where status in ('pending', 'failed');

alter table public.email_notification_outbox enable row level security;
revoke all on public.email_notification_outbox from public, anon, authenticated;

create or replace function private.queue_player_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text;
  v_name text;
  v_actor_username text;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  select user_record.email, profile.full_name
  into v_email, v_name
  from auth.users user_record
  join public.profiles profile on profile.id = user_record.id
  where user_record.id = new.user_id;

  if v_email is null then return new; end if;

  if auth.uid() is not null and auth.uid() <> new.user_id then
    select profile.username into v_actor_username
    from public.profiles profile where profile.id = auth.uid();
  end if;

  if new.reservation_id is not null then
    select reservation.start_at, reservation.end_at,
      coalesce(v_actor_username, host.username)
    into v_start_at, v_end_at, v_actor_username
    from public.reservations reservation
    join public.profiles host on host.id = reservation.host_id
    where reservation.id = new.reservation_id;
  end if;

  insert into public.email_notification_outbox (
    notification_id,
    recipient_user_id,
    recipient_email,
    recipient_name,
    event_type,
    event_key,
    context_type,
    actor_username,
    reservation_id,
    reservation_start_at,
    reservation_end_at,
    available_at
  ) values (
    new.id,
    new.user_id,
    v_email,
    v_name,
    new.event_type::text,
    new.event_key,
    case
      when new.friendship_id is not null then 'friendship'
      when new.join_request_id is not null then 'open_court_request'
      else 'reservation'
    end,
    v_actor_username,
    new.reservation_id,
    v_start_at,
    v_end_at,
    greatest(coalesce(new.scheduled_for, now()), now())
  ) on conflict (notification_id) do nothing;

  return new;
end;
$function$;

create or replace function private.queue_admin_account_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text;
  v_name text;
  v_actor_username text;
begin
  select user_record.email, recipient.full_name
  into v_email, v_name
  from auth.users user_record
  join public.profiles recipient on recipient.id = user_record.id
  where user_record.id = new.recipient_id;

  select account.username into v_actor_username
  from public.profiles account where account.id = new.account_id;

  if v_email is null then return new; end if;

  insert into public.email_notification_outbox (
    admin_notification_id,
    recipient_user_id,
    recipient_email,
    recipient_name,
    event_type,
    event_key,
    context_type,
    actor_username
  ) values (
    new.id,
    new.recipient_id,
    v_email,
    v_name,
    new.event_type,
    new.event_type,
    'administrator_account',
    v_actor_username
  ) on conflict (admin_notification_id) do nothing;

  return new;
end;
$function$;

revoke all on function private.queue_player_notification_email() from public, anon, authenticated;
revoke all on function private.queue_admin_account_notification_email() from public, anon, authenticated;

drop trigger if exists queue_player_notification_email on public.notifications;
create trigger queue_player_notification_email
after insert on public.notifications
for each row execute function private.queue_player_notification_email();

drop trigger if exists queue_admin_account_notification_email on public.admin_account_notifications;
create trigger queue_admin_account_notification_email
after insert on public.admin_account_notifications
for each row execute function private.queue_admin_account_notification_email();

create or replace function public.claim_email_notification_outbox(p_limit integer default 20)
returns setof public.email_notification_outbox
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role access is required.' using errcode = '42501';
  end if;

  return query
  with selected as (
    select outbox.id
    from public.email_notification_outbox outbox
    where outbox.status in ('pending', 'failed')
      and outbox.available_at <= now()
      and outbox.attempts < 5
    order by outbox.available_at, outbox.created_at, outbox.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.email_notification_outbox outbox
  set status = 'processing',
      attempts = outbox.attempts + 1,
      updated_at = now(),
      error_message = null
  from selected
  where outbox.id = selected.id
  returning outbox.*;
end;
$function$;

revoke all on function public.claim_email_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_notification_outbox(integer) to service_role;

comment on table public.email_notification_outbox is
  'Email delivery queue generated from the existing in-app notification stream.';

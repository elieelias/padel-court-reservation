alter table public.profiles
  add column if not exists is_main_administrator boolean not null default false;

update public.profiles
set is_main_administrator = true
where id = (
  select profile.id
  from public.profiles profile
  where profile.role = 'administrator'
  order by profile.created_at, profile.id
  limit 1
)
and not exists (
  select 1
  from public.profiles existing_main
  where existing_main.role = 'administrator'
    and existing_main.is_main_administrator
);

alter table public.profiles
  drop constraint if exists profiles_main_administrator_role_check;

alter table public.profiles
  add constraint profiles_main_administrator_role_check
  check (not is_main_administrator or role = 'administrator');

create unique index if not exists profiles_single_main_administrator_idx
  on public.profiles (is_main_administrator)
  where is_main_administrator;

create table public.admin_account_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('player_account_created', 'administrator_account_created')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint admin_account_notifications_recipient_account_check check (recipient_id <> account_id)
);

create index admin_account_notifications_recipient_created_idx
  on public.admin_account_notifications (recipient_id, created_at desc);

create index admin_account_notifications_account_id_idx
  on public.admin_account_notifications (account_id);

create index admin_account_notifications_recipient_unread_idx
  on public.admin_account_notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.admin_account_notifications enable row level security;

create policy "Administrators can view their account notifications"
on public.admin_account_notifications for select to authenticated
using (
  (select auth.uid()) = recipient_id
  and private.is_administrator()
);

create policy "Administrators can mark their account notifications read"
on public.admin_account_notifications for update to authenticated
using (
  (select auth.uid()) = recipient_id
  and private.is_administrator()
)
with check (
  (select auth.uid()) = recipient_id
  and private.is_administrator()
);

revoke all on table public.admin_account_notifications from public, anon;
grant select on table public.admin_account_notifications to authenticated;
grant update (read_at) on table public.admin_account_notifications to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_role public.user_role := case
    when coalesce(new.raw_app_meta_data ->> 'court_role', '') = 'administrator'
      then 'administrator'::public.user_role
    else 'player'::public.user_role
  end;
begin
  if v_username !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$' then
    v_username := case
      when v_role = 'administrator' then 'admin_' else 'player_'
    end || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.profiles (id, username, full_name, phone_number, role)
  values (
    new.id,
    v_username,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', v_username)), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone_number'), ''),
    v_role
  );
  return new;
end;
$function$;

create or replace function private.notify_administrators_of_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.role not in ('player', 'administrator') then
    return new;
  end if;

  insert into public.admin_account_notifications (recipient_id, account_id, event_type)
  select
    administrator.id,
    new.id,
    case
      when new.role = 'administrator'
        then 'administrator_account_created'
      else 'player_account_created'
    end
  from public.profiles administrator
  where administrator.role = 'administrator'
    and administrator.id <> new.id;

  return new;
end;
$function$;

drop trigger if exists notify_administrators_of_new_account on public.profiles;
create trigger notify_administrators_of_new_account
after insert on public.profiles
for each row execute function private.notify_administrators_of_new_account();

create or replace function private.admin_list_account_notifications()
returns table (
  notification_id uuid,
  event_type text,
  created_at timestamptz,
  read_at timestamptz,
  account_id uuid,
  account_username text,
  account_full_name text,
  account_email text,
  account_role public.user_role
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

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  return query
  select
    notification.id,
    notification.event_type,
    notification.created_at,
    notification.read_at,
    account.id,
    account.username,
    account.full_name,
    auth_account.email::text,
    account.role
  from public.admin_account_notifications notification
  join public.profiles account on account.id = notification.account_id
  join auth.users auth_account on auth_account.id = notification.account_id
  where notification.recipient_id = v_user_id
  order by notification.created_at desc
  limit 100;
end;
$function$;

create or replace function public.admin_list_account_notifications()
returns table (
  notification_id uuid,
  event_type text,
  created_at timestamptz,
  read_at timestamptz,
  account_id uuid,
  account_username text,
  account_full_name text,
  account_email text,
  account_role public.user_role
)
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_list_account_notifications();
$function$;

create or replace function private.admin_mark_account_notifications_read(
  p_notification_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not private.is_administrator() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;

  update public.admin_account_notifications
  set read_at = coalesce(read_at, now())
  where recipient_id = v_user_id
    and read_at is null
    and (p_notification_ids is null or id = any(p_notification_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.admin_mark_account_notifications_read(
  p_notification_ids uuid[] default null
)
returns integer
language sql
set search_path = ''
as $function$
  select private.admin_mark_account_notifications_read(p_notification_ids);
$function$;

revoke all on function private.notify_administrators_of_new_account() from public, anon, authenticated;
revoke all on function private.admin_list_account_notifications() from public, anon;
revoke all on function private.admin_mark_account_notifications_read(uuid[]) from public, anon;
grant execute on function private.admin_list_account_notifications() to authenticated;
grant execute on function private.admin_mark_account_notifications_read(uuid[]) to authenticated;

revoke all on function public.admin_list_account_notifications() from public, anon;
revoke all on function public.admin_mark_account_notifications_read(uuid[]) from public, anon;
grant execute on function public.admin_list_account_notifications() to authenticated;
grant execute on function public.admin_mark_account_notifications_read(uuid[]) to authenticated;

do $publication$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_account_notifications'
  ) then
    alter publication supabase_realtime add table public.admin_account_notifications;
  end if;
end;
$publication$;

create or replace function private.admin_list_administrators()
returns table (
  id uuid,
  email text,
  username text,
  full_name text,
  phone_number text,
  is_main_administrator boolean,
  created_at timestamptz
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

  return query
  select
    profile.id,
    account.email::text,
    profile.username,
    profile.full_name,
    profile.phone_number,
    profile.is_main_administrator,
    profile.created_at
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where profile.role = 'administrator'
  order by profile.is_main_administrator desc, profile.created_at, profile.id;
end;
$function$;

create or replace function public.admin_list_administrators()
returns table (
  id uuid,
  email text,
  username text,
  full_name text,
  phone_number text,
  is_main_administrator boolean,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $function$
  select * from private.admin_list_administrators();
$function$;

revoke all on function private.admin_list_administrators() from public, anon;
grant execute on function private.admin_list_administrators() to authenticated;
revoke all on function public.admin_list_administrators() from public, anon;
grant execute on function public.admin_list_administrators() to authenticated;

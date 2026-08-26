-- Publishes the active discount as one managed event and notifies every player when it changes.

alter table public.facility_events
  add column if not exists source_key text;

create unique index if not exists facility_events_source_key_idx
  on public.facility_events (source_key)
  where source_key is not null;

alter table public.notifications
  drop constraint if exists notifications_event_key_check;

alter table public.notifications
  add constraint notifications_event_key_check
  check (
    event_key is null
    or event_key in (
      'reservation_invitation',
      'reservation_invitation_accepted',
      'reservation_invitation_declined',
      'waitlist_joined',
      'waitlist_added',
      'waitlist_promoted',
      'court_available',
      'discount_announcement'
    )
  );

do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'facility_settings_active_discount_window_check'
      and conrelid = 'public.facility_settings'::regclass
  ) then
    alter table public.facility_settings
      add constraint facility_settings_active_discount_window_check
      check (
        not discount_enabled
        or (discount_starts_at is not null and discount_ends_at is not null)
      );
  end if;
end;
$block$;

create or replace function private.sync_discount_announcement(p_notify_players boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  settings public.facility_settings%rowtype;
  discount_label text;
  event_title text;
begin
  select * into settings
  from public.facility_settings
  where id = 1;

  if not found
    or not settings.discount_enabled
    or settings.discount_starts_at is null
    or settings.discount_ends_at is null
  then
    delete from public.facility_events where source_key = 'active_discount';
    return;
  end if;

  discount_label := replace(to_char(settings.discount_percentage, 'FM999990D##'), ',', '.');
  event_title := case
    when char_length(btrim(coalesce(settings.discount_name, ''))) >= 3
      then btrim(settings.discount_name)
    else discount_label || '% court discount'
  end;

  insert into public.facility_events (
    title,
    description,
    event_type,
    start_at,
    end_at,
    source_key
  ) values (
    event_title,
    discount_label || '% off court reservations. The discount is applied automatically when booking during this period.',
    'announcement',
    settings.discount_starts_at,
    settings.discount_ends_at,
    'active_discount'
  )
  on conflict (source_key) where source_key is not null
  do update set
    title = excluded.title,
    description = excluded.description,
    event_type = excluded.event_type,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    updated_at = now();

  if p_notify_players and settings.discount_ends_at > now() then
    insert into public.notifications (
      user_id,
      event_type,
      event_key,
      delivery_status
    )
    select
      profile.id,
      'reservation_confirmation',
      'discount_announcement',
      'pending'
    from public.profiles profile
    where profile.role = 'player';
  end if;
end;
$function$;

create or replace function private.sync_discount_announcement_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if row(
    new.discount_enabled,
    new.discount_name,
    new.discount_percentage,
    new.discount_starts_at,
    new.discount_ends_at
  ) is distinct from row(
    old.discount_enabled,
    old.discount_name,
    old.discount_percentage,
    old.discount_starts_at,
    old.discount_ends_at
  ) then
    perform private.sync_discount_announcement(new.discount_enabled);
  end if;

  return new;
end;
$function$;

drop trigger if exists sync_discount_announcement on public.facility_settings;
create trigger sync_discount_announcement
after update of
  discount_enabled,
  discount_name,
  discount_percentage,
  discount_starts_at,
  discount_ends_at
on public.facility_settings
for each row execute function private.sync_discount_announcement_after_update();

revoke all on function private.sync_discount_announcement(boolean) from public, anon, authenticated;
revoke all on function private.sync_discount_announcement_after_update() from public, anon, authenticated;

comment on column public.facility_events.source_key is
  'Stable key for system-managed events such as the active reservation discount.';

select private.sync_discount_announcement(true);

create type public.facility_event_type as enum ('tournament', 'community', 'announcement');

create table public.facility_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text,
  event_type public.facility_event_type not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_events_valid_time_check check (end_at > start_at)
);

create index facility_events_start_at_idx on public.facility_events (start_at);
create index facility_events_end_at_idx on public.facility_events (end_at);

alter table public.facility_events enable row level security;

grant select on table public.facility_events to authenticated;
grant insert, update, delete on table public.facility_events to authenticated;
grant select on table public.blocked_periods to authenticated;

create policy "Players can view facility events"
on public.facility_events for select to authenticated
using (end_at > now() or private.is_administrator());

create policy "Administrators can create facility events"
on public.facility_events for insert to authenticated
with check (private.is_administrator());

create policy "Administrators can update facility events"
on public.facility_events for update to authenticated
using (private.is_administrator())
with check (private.is_administrator());

create policy "Administrators can delete facility events"
on public.facility_events for delete to authenticated
using (private.is_administrator());

drop policy if exists blocked_periods_select_admin on public.blocked_periods;
create policy "Players can view upcoming blocked periods"
on public.blocked_periods for select to authenticated
using (end_at > now() or private.is_administrator());

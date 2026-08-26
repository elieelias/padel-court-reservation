create table public.reservation_series (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  frequency text not null default 'weekly' check (frequency = 'weekly'),
  occurrence_count smallint not null check (occurrence_count between 2 and 4),
  created_at timestamptz not null default now()
);

create index reservation_series_host_created_idx
  on public.reservation_series (host_id, created_at desc);

alter table public.reservation_series enable row level security;

create policy "reservation_series_select_related"
on public.reservation_series for select to authenticated
using (
  host_id = (select auth.uid())
  or (select private.is_administrator())
);

grant select on public.reservation_series to authenticated;
revoke all on public.reservation_series from anon;

alter table public.reservations
  add column series_id uuid references public.reservation_series(id) on delete set null,
  add column series_occurrence smallint;

alter table public.reservations
  add constraint reservations_series_consistency check (
    (series_id is null and series_occurrence is null)
    or (series_id is not null and series_occurrence is not null and series_occurrence between 1 and 4)
  ),
  add constraint reservations_series_occurrence_key unique (series_id, series_occurrence);

create index reservations_series_id_idx
  on public.reservations (series_id)
  where series_id is not null;

grant select (series_id, series_occurrence) on public.reservations to authenticated;

create function private.create_recurring_reservations(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_type public.reservation_type,
  p_initial_player_count smallint,
  p_friend_ids uuid[],
  p_occurrence_count smallint
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_series_id uuid;
  v_reservation_id uuid;
  v_reservation_ids uuid[] := '{}'::uuid[];
  v_occurrence smallint;
  v_offset interval;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if p_occurrence_count not between 2 and 4 then
    raise exception 'A recurring reservation must contain between two and four weekly bookings.';
  end if;
  if p_type = 'open' and cardinality(coalesce(p_friend_ids, '{}'::uuid[])) > 0 then
    raise exception 'An Open Court reservation cannot include private invitations.';
  end if;

  insert into public.reservation_series (host_id, occurrence_count)
  values (v_user_id, p_occurrence_count)
  returning id into v_series_id;

  -- One database function call is one transaction: any unavailable week rolls back the entire series.
  for v_occurrence in 1..p_occurrence_count loop
    v_offset := make_interval(days => (v_occurrence - 1) * 7);

    if p_type = 'private' then
      v_reservation_id := private.create_private_reservation(
        p_start_at + v_offset,
        p_end_at + v_offset,
        coalesce(p_friend_ids, '{}'::uuid[])
      );
    else
      v_reservation_id := private.create_reservation(
        p_start_at + v_offset,
        p_end_at + v_offset,
        'open'::public.reservation_type,
        p_initial_player_count
      );
    end if;

    update public.reservations
    set series_id = v_series_id,
        series_occurrence = v_occurrence
    where id = v_reservation_id
      and host_id = v_user_id;

    if not found then
      raise exception 'The recurring reservation could not be linked to its series.';
    end if;

    v_reservation_ids := array_append(v_reservation_ids, v_reservation_id);
  end loop;

  return v_reservation_ids;
end;
$function$;

create function public.create_recurring_reservations(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_type public.reservation_type,
  p_initial_player_count smallint,
  p_friend_ids uuid[],
  p_occurrence_count smallint
)
returns uuid[]
language sql
set search_path = ''
as $function$
  select private.create_recurring_reservations(
    p_start_at,
    p_end_at,
    p_type,
    p_initial_player_count,
    p_friend_ids,
    p_occurrence_count
  );
$function$;

revoke all on function private.create_recurring_reservations(timestamptz, timestamptz, public.reservation_type, smallint, uuid[], smallint) from public, anon;
grant execute on function private.create_recurring_reservations(timestamptz, timestamptz, public.reservation_type, smallint, uuid[], smallint) to authenticated;

revoke all on function public.create_recurring_reservations(timestamptz, timestamptz, public.reservation_type, smallint, uuid[], smallint) from public, anon;
grant execute on function public.create_recurring_reservations(timestamptz, timestamptz, public.reservation_type, smallint, uuid[], smallint) to authenticated;

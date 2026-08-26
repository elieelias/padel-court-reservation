alter table public.facility_settings
  add column if not exists discount_enabled boolean not null default false,
  add column if not exists discount_name text,
  add column if not exists discount_percentage numeric(5, 2) not null default 0,
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'facility_settings_discount_percentage_check'
      and conrelid = 'public.facility_settings'::regclass
  ) then
    alter table public.facility_settings
      add constraint facility_settings_discount_percentage_check
      check (discount_percentage between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'facility_settings_discount_window_check'
      and conrelid = 'public.facility_settings'::regclass
  ) then
    alter table public.facility_settings
      add constraint facility_settings_discount_window_check
      check (
        discount_ends_at is null
        or discount_starts_at is null
        or discount_ends_at > discount_starts_at
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'facility_settings_enabled_discount_check'
      and conrelid = 'public.facility_settings'::regclass
  ) then
    alter table public.facility_settings
      add constraint facility_settings_enabled_discount_check
      check (not discount_enabled or discount_percentage > 0);
  end if;
end;
$block$;

alter table public.reservations
  add column if not exists base_price numeric(10, 2),
  add column if not exists discount_percentage numeric(5, 2) not null default 0,
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists discount_name text;

update public.reservations
set base_price = price
where base_price is null;

alter table public.reservations
  alter column base_price set not null;

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reservations_discount_values_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_discount_values_check
      check (
        base_price >= 0
        and discount_percentage between 0 and 100
        and discount_amount >= 0
        and price >= 0
      );
  end if;
end;
$block$;

grant select (
  discount_enabled,
  discount_name,
  discount_percentage,
  discount_starts_at,
  discount_ends_at
) on public.facility_settings to authenticated;

grant update (
  discount_enabled,
  discount_name,
  discount_percentage,
  discount_starts_at,
  discount_ends_at
) on public.facility_settings to authenticated;

grant select (
  base_price,
  discount_percentage,
  discount_amount,
  discount_name
) on public.reservations to authenticated;

create or replace function private.create_reservation(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_type public.reservation_type,
  p_initial_player_count smallint default 1
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_reservation_id uuid;
  v_timezone text;
  v_default_price numeric(10, 2);
  v_discount_enabled boolean;
  v_discount_name text;
  v_discount_percentage numeric(5, 2);
  v_discount_starts_at timestamptz;
  v_discount_ends_at timestamptz;
  v_applied_discount_percentage numeric(5, 2) := 0;
  v_discount_amount numeric(10, 2) := 0;
  v_final_price numeric(10, 2);
  v_local_start timestamp;
  v_local_end timestamp;
  v_opening_time time;
  v_closing_time time;
  v_slot_duration smallint;
  v_duration_seconds bigint;
  v_start_offset_seconds bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = v_user_id) then
    raise exception 'A player profile is required before making a reservation.';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'The reservation end time must be later than its start time.';
  end if;
  if p_start_at <= now() then
    raise exception 'Reservations must start in the future.';
  end if;
  if p_type = 'private' and p_initial_player_count <> 1 then
    raise exception 'A private reservation must use an initial player count of one.';
  end if;
  if p_initial_player_count not between 1 and 4 then
    raise exception 'The initial player count must be between one and four.';
  end if;

  select
    settings.timezone,
    settings.default_price,
    settings.discount_enabled,
    settings.discount_name,
    settings.discount_percentage,
    settings.discount_starts_at,
    settings.discount_ends_at
  into
    v_timezone,
    v_default_price,
    v_discount_enabled,
    v_discount_name,
    v_discount_percentage,
    v_discount_starts_at,
    v_discount_ends_at
  from public.facility_settings settings
  where settings.id = 1;

  if v_timezone is null or v_default_price is null then
    raise exception 'Facility settings have not been configured.';
  end if;

  if v_discount_enabled
    and v_discount_percentage > 0
    and (v_discount_starts_at is null or p_start_at >= v_discount_starts_at)
    and (v_discount_ends_at is null or p_start_at < v_discount_ends_at)
  then
    v_applied_discount_percentage := v_discount_percentage;
    v_discount_amount := round(v_default_price * v_applied_discount_percentage / 100, 2);
  end if;
  v_final_price := greatest(v_default_price - v_discount_amount, 0);

  v_local_start := p_start_at at time zone v_timezone;
  v_local_end := p_end_at at time zone v_timezone;
  if v_local_start::date <> v_local_end::date then
    raise exception 'A reservation must start and end on the same local date.';
  end if;

  select rule.opening_time, rule.closing_time, rule.slot_duration_minutes
  into v_opening_time, v_closing_time, v_slot_duration
  from public.schedule_rules rule
  where rule.day_of_week = extract(dow from v_local_start)::smallint
    and rule.is_open;

  if not found then
    raise exception 'The facility is closed on the selected day.';
  end if;
  if v_local_start::time < v_opening_time or v_local_end::time > v_closing_time then
    raise exception 'The selected time is outside the facility opening hours.';
  end if;

  v_duration_seconds := extract(epoch from (p_end_at - p_start_at))::bigint;
  v_start_offset_seconds := extract(epoch from (v_local_start::time - v_opening_time))::bigint;
  if mod(v_duration_seconds, v_slot_duration::bigint * 60) <> 0 then
    raise exception 'The reservation duration must use complete schedule slots.';
  end if;
  if mod(v_start_offset_seconds, v_slot_duration::bigint * 60) <> 0 then
    raise exception 'The reservation must begin on a valid schedule boundary.';
  end if;

  if exists (
    select 1 from public.blocked_periods period
    where tstzrange(period.start_at, period.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'The selected time is blocked by the facility.';
  end if;
  if exists (
    select 1 from public.reservations reservation
    where reservation.status in ('pending', 'confirmed')
      and tstzrange(reservation.start_at, reservation.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'The selected time is no longer available.';
  end if;

  begin
    insert into public.reservations (
      host_id,
      start_at,
      end_at,
      type,
      status,
      price,
      base_price,
      discount_percentage,
      discount_amount,
      discount_name,
      payment_status,
      initial_player_count
    ) values (
      v_user_id,
      p_start_at,
      p_end_at,
      p_type,
      'confirmed',
      v_final_price,
      v_default_price,
      v_applied_discount_percentage,
      v_discount_amount,
      case when v_applied_discount_percentage > 0 then nullif(btrim(v_discount_name), '') else null end,
      'unpaid',
      p_initial_player_count
    ) returning id into v_reservation_id;
  exception
    when exclusion_violation then
      raise exception 'The selected time is no longer available. Please refresh and choose another slot.';
  end;

  insert into public.reservation_participants (reservation_id, player_id, role)
  values (v_reservation_id, v_user_id, 'host');

  insert into public.notifications (user_id, reservation_id, event_type, delivery_status)
  values (v_user_id, v_reservation_id, 'reservation_confirmation', 'pending');

  return v_reservation_id;
end;
$function$;

comment on column public.reservations.base_price is
  'Facility price before a scheduled discount was applied.';
comment on column public.reservations.discount_amount is
  'Discount amount fixed at booking time for historical accuracy.';

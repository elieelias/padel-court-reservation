create or replace function private.get_calendar_blocks(p_date date)
returns table (
  start_at timestamptz,
  end_at timestamptz,
  block_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select fs.timezone into v_timezone
  from public.facility_settings fs
  where fs.id = 1;

  if v_timezone is null then
    raise exception 'Facility settings have not been configured.';
  end if;

  v_day_start := p_date::timestamp at time zone v_timezone;
  v_day_end := (p_date + 1)::timestamp at time zone v_timezone;

  return query
  select greatest(r.start_at, v_day_start), least(r.end_at, v_day_end), 'reserved'::text
  from public.reservations r
  where r.status in ('pending', 'confirmed')
    and r.start_at < v_day_end
    and r.end_at > v_day_start
  union all
  select greatest(bp.start_at, v_day_start), least(bp.end_at, v_day_end), 'maintenance'::text
  from public.blocked_periods bp
  where bp.start_at < v_day_end
    and bp.end_at > v_day_start
  order by 1;
end;
$function$;

create or replace function public.get_calendar_blocks(p_date date)
returns table (
  start_at timestamptz,
  end_at timestamptz,
  block_type text
)
language sql
stable
set search_path = ''
as $function$
  select * from private.get_calendar_blocks(p_date);
$function$;

revoke all on function private.get_calendar_blocks(date) from public, anon;
grant execute on function private.get_calendar_blocks(date) to authenticated;
revoke all on function public.get_calendar_blocks(date) from public, anon;
grant execute on function public.get_calendar_blocks(date) to authenticated;

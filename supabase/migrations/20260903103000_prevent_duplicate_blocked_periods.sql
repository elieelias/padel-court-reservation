-- Preserves existing records while preventing any new exact duplicate blocked period.

create or replace function private.prevent_duplicate_blocked_period()
returns trigger
language plpgsql
set search_path = ''
set timezone = 'UTC'
as $function$
begin
  -- Serialize attempts for the same range so simultaneous requests cannot both pass.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.start_at::text || '|' || new.end_at::text, 0)
  );

  if exists (
    select 1
    from public.blocked_periods period
    where period.start_at = new.start_at
      and period.end_at = new.end_at
      and period.id <> new.id
  ) then
    raise exception 'This period is already blocked.'
      using errcode = '23505', constraint = 'blocked_periods_unique_time';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_duplicate_blocked_period on public.blocked_periods;
create trigger prevent_duplicate_blocked_period
before insert or update of start_at, end_at
on public.blocked_periods
for each row execute function private.prevent_duplicate_blocked_period();

revoke all on function private.prevent_duplicate_blocked_period() from public, anon, authenticated;

comment on function private.prevent_duplicate_blocked_period() is
  'Rejects a new blocked period when the same exact start and end timestamps already exist.';

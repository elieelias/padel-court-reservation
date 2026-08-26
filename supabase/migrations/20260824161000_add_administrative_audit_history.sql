create table if not exists public.administrative_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_username text,
  action text not null check (action in ('create', 'update', 'delete', 'create_administrator', 'delete_player')),
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists administrative_audit_log_created_at_idx
  on public.administrative_audit_log (created_at desc, id desc);
create index if not exists administrative_audit_log_actor_id_idx
  on public.administrative_audit_log (actor_id, created_at desc);

alter table public.administrative_audit_log enable row level security;

revoke all on public.administrative_audit_log from public, anon, authenticated;
grant select on public.administrative_audit_log to authenticated;

drop policy if exists "Administrators can read administrative audit history"
  on public.administrative_audit_log;
create policy "Administrators can read administrative audit history"
  on public.administrative_audit_log
  for select
  to authenticated
  using ((select private.is_administrator()));

create or replace function private.record_administrative_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_username text;
  v_old_values jsonb;
  v_new_values jsonb;
  v_entity_id text;
begin
  if v_actor_id is null or not private.is_administrator() then
    return coalesce(new, old);
  end if;

  select profile.full_name, profile.username
  into v_actor_name, v_actor_username
  from public.profiles profile
  where profile.id = v_actor_id;

  if tg_op <> 'INSERT' then
    v_old_values := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new_values := to_jsonb(new);
  end if;

  if tg_table_name = 'reservations' then
    v_old_values := v_old_values - array['pass_token', 'pass_code'];
    v_new_values := v_new_values - array['pass_token', 'pass_code'];
  end if;

  v_entity_id := coalesce(v_new_values ->> 'id', v_old_values ->> 'id');

  insert into public.administrative_audit_log (
    actor_id,
    actor_name,
    actor_username,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) values (
    v_actor_id,
    v_actor_name,
    v_actor_username,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    tg_table_name,
    v_entity_id,
    v_old_values,
    v_new_values
  );

  return coalesce(new, old);
end;
$function$;

revoke all on function private.record_administrative_audit() from public, anon, authenticated;

do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'reservations',
    'facility_settings',
    'schedule_rules',
    'blocked_periods',
    'facility_events',
    'player_issue_reports',
    'profiles'
  ]
  loop
    execute format('drop trigger if exists record_administrative_audit on public.%I', v_table);
    execute format(
      'create trigger record_administrative_audit after insert or update or delete on public.%I for each row execute function private.record_administrative_audit()',
      v_table
    );
  end loop;
end;
$block$;

comment on table public.administrative_audit_log is
  'Immutable administrator activity history with actor and before/after snapshots.';

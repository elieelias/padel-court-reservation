revoke all on table public.admin_account_notifications from public, anon;
grant select on table public.admin_account_notifications to authenticated;
grant update (read_at) on table public.admin_account_notifications to authenticated;

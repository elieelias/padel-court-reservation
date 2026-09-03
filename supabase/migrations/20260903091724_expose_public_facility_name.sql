-- The facility name is public branding. Anonymous visitors may read only that
-- column, while the existing authenticated/admin policies continue protecting
-- the rest of the facility configuration.
grant select (facility_name) on table public.facility_settings to anon;

drop policy if exists facility_settings_select_public_name
on public.facility_settings;

create policy facility_settings_select_public_name
on public.facility_settings
for select
to anon
using (id = 1);

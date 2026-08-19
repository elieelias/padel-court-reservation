alter table public.reservations
  add column pass_token uuid,
  add column pass_code text;

update public.reservations
set
  pass_token = gen_random_uuid(),
  pass_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

alter table public.reservations
  alter column pass_token set default gen_random_uuid(),
  alter column pass_token set not null,
  alter column pass_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  alter column pass_code set not null,
  add constraint reservations_pass_token_key unique (pass_token),
  add constraint reservations_pass_code_key unique (pass_code);

grant select (pass_token, pass_code) on table public.reservations to authenticated;

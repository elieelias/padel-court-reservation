create table public.player_issue_reports (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('booking', 'account', 'payment', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  page_path text,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

create index player_issue_reports_player_created_idx
  on public.player_issue_reports (player_id, created_at desc);

alter table public.player_issue_reports enable row level security;

grant insert, select on table public.player_issue_reports to authenticated;
grant usage, select on sequence public.player_issue_reports_id_seq to authenticated;

create policy "Players can create their own issue reports"
  on public.player_issue_reports
  for insert
  to authenticated
  with check ((select auth.uid()) = player_id);

create policy "Players can view their own issue reports"
  on public.player_issue_reports
  for select
  to authenticated
  using ((select auth.uid()) = player_id);

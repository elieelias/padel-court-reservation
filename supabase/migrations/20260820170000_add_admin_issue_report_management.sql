grant update (status) on table public.player_issue_reports to authenticated;

create policy "Administrators can view all issue reports"
on public.player_issue_reports
for select
to authenticated
using (private.is_administrator());

create policy "Administrators can update issue report status"
on public.player_issue_reports
for update
to authenticated
using (private.is_administrator())
with check (private.is_administrator());

comment on policy "Administrators can view all issue reports" on public.player_issue_reports
is 'Allows signed-in administrators to review player-submitted support reports.';

comment on policy "Administrators can update issue report status" on public.player_issue_reports
is 'Allows signed-in administrators to move reports between open, reviewing, and resolved.';

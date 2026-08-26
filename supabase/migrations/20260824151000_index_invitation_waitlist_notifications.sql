create index if not exists notifications_invitation_id_idx
  on public.notifications (invitation_id)
  where invitation_id is not null;

create index if not exists notifications_waitlist_id_idx
  on public.notifications (waitlist_id)
  where waitlist_id is not null;

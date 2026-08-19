create index if not exists notifications_friendship_id_idx
  on public.notifications (friendship_id)
  where friendship_id is not null;

create index if not exists notifications_join_request_id_idx
  on public.notifications (join_request_id)
  where join_request_id is not null;

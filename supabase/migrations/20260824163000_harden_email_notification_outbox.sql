create index if not exists email_notification_outbox_recipient_user_id_idx
  on public.email_notification_outbox (recipient_user_id);

create index if not exists email_notification_outbox_reservation_id_idx
  on public.email_notification_outbox (reservation_id)
  where reservation_id is not null;

drop policy if exists "Clients cannot access the email delivery queue"
  on public.email_notification_outbox;
create policy "Clients cannot access the email delivery queue"
  on public.email_notification_outbox
  for all
  to anon, authenticated
  using (false)
  with check (false);

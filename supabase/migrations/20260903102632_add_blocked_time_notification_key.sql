alter table public.notifications
  drop constraint if exists notifications_event_key_check;

alter table public.notifications
  add constraint notifications_event_key_check check (
    event_key is null or event_key in (
      'reservation_invitation',
      'reservation_invitation_accepted',
      'reservation_invitation_declined',
      'waitlist_joined',
      'waitlist_added',
      'waitlist_promoted',
      'court_available',
      'discount_announcement',
      'reservation_pending',
      'reservation_ready',
      'reservation_player_left',
      'reservation_player_removed',
      'blocked_time_cancellation'
    )
  );

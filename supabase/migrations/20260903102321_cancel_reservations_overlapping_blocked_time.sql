-- A blocked period takes precedence over existing bookings. Cancelling and
-- notifying inside the same transaction prevents the player and admin apps
-- from ever observing a reservation and maintenance block at the same time.
create or replace function private.cancel_reservations_for_blocked_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reservation record;
  v_recipient_ids uuid[];
begin
  for v_reservation in
    update public.reservations reservation
    set
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
    where reservation.status in ('pending', 'confirmed')
      and reservation.end_at > now()
      and reservation.start_at < new.end_at
      and reservation.end_at > new.start_at
    returning reservation.id, reservation.host_id
  loop
    select array_agg(distinct recipient.user_id)
    into v_recipient_ids
    from (
      select v_reservation.host_id as user_id
      union all
      select participant.player_id
      from public.reservation_participants participant
      where participant.reservation_id = v_reservation.id
      union all
      select invitation.invitee_id
      from public.reservation_invitations invitation
      where invitation.reservation_id = v_reservation.id
        and invitation.status in ('pending', 'accepted')
      union all
      select request.player_id
      from public.join_requests request
      where request.reservation_id = v_reservation.id
        and request.status in ('pending', 'accepted')
      union all
      select waitlist.player_id
      from public.reservation_waitlist waitlist
      where waitlist.reservation_id = v_reservation.id
        and waitlist.status = 'waiting'
    ) recipient
    where recipient.user_id is not null;

    -- Stop stale invitations, requests, waitlists, and queued reminders from
    -- reaching players after the court has been blocked.
    update public.reservation_invitations invitation
    set
      status = 'cancelled',
      responded_at = coalesce(invitation.responded_at, now()),
      updated_at = now()
    where invitation.reservation_id = v_reservation.id
      and invitation.status in ('pending', 'accepted');

    update public.join_requests request
    set
      status = 'cancelled',
      decided_at = coalesce(request.decided_at, now()),
      updated_at = now()
    where request.reservation_id = v_reservation.id
      and request.status in ('pending', 'accepted');

    update public.reservation_waitlist waitlist
    set
      status = 'cancelled',
      resolved_at = coalesce(waitlist.resolved_at, now()),
      updated_at = now()
    where waitlist.reservation_id = v_reservation.id
      and waitlist.status = 'waiting';

    update public.notifications notification
    set read_at = coalesce(notification.read_at, now()), updated_at = now()
    where notification.reservation_id = v_reservation.id
      and notification.read_at is null;

    delete from public.email_notification_outbox outbox
    where outbox.reservation_id = v_reservation.id
      and outbox.status in ('pending', 'failed');

    -- The notification trigger copies each row into the email outbox. The
    -- recipient array was de-duplicated before related records were closed.
    insert into public.notifications (
      user_id,
      reservation_id,
      event_type,
      event_key,
      delivery_status
    )
    select
      recipient.user_id,
      v_reservation.id,
      'reservation_cancellation',
      'blocked_time_cancellation',
      'pending'
    from unnest(coalesce(v_recipient_ids, array[]::uuid[])) recipient(user_id);
  end loop;

  return new;
end;
$function$;

drop trigger if exists cancel_reservations_for_blocked_period
on public.blocked_periods;

create trigger cancel_reservations_for_blocked_period
after insert or update of start_at, end_at
on public.blocked_periods
for each row execute function private.cancel_reservations_for_blocked_period();

revoke all on function private.cancel_reservations_for_blocked_period()
from public, anon, authenticated;

comment on function private.cancel_reservations_for_blocked_period() is
  'Cancels future active reservations overlapping a facility block and queues player cancellation notifications.';

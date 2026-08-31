-- The public join/leave SQL wrappers run as the signed-in caller and therefore
-- need access to their validated security-definer helpers.
grant execute on function private.join_reservation_waitlist(uuid) to authenticated;
grant execute on function private.leave_reservation_waitlist(uuid) to authenticated;

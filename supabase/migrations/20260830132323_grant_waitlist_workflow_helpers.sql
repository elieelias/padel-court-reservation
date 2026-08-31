-- Public SQL wrappers execute with the caller's role, so authenticated users
-- also need permission to reach these security-definer query helpers.
grant execute on function private.list_my_waitlists() to authenticated;
grant execute on function private.list_open_court_waitlist(uuid) to authenticated;

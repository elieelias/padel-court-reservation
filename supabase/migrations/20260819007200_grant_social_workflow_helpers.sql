grant execute on function private.list_player_notifications() to authenticated;
grant execute on function private.mark_notifications_read(uuid[]) to authenticated;
grant execute on function private.list_open_courts() to authenticated;
grant execute on function private.list_open_court_requests() to authenticated;
grant execute on function private.request_open_court_join(uuid) to authenticated;
grant execute on function private.respond_open_court_join(uuid, boolean) to authenticated;

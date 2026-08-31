# Unfriend verification — 2026-08-31

The Friends page has an English/Arabic Unfriend button on accepted friendships.
The confirmation explains that removal is mutual and does not change existing
reservations or invitations. Re-adding requires a new accepted friend request.
Obsolete friend-request notifications are removed by the existing foreign key;
no new unfriend notification is sent.

## Passed

- `unfriend.sql` ran against the linked database inside a rolled-back transaction.
- Both requester and recipient can remove an accepted friendship.
- Both lists lose the connection, and sending a new request creates a pending request.
- Unrelated users, missing identities, and anonymous callers cannot remove friendships.
- Direct table deletion also enforces ownership and accepted status through RLS.
- Pending requests cannot be deleted through Unfriend; repeat removal reports an error.
- Reservations, participants, and invitations match their complete pre-test snapshots.
- Web type checking and lint passed for the changed component and translations.

## Deployment and manual check

Migration `20260831112636_add_unfriend_action.sql` is applied to Supabase.
Deploy the web changes through GitHub/Vercel. No signed-in browser session was
available for testing the rendered button. With two test accounts, cancel the
confirmation first (nothing should change), then confirm removal. Check the other
account after refreshing, verify both friend counts, and send a fresh request.
Also check Arabic and dark mode on a narrow phone screen.

The post-change security advisor reported no new findings. Existing findings concern
[public function access](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
for receipt/username checks and disabled
[leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
These unrelated settings were not changed.

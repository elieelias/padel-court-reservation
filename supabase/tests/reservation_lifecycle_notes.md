# Booking lifecycle

- Pending and confirmed bookings both hold the court time.
- Private: every non-cancelled invitation must be accepted. A declined invitation
  remains unresolved until the host removes or replaces it. Solo bookings confirm.
- New Open Courts: only the host is initially confirmed. Friends receive named
  invitations, and each pending invitation holds one place without counting as accepted.
  Four accepted players are required for confirmation. Declined/cancelled invitations
  release their places, including to the waitlist. Older guest-count bookings are preserved.
- Hosts cannot leave their own booking; they use the reservation cancellation action.
- Removing/leaving an accepted place uses the facility cancellation cutoff.
- Pending invitations can be declined or withdrawn until the booking starts.
- Status is reconciled at transaction commit, after invitation writes and waitlist
  promotion. This avoids sending a temporary pending notification during a refill.
- Existing active future bookings are reconciled without sending retrospective emails.

The SQL regression script runs in a transaction and rolls back all fixtures.

## Verification on 2026-08-31

- Database regression passed for acceptance/decline, replacement invitations, host
  removal, member departure, in-app notification creation, four-player confirmation,
  waitlist refill, cutoff enforcement, and unauthorized access rejection.
- Web and admin type checks, web lint, production build, and nine existing calendar/share
  tests passed.
- The Open Court invitation regression also passed for protected invitation places,
  community joining, acceptance without double-counting, declines with waitlist refill,
  replacements, invited-player departures, and separate invitations for each weekly booking.
- Database migration applied to the connected project. Web changes still need a normal
  GitHub/Vercel deployment. Email sender wording is updated locally but its deployment
  awaits explicit approval; in-app notifications do not depend on that deployment.

## Separate pre-existing advisor findings

The new public actions are invoker wrappers with ownership checks in private helpers.
Supabase still flags existing public receipt-token and username-availability functions
as executable security-definer endpoints. Review those intentional public entry points
separately: [public function access guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
There are also existing [multiple-policy performance warnings](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
and [unused-index notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
No indexes or unrelated security settings were removed or weakened for this feature.

## Remaining product decision

There is no new automatic expiry for incomplete lineups. Decide how long an incomplete
booking may hold a court before implementing an expiry policy; pending currently holds
the time until cancellation, just as requested.

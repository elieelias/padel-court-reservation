# Supabase backend

The migrations in this directory define the reservation backend used by the player website and administrator mobile application.

The Week 3 migration adds guarded administrator functions for:

- listing player accounts and Auth email addresses;
- updating player contact details;
- editing and cancelling reservations;
- confirming cash payments with the database timestamp.

All mobile calls use the publishable key and the authenticated administrator's session. Authorization remains enforced in Postgres through the trusted `profiles.role` column, RLS policies, and administrator checks inside privileged functions.

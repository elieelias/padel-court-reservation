# Padel Court Reservation System

Player web application for a single-court padel facility. The project uses a workspace structure so the administrator mobile app and shared packages can be added without reorganizing the codebase later.

## Structure

- `apps/web` — responsive Next.js player application
- `apps/admin` — React Native and Expo administrator mobile application
- `packages` — reserved for shared types and validation
- `supabase` — reserved for database migrations, functions, and seed data

## Start locally

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. In Supabase Auth, enable phone login and configure an SMS provider.
3. Keep `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=+961` for Lebanese numbers, or change it for the facility's country.
4. Install dependencies with `pnpm install`.
5. Run `pnpm dev`.

## Player authentication

- Sign-up asks only for the player's full name and mobile number.
- Sign-in asks only for the mobile number.
- Both flows verify the player with a six-digit SMS code; there are no passwords.
- The sign-up name is passed as user metadata for profile creation. It must not be used for authorization decisions.

The interface renders a clear setup state when Supabase is not configured; it does not invent live availability or reservation data.

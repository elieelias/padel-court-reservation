# Padel One

Padel One is a reservation system for a single-court padel facility. Players use the Next.js website to book, manage friends, join Open Courts, respond to invitations, and manage waitlists. Administrators use the Expo application to manage the court, payments, players, events, and analytics.

## Project structure

```text
apps/
  web/                         Player website
    src/
      app/                     Next.js route entry points only
      features/                Complete product features
        auth/
        booking/
        events/
        landing/
        notifications/
        open-courts/
        profile/
      lib/                     App-wide configuration and Supabase clients
      shared/                  Reusable UI, layout, and preference providers
      stylesheets/             Website styling
  admin/                       Expo administrator application
    components/                Screen sections and modals
    hooks/                     Screen state and orchestration
    lib/                       Data loading, actions, dates, and shared types
    stylesheets/               Styles grouped by administrator feature
supabase/
  migrations/                  Database schema, security, and workflows
  functions/                   Server-side Edge Functions
  email-templates/             Supabase authentication email templates
packages/                      Reserved for code shared by both applications
```

### How to find website code

Start from the matching folder under `apps/web/src/features`. Each feature keeps its page components, smaller UI components, and feature-only helpers together. Files under `apps/web/src/app` remain intentionally small because Next.js requires routes to live there.

For example, the `/book` route points to `features/booking/pages/book-page.tsx`. The interactive calendar is in `features/booking/components`, while its date and time helpers are in `features/booking/lib`.

## Run locally

1. Install dependencies with `pnpm install`.
2. Add an `apps/web/.env.local` file containing:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_EMAIL_VERIFICATION_CODE_ENABLED=true
   NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=+961
   ```

3. Start the player website with `pnpm dev`.
4. Start the administrator application separately with `pnpm dev:admin`.

## Useful checks

- `pnpm typecheck` — check the player website's TypeScript
- `pnpm lint` — lint the player website
- `pnpm build` — create a production player build
- `pnpm typecheck:admin` — check the administrator application
- `pnpm lint:admin` — lint the administrator application

## Authentication and backend

Players register with a username, full name, phone number, and email address. Supabase sends an email verification code or link according to the project configuration. Authentication, reservation rules, invitations, waitlists, notifications, and administrator permissions are enforced by Supabase migrations and Row Level Security—not by browser code alone.

When changing a reservation workflow, review both the corresponding website feature and the related migration or database function. Never use user metadata or a hidden button as an authorization boundary.

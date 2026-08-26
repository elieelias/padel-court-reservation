# Padel Court Administrator App

React Native and Expo mobile application for court administrators.

## Implemented Week 3 features

- Persistent Supabase mobile sessions using the publishable client key
- Administrator email/password login and logout
- Database-backed administrator role restriction
- Daily dashboard and court schedule
- Chronological reservations with player name, phone number, and email
- Reservation detail, edit, cancellation, and cash-payment actions
- Server-recorded cash payment confirmation timestamps
- Blocked-period creation, listing, and removal
- Player account search and contact-detail management
- Upcoming Open Court roster management, including pending and accepted players
- Persistent notifications when player or administrator accounts are created
- Main-administrator-only administrator account creation through a protected Edge Function
- Reservation discount controls
- Read-only administrator audit history
- Email notification queue for account, friend, and reservation events

## Beginner-friendly code map

Start with these files:

- `app/index.tsx` decides whether to show login, access denied, or the administrator app.
- `components/admin-dashboard.tsx` arranges the main tabs and modals.
- `hooks/use-admin-dashboard.ts` stores screen state and handles user actions.
- `lib/admin-data.ts` loads everything needed by the dashboard.
- `lib/admin-actions.ts` contains every database write made by the dashboard.

Each large feature has its own component:

- `components/schedule-management.tsx` — calendar, schedule, and reservation editing
- `components/payments-panel.tsx` — payment totals and cash confirmation
- `components/facility-management.tsx` — blocked periods, events, and reports
- `components/facility-settings.tsx` — facility information, hours, and pricing
- `components/player-management.tsx` — player list and profile editing
- `components/analytics-panel.tsx` — calculations, metrics, and charts
- `components/audit-history.tsx` — administrator change history

Supporting files:

- `lib/admin-types.ts` contains short names for the database records used by the app.
- `lib/admin-periods.ts` contains date-range calculations for calendars, payments, and analytics.
- `lib/date.ts` contains timezone-aware display and input helpers.
- `lib/database.types.ts` is generated from Supabase. Do not edit it by hand unless the database schema changes.
- `stylesheets/` contains one named stylesheet for each screen or component that needs styling.
- `constants/admin-theme.ts` contains the shared colors, spacing, and layout values used by those stylesheets.

When adding a feature, follow this path:

1. Add the Supabase read to `lib/admin-data.ts` or write to `lib/admin-actions.ts`.
2. Put state and action handling in `hooks/use-admin-dashboard.ts`.
3. Build the feature UI in its own component.
4. Connect that component in `components/admin-dashboard.tsx`.

## Requirements

- Node.js 20.19 or newer
- pnpm
- Expo Go on a physical device, or an iOS/Android simulator

## Start locally

From the repository root:

```bash
cp apps/admin/.env.example apps/admin/.env.local
pnpm install
pnpm dev:admin
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/admin/.env.local`. Never put a secret or service-role key in the mobile application.

Scan the QR code with Expo Go, or press `i` for the iOS simulator / `a` for the Android emulator.

## Checks

```bash
pnpm lint:admin
pnpm typecheck:admin
```

## Manual setup and release work

- Test administrator login and every write action on a physical iOS or Android device.
- Enable leaked-password protection in Supabase Auth settings.
- Confirm the iOS bundle identifier and Android package name before publishing.
- Configure EAS signing credentials and create App Store / Play Store builds.
- Confirm the designated main administrator before transferring production ownership.

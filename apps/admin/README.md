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
- If administrators must disable or delete Auth identities, implement that later through a protected server or Edge Function; privileged Auth administration is intentionally not exposed in this client.

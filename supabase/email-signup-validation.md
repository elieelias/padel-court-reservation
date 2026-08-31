# Email signup validation

## What the implementation does

- Rejects malformed addresses and reserved/example/local domains, including their subdomains.
- Checks public DNS mail routing before the web app requests an email code.
- Recognizes explicit null MX (the domain declares it does not receive mail).
- Supports MX records and the SMTP A/AAAA fallback for legitimate custom domains.
- Returns a retryable error on DNS failures. It does not silently allow registration
  during an outage or incorrectly call the address fake.
- Uses a short, bounded domain-only cache, bounded request bodies and DNS timeouts.
- Never sends an email during validation, probes individual mailboxes, or passes
  full email addresses to a third-party validation provider.
- Keeps the existing OTP/magic-link ownership verification.

`/auth/email-check` is a public preflight check for a helpful form error. It is
not the authoritative gate: a caller can otherwise bypass the form and call
Supabase Auth directly.

The signed `/auth/hooks/before-user-created` endpoint runs the same policy before
Supabase creates a user, **but must be enabled using the steps below**. The endpoint
rejects unsigned, expired, malformed and incorrectly signed requests. A missing
signing secret denies the hook request instead of silently allowing registration.

## Enable the backend gate (required)

1. In Supabase → Authentication → Hooks, prepare a **Before User Created** HTTP hook.
   If a hook already exists, do not overwrite it; integrate the two policies first.
2. Use this production endpoint:
   `https://padel-court-reservation-web.vercel.app/auth/hooks/before-user-created`
3. Generate its signing secret. Put it in Vercel's **Production** environment variables
   as `SUPABASE_BEFORE_USER_CREATED_HOOK_SECRET`. Keep the entire value, including
   `v1,whsec_` if present. This is a server secret: never use a `NEXT_PUBLIC_` prefix,
   commit it, paste it into chat, or reuse a Supabase API key in its place.
4. Push this code and redeploy Vercel with that variable. Keep the hook disabled
   until the deployment is ready. The endpoint must not be behind Vercel deployment
   protection, a password, or a player login; request signatures provide its authentication.
5. Enable/save the hook. Test a new signup with an email you own, and confirm that
   an invalid domain is denied when calling Auth directly as well as through the UI.
   The live hook has not been activated or tested by these code changes alone.

No database migration is needed. These changes do not delete existing accounts,
alter reservations, change SMTP providers, or modify the notification-email sender.
The hook applies to new users, not existing users' email changes or login requests.

## Limits and verification

A valid domain can contain a nonexistent mailbox. Neither syntax nor DNS proves
mailbox existence, ownership, identity, or that delivery will succeed. A person
must still receive and use the code/link. Deliverable temporary mailboxes are not
automatically considered fake, and this is not a maintained disposable-domain list.

Run `pnpm --filter web test:auth` for mocked DNS, preflight and signed-hook tests.
Tests create no Auth users and send no emails. Auth Hooks have a five-second
HTTP budget; DNS is limited to 1.8 seconds. Check live cold-start latency after enabling.

Verified locally on 2026-08-31: all 15 email-validation tests and 12 existing
post-booking tests passed, along with web type checking and lint. The Arabic
registration form rejected `elie@example.com`. Domain-only HTTP checks accepted
Gmail and Outlook and rejected a nonexistent domain; no email was sent. One
initial DNS timeout correctly returned `unavailable`; subsequent checks passed.
The live Supabase hook remains unconfigured and has not been tested end to end.

References:
- [Supabase Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Auth Hook configuration and signature/security model](https://supabase.com/docs/guides/auth/auth-hooks)
- [Null MX](https://www.rfc-editor.org/rfc/rfc7505)
- [SMTP mail routing](https://www.rfc-editor.org/rfc/rfc5321#section-5.1)

# Email verification template

Use `verification-code-and-link.html` for both Supabase authentication templates:

1. Confirm signup
2. Magic link

Recommended subject: `Your Padel Court verification code`

The template includes both `{{ .Token }}` for the eight-digit code and `{{ .ConfirmationURL }}` for the existing one-click flow.

This project is on the Supabase Free plan and was created after June 3, 2026. Supabase therefore requires either a custom SMTP provider or a paid plan before these templates can be customized.

After saving both templates, set this environment variable locally and in Vercel:

```text
NEXT_PUBLIC_EMAIL_VERIFICATION_CODE_ENABLED=true
```

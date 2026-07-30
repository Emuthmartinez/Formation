# 02 — Authentication System

Identity is the first system you build and the last you want to revisit. Default surface is web (Next.js App Router + Supabase Auth). For native mobile, adapt the client pieces and keep Supabase Auth as the backend.

```
Build the authentication system using Next.js 14 App Router and Supabase Auth.

Requirements:
- Email/password registration with email verification
- OAuth login with Google and GitHub
- Protected routes that redirect to login if not authenticated
- User profile creation on first sign-in
- Session management with JWT refresh
- Forgot password flow

Create:
1. Login page (/login) with email/password form and OAuth buttons
2. Register page (/register) with username availability check
3. Auth middleware that protects all /app/* routes
4. useUser() hook that returns the current user from anywhere in the app
5. User profile setup page shown on first login (pick username, add bio)

Design: clean, modern, dark theme. No generic Bootstrap look. Include form
validation with clear error messages.
```

## Skill-integration notes

- OAuth client IDs/secrets and the Supabase service role key are secrets — route them through `SECRETS.md` (`secrets-management.md`), never hardcode. The forgot-password and verification emails route through `resend-email-ops.md`.
- The profile-setup-on-first-login screen is an onboarding surface — run `onboarding-conversion.md`. The username + bio step is also a Commitment moment (`consumer-product-design-agency.md`).
- The "clean, modern, dark theme, no generic Bootstrap look" instruction must reconcile with the Design Room tokens (`design-room.md`, `design-visual-system.md`) — pull the real palette/typography from `state/theme.tokens.json`, don't invent a one-off look.
- Username availability check needs a debounced, rate-limited endpoint — note it as an abuse surface in `SECURITY.md`.
- Add auth events (`sign_up_started`, `sign_up_completed`, `oauth_used`, `profile_setup_completed`) to `ANALYTICS.md` before build.
</content>

## Strings

Every label, headline, button, empty state, and error a user reads comes from `COPY_DECK.md` — author missing rows first (voice from `COPY_BRIEF.md`, craft from `references/conversion-copy.md`), then type the rows into the externalized string resource named in `TECH_SPEC.md`. Example copy in this prompt is voice guidance, not shipping strings; `check:app-copy` gates the result.

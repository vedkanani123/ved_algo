# Gann PRO — secure EA license control

Private control plane for `mt5/GannAngleEA_PRO.mq5`. It issues one-device/one-account licenses, provides an MFA-protected owner dashboard, and validates live terminals through the site API. Strategy Tester is intentionally exempt, so backtests work offline.

## What is protected

- Live terminal starts only after HTTPS authorization from `/api/ea/validate`.
- First valid request atomically binds the licensed account and terminal fingerprint; a copied `.set` file is denied elsewhere.
- Expiry, suspend, and revoke are checked at the next heartbeat (15 minutes by default). Short transport-only grace is 12 hours; an explicit deny has no grace.
- License keys are AES-256-GCM encrypted at rest, never put in browser JavaScript, and are returned only to an owner session with verified TOTP MFA.
- Supabase stores data only. The EA calls your Vercel HTTPS URL; there are no Supabase Edge Functions.
- RLS is enabled and browser roles have no policy/grant to read any `ea_*` licensing records.

## Deploy safely

1. In Supabase Auth, create the single owner account using the email/password you supplied privately. Do not put that password in a file or commit. Disable public sign-ups in Auth settings and enable TOTP MFA.
2. Copy `.env.example` into Vercel environment variables. Set `SUPABASE_SERVICE_ROLE_KEY` only in Vercel (Production + Preview), set `OWNER_EMAIL` to your owner email, and generate `LICENSE_ENCRYPTION_KEY` with `openssl rand -base64 32`.
3. Set `APP_ORIGIN` to your final HTTPS Vercel domain. Deploy, then add that exact origin in Supabase Auth Redirect URLs.
4. In Vercel, turn on Deployment Protection for previews and configure WAF/rate limiting for `POST /api/ea/validate`.
5. Sign in, enroll TOTP, create a license, and download its `.set` file. In MetaTrader 5, add `https://your-domain` to **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** before attaching the EA.

## Local verification

```bash
npm install
npm run typecheck
npm run build
```

Do not commit `.env`, `.set`, `.ex5`, service-role keys, or owner credentials. This public repository contains no secrets.

## Security boundary

An MT5 input or `.set` file cannot be made unreadable to a user who controls their own terminal. This design therefore treats the activation string as a bearer credential and enforces the actual security server-side: account binding, device binding, expiry, nonce replay protection, encrypted-at-rest storage, MFA owner controls, audit logs, and server revocation. Compile the EA to `.ex5` before distribution to raise the reverse-engineering barrier, but do not rely on compilation as access control.

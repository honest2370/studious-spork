# Sellizi v2

A buyer/seller-separated digital marketplace, paid for exclusively via
Ashtech Pay (Mobile Money). Built with Vite + React + TypeScript +
Tailwind v4, backed by Supabase (Postgres + Auth + Edge Functions).

This is a **Phase 1 foundation**, not a full port of every feature from the
old single-file app. It includes: separate buyer/seller login & signup,
role-gated navigation, product browsing, full Ashtech checkout (Mobile
Money + wallet), account-slot inventory products, course curriculum with a
lesson viewer, orders, wallet deposits, and seller withdrawals.

Not yet ported: admin panel, affiliate program, flash sales/bundles,
multi-store, discount-code seller/admin UI (the backend logic exists, no
screen yet), AI features, analytics dashboards, support tickets, the
embeddable widget, Hub/Vault. These are real features from the old app —
flagged here so nothing is silently dropped — and are natural follow-up
passes once this foundation is confirmed stable.

## 1. Supabase setup

1. Create a fresh Supabase project (or reuse an empty one).
2. Run `supabase/schema.sql` in the SQL Editor — this is a complete
   from-scratch schema, role-aware and RLS-correct from the start.
3. Deploy the edge functions in `supabase/functions/`:
   - Via CLI (recommended for this project structure):
     ```
     supabase link --project-ref your-project-ref
     supabase functions deploy ashtech-countries
     supabase functions deploy ashtech-checkout
     supabase functions deploy ashtech-guest-checkout
     supabase functions deploy ashtech-deposit
     supabase functions deploy ashtech-status
     supabase functions deploy wallet-purchase
     supabase functions deploy request-withdrawal
     supabase functions deploy ashtech-webhook --no-verify-jwt
     ```
   - Via Dashboard: each function needs its own copy of
     `_shared/ashtech.ts` pasted in as a file *inside* that function's
     bundle (dashboard deploys don't share files across functions the way
     the CLI does). `ashtech-webhook` specifically needs "Verify JWT"
     turned **off**, since Ashtech calls it server-to-server with no
     Supabase session.
4. Set the `ASHTECH_API_KEY` secret in Project Settings → Edge Functions →
   Secrets.

## 2. Local development

```bash
npm install
cp .env.example .env
# edit .env with your real Supabase URL + anon key
npm run dev
```

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. In Vercel → Project Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   **Never** add `ASHTECH_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` here —
   those belong only in Supabase Edge Function secrets. Anything prefixed
   `VITE_` ships to the browser; anything that shouldn't be public must
   never get that prefix or live in this app's env at all.
4. Deploy. `vercel.json` is already set up to handle client-side routing.

## 4. Security model (carried forward from the old app, hardened further)

- Every function that touches money re-derives price/currency/ownership
  server-side — the client is never trusted with a price.
- Real payment confirmation only ever happens via `ashtech-webhook`
  (server-to-server), never via a client redirect.
- `is_admin()` is a `SECURITY DEFINER` SQL function, not an inline
  subquery — this avoids the infinite-recursion bug that the old app hit
  when admin checks queried the same table their own RLS policy protected.
- `protect_user_columns()` / `protect_access_granted()` triggers lock down
  specific columns RLS can't restrict on its own (row access ≠ column
  access) — checking both `auth.role()` and the raw Postgres session role,
  so the check stays correct across Supabase's key-system migrations.
- `increment_balance()` is execute-revoked from `anon`/`authenticated` —
  only `service_role` (i.e. edge functions) may call it.

## 5. Project structure

```
src/
  lib/
    supabase.ts     — env-based Supabase client (no hardcoded keys)
    ashtech.ts       — payment library: live countries, checkout, deposit, polling
  contexts/
    AuthContext.tsx  — session + role-aware sign in/up
  components/
    ui.tsx           — shared Button/Input/Card/Toast primitives
    BuyerLayout.tsx  — buyer-only bottom nav (Browse/Orders/Courses/Account)
    SellerLayout.tsx — seller-only bottom nav (Dashboard/Products/Orders/Wallet/Account)
    RequireRole.tsx  — route guard enforcing the buyer/seller split
  pages/
    RoleSelect.tsx   — "I'm here to buy" / "I'm here to sell" landing
    auth/            — 4 separate login/signup screens (buyer × seller)
    buyer/           — browsing, checkout, orders, courses, deposit, account
    seller/          — dashboard, product CRUD (+ slots + course builder), orders, wallet
supabase/
  schema.sql         — full fresh-start database schema
  functions/         — all edge functions, Ashtech-only payment flow
```

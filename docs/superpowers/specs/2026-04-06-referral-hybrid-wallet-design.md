# Referral hybrid: PWA + optional Wallet passes

**Status:** Approved direction (2026-04-06)  
**Scope:** Referral-facing experience only (not full client app replacement).

## Goal

Give referral partners a **lightweight way to see balances and history** without requiring a full native app from the store. Use a **hybrid**:

1. **Primary:** mobile-first **web / PWA** (“wallet-style” UI) backed by existing client referral APIs.
2. **Later (optional):** **Apple Wallet / Google Wallet** passes that show a **snapshot** (branding, headline balance, deep link into the web portal).

## Phase A — Referral web / PWA (ship first)

**User flow**

- Sign in with the same credentials model as today (email/password against `client_profiles` / invite flow), or magic link if we add it later.
- Screens aligned with current data: planned / accrued / settled / available, commission lines, settlements (parity with `ReferralScreen` + `GET /api/client/v1/referral/overview`).
- **Installable:** manifest + service worker (optional) so “Add to Home Screen” works; same origin as CRM deploy preferred (e.g. `https://domain.com/referral` or subdomain).

**Technical**

- **Reuse** existing JSON APIs under `/api/client/v1/*` — no duplicate business logic for amounts.
- New **server-rendered or SPA route** under the Next.js app (or dedicated route group) with its own minimal layout (referral-only chrome, no full CRM nav).
- **Auth:** same JWT/session strategy as mobile client app (Bearer tokens); ensure CORS/cookies if web uses cookie instead of SecureStore.

**Success criteria**

- Referral user can use **Safari/Chrome on phone**, see correct totals, refresh, sign out.
- No App Store required for MVP.

## Phase B — Wallet passes (optional)

**Role of the pass**

- **Not** the system of record — **web portal remains authoritative** for detail and disputes.
- Pass shows: agency branding, **one or few headline numbers** (e.g. available balance in default currency), optional QR linking to the portal URL, last updated time.

**Technical (outline)**

- **Apple:** Pass Type ID, certificates, PassKit Web Service URLs for updates, push to update pass when balances change (batch/rate-limited).
- **Google:** Google Wallet API for generic/loyalty objects; similar update semantics.

**Triggers**

- “Add to Wallet” button on Phase A portal after login.
- Backend job or webhook to **notify** pass update when `referral_accrual_line` / settlements change (debounced).

**Success criteria**

- Pass installs; balance updates within an acceptable delay (e.g. hours or on-demand refresh), link opens Phase A.

## Out of scope (for this doc)

- Changing multi-tenant rules for `party` / email (separate decision).
- Store submission of a native Expo app (can coexist; not required for hybrid).

## Dependencies

- Production `EXPO_PUBLIC_API_URL` equivalent for web: same host as deployed Next.js (`NEXT_PUBLIC_*` or relative `/api` calls).
- Existing migrations and referral APIs already in production.

## Open decisions (before implementation)

1. **URL:** path under main domain (`/referral-portal`) vs subdomain (`referral.domain.com`).
2. **Auth transport for web:** Bearer in memory + refresh (like app) vs httpOnly cookie (UX/security tradeoff).
3. **Phase B priority:** only after Phase A is used in production with real referrers.

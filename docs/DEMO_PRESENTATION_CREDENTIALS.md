# Demo Presentation Account

Test profile for presentations — all data is **isolated** from your production. Uses a separate company (`company_id`), so your real data is never mixed or visible when logged in as demo.

## Access

| Field | Value |
|-------|-------|
| **Email** | `demo@travel-cms.presentation` |
| **Password** | `Demo2026!Secure` |
| **Login** | `/login` |

## How to create

From project root (ensure `npm install` was run):

```bash
npm run seed:demo
```

Or with env vars:

```bash
node --env-file=.env.local scripts/seed-demo-presentation.mjs
```

If `--env-file` is not available (older Node), source env first:

```bash
export $(grep -v '^#' .env.local | xargs) && node scripts/seed-demo-presentation.mjs
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

## What is seeded

- **Company:** Demo Presentation
- **User:** Supervisor role (full access)
- **Directory:** 4 clients (persons), 3 suppliers (companies)
- **Orders:** 3 orders (Active, Completed, Active) with services
- **Invoices:** 2 invoices (sent, paid)
- **Payments:** 2 payments
- **Company expenses:** 2 expense invoices (supervisor/finance)
- **Notifications:** System update notification

## Isolation

- Demo uses its own `company_id`.
- RLS and API filter by company — demo user sees only demo data.
- Production users see only production data.
- No shared data between demo and production.

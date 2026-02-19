# Database Migrations

This folder contains SQL migration files for the Travel CMS Supabase database.

## How to Apply a Migration

Migrations are applied **manually** via the Supabase SQL Editor — there is no automated migration runner.

### Steps

1. Open [Supabase Dashboard](https://app.supabase.com) and select your project.
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Open the migration file (e.g. `001_client_app.sql`) and copy its full contents.
5. Paste into the SQL Editor.
6. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
7. Verify there are no errors in the output panel.
8. Check the **Table Editor** to confirm the new tables are visible.

### Order Matters

Apply migrations **in numerical order** — each file may depend on tables created by a previous one.

| File | Description | Status |
|------|-------------|--------|
| `001_client_app.sql` | MyTravelConcierge mobile app tables: `client_profiles`, `commission_ledger`, `commission_payouts`, `concierge_sessions` | ⏳ Pending |

## Naming Convention

```
NNN_short_description.sql
```

- `NNN` — zero-padded sequence number (001, 002, …)
- `short_description` — snake_case summary of what the migration does

## Notes

- **Idempotent:** All statements use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so re-running a migration is safe (no duplicate errors).
- **RLS enabled:** All new tables have Row Level Security enabled. Add policies in follow-up migrations once the auth strategy is confirmed.
- **No Prisma:** This project uses Supabase directly — do not use `prisma migrate` or `prisma db push`.
- **Branch:** All code changes accompanying migrations go to `feature/x`.

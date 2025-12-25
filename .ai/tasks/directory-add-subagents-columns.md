# TASK: Add Missing Optional Columns to subagents Table

**Context:**
API code references columns `commission_scheme`, `commission_tiers`, and `payout_details` in subagents table, but these columns don't exist. Commissions are optional (not required), so adding NULLABLE columns is safe and backward compatible.

**Constraints:**
- Never work on `main` branch (verify current branch first)
- One logical step per commit
- Columns must be optional (NULLABLE) - no NOT NULL constraints
- Migration must be idempotent (safe to re-run)

**Acceptance Criteria:**
1. Migration script adds missing columns to subagents table:
   - `commission_scheme` (enum type: 'revenue', 'profit') - NULLABLE
   - `commission_tiers` (jsonb) - NULLABLE
   - `payout_details` (text) - NULLABLE
2. Migration is idempotent (uses IF NOT EXISTS)
3. Enum type is created if it doesn't exist
4. Existing data is not affected (all columns allow NULL)
5. API code can now successfully insert subagent records with optional commission data

**Smoke Test Steps:**
1. Run migration script in Supabase
2. Verify columns exist: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'subagents'`
3. Test API: Create party with subagent role (with and without commission details)
4. Verify INSERT operations work correctly

---

## EXECUTION PACK FOR DB/SCHEMA AGENT

**COPY-READY PROMPT:**

```
TASK: Create migration to add optional columns to subagents table

Context:
- API code (app/api/directory/[id]/route.ts lines 289-291, app/api/directory/create/route.ts lines 219-221) references:
  - commission_scheme (enum: 'revenue', 'profit')
  - commission_tiers (jsonb)
  - payout_details (text)
- These columns don't exist in subagents table
- Commissions are OPTIONAL (not required), so columns must be NULLABLE
- Adding optional columns is safe (backward compatible, no data loss)

Requirements:
1. Create migration script: migrations/add_subagents_columns.sql
   - Create enum type `commission_scheme` with values 'revenue', 'profit' (if not exists)
   - Add column `commission_scheme` (type: commission_scheme, NULLABLE)
   - Add column `commission_tiers` (type: jsonb, NULLABLE)
   - Add column `payout_details` (type: text, NULLABLE)
   - All operations must be idempotent (use IF NOT EXISTS)

2. Migration must:
   - Be safe to run multiple times (idempotent)
   - Not affect existing data (all columns allow NULL)
   - Create enum type before using it
   - Use appropriate comments for documentation

3. Verify:
   - Columns are added as NULLABLE (no NOT NULL constraint)
   - Enum type is created correctly
   - Existing records are not affected (still valid)

Expected Output:
- migrations/add_subagents_columns.sql with idempotent migration
- All columns are NULLABLE (optional)
- Enum type created if needed
- Migration is safe to run multiple times

SQL Template:
```sql
-- Create enum type if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_scheme') THEN
        CREATE TYPE commission_scheme AS ENUM ('revenue', 'profit');
    END IF;
END $$;

-- Add columns (all optional/NULLABLE)
ALTER TABLE public.subagents 
ADD COLUMN IF NOT EXISTS commission_scheme commission_scheme,
ADD COLUMN IF NOT EXISTS commission_tiers jsonb,
ADD COLUMN IF NOT EXISTS payout_details text;

-- Add comments
COMMENT ON COLUMN public.subagents.commission_scheme IS 'Commission calculation scheme: revenue or profit (optional)';
COMMENT ON COLUMN public.subagents.commission_tiers IS 'Commission tier levels as JSON (optional)';
COMMENT ON COLUMN public.subagents.payout_details IS 'Payout details and instructions (optional)';
```

Commit command:
git add migrations/add_subagents_columns.sql && git commit -m "fix(db): add optional columns to subagents table (commission_scheme, commission_tiers, payout_details)"
```

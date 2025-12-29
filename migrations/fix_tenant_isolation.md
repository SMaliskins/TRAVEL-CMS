# Tenant Isolation Fix for Directory Party Creation

## Problem

API fails with FK constraint error:
```
company_id violates foreign key constraint "party_company_id_fkey"
```

## Root Cause Analysis

### Current API Logic (Correct)
The API route (`app/api/directory/create/route.ts`) correctly:
1. ✅ Queries `profiles` table to get `company_id` (lines 79-91)
2. ✅ Validates that profile exists and has `company_id`
3. ✅ Uses `profile.company_id` for party creation

### Schema Issues

Based on verification queries, the issue is likely one of these:

1. **Missing FK Constraint**: `party.company_id` column exists but FK constraint not created
2. **Missing Company Data**: No companies exist in `companies` table
3. **Invalid Profile Data**: User's profile has `company_id` that doesn't exist in `companies` table
4. **Migration Not Applied**: `directory_schema_migration.sql` not fully executed

## Verification Steps

### Step 1: Run Verification Queries

Execute `verify_tenant_isolation.sql` in Supabase SQL Editor to get diagnosis.

### Step 2: Check Results

Look at the "Diagnosis Summary" query results:
- If `party_has_company_id_fk = 0`: FK constraint missing
- If `companies_count = 0`: No companies exist
- If `profiles_with_invalid_company_id > 0`: Profile has invalid company_id

## Solutions

### Solution 1: Add Missing FK Constraint

If FK constraint is missing, run this:

```sql
-- Add FK constraint to party.company_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'party'
        AND kcu.column_name = 'company_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.party
        ADD CONSTRAINT party_company_id_fkey
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id);
    END IF;
END $$;
```

### Solution 2: Create Default Company

If no companies exist, create one:

```sql
-- Create default company (if none exists)
INSERT INTO public.companies (id, name)
SELECT 
    gen_random_uuid(),
    'Default Company'
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- Get the company ID
SELECT id, name FROM public.companies LIMIT 1;
```

Then assign all users to this company:

```sql
-- Update profiles to use default company (if company_id is NULL or invalid)
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE company_id IS NULL 
   OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = profiles.company_id);
```

### Solution 3: Fix Invalid Company IDs

If profiles have invalid company_id:

```sql
-- Find profiles with invalid company_id
SELECT p.user_id, p.company_id
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM companies WHERE id = p.company_id
);

-- Fix by assigning to first available company (or create default)
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM companies WHERE id = profiles.company_id
);
```

## Complete Setup Script

If you need to set up tenant isolation from scratch:

```sql
-- Step 1: Ensure companies table exists and has at least one company
DO $$
DECLARE
    default_company_id uuid;
BEGIN
    -- Create default company if none exists
    IF NOT EXISTS (SELECT 1 FROM public.companies) THEN
        INSERT INTO public.companies (name)
        VALUES ('Default Company')
        RETURNING id INTO default_company_id;
    ELSE
        SELECT id INTO default_company_id FROM public.companies LIMIT 1;
    END IF;

    -- Step 2: Ensure all profiles have valid company_id
    UPDATE public.profiles
    SET company_id = default_company_id
    WHERE company_id IS NULL 
       OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = profiles.company_id);

    -- Step 3: Ensure party.company_id has FK constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'party'
        AND kcu.column_name = 'company_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.party
        ADD CONSTRAINT party_company_id_fkey
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id);
    END IF;
END $$;
```

## API Route Status

✅ **API Route is Correct** - No changes needed in `app/api/directory/create/route.ts`

The API already:
- Queries profiles table correctly
- Validates company_id exists
- Uses proper tenant isolation

The issue is in the database schema/data, not the API code.

## Recommendations

### Immediate Fix
1. Run `verify_tenant_isolation.sql` to diagnose
2. Run appropriate solution script above
3. Re-test API endpoint

### Long-term Setup
1. **Ensure migrations run**: Apply `directory_schema_migration.sql` completely
2. **Bootstrap data**: Create initial company during setup
3. **User onboarding**: Assign users to companies when profiles are created
4. **Data validation**: Add checks to prevent invalid company_id in profiles

### Best Practices

**For Development:**
- Create a default company during initial setup
- Auto-assign new users to default company

**For Production:**
- Proper user onboarding flow that assigns company_id
- Validate company_id when creating profiles
- Use triggers or application logic to ensure data integrity

## Verification After Fix

After applying fixes, verify:

```sql
-- Should return 1 (FK exists)
SELECT COUNT(*) FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
AND tc.table_name = 'party'
AND kcu.column_name = 'company_id'
AND tc.constraint_type = 'FOREIGN KEY';

-- Should return 0 (no invalid company_ids)
SELECT COUNT(*) FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
WHERE c.id IS NULL;

-- Should return >= 1 (at least one company exists)
SELECT COUNT(*) FROM companies;
```

## Files Reference

- **Verification**: `migrations/verify_tenant_isolation.sql`
- **Schema Migration**: `migrations/directory_schema_migration.sql`
- **API Route**: `app/api/directory/create/route.ts` (lines 79-91)


# Quick Fix Guide: Missing Profile or Company_ID

## Problem

API error: `"User profile not found or company_id missing"`

## Quick Solution (Choose One)

### Option 1: Complete Setup (Recommended)
```sql
-- Run in Supabase SQL Editor:
-- File: migrations/setup_default_tenant.sql
```
**What it does:**
- Creates default company
- Creates profiles for ALL users
- Fixes invalid company_ids
- ✅ Safe to run multiple times

### Option 2: Quick Fix
```sql
-- Run in Supabase SQL Editor:
-- File: migrations/fix_missing_profiles.sql
```
**What it does:**
- Creates default company if missing
- Creates profiles only for users missing them
- Fixes invalid company_ids

### Option 3: Diagnose First
```sql
-- Run in Supabase SQL Editor:
-- File: migrations/diagnose_profile_issue.sql
```
**What it does:**
- Shows current state
- Identifies exact problem
- Then choose appropriate fix above

## Expected Results

After running fix script:
- ✅ At least 1 company exists
- ✅ All users have profiles
- ✅ All profiles have valid company_id
- ✅ API can create party records

## Verification

```sql
-- Quick check (should return 0):
SELECT COUNT(*) FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;

-- Should return >= 1:
SELECT COUNT(*) FROM companies;
```

## Files

- `diagnose_profile_issue.sql` - Diagnostic queries
- `setup_default_tenant.sql` - Complete setup (recommended)
- `fix_missing_profiles.sql` - Quick fix
- `PROFILE_ISSUE_DIAGNOSIS_REPORT.md` - Full documentation






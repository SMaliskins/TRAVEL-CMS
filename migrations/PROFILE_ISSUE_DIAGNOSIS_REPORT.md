# Profile and Company_ID Issue Diagnosis Report

## Problem Statement

**Error**: `"User profile not found or company_id missing. Please contact administrator."`

**Root Cause**: User attempting to create Directory party doesn't have:
1. A profile in `profiles` table, OR
2. Profile exists but `company_id` is NULL/invalid

---

## Schema Structure

### Companies Table DDL

```sql
CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

**Key Points:**
- Simple table with `id` (UUID) and `name` (text)
- No constraints on uniqueness of name
- Created during initial setup

### Profiles Table DDL

```sql
CREATE TABLE profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    role text NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor')),
    initials text,
    display_name text,
    created_at timestamptz DEFAULT now()
);
```

**Key Points:**
- `user_id` is PRIMARY KEY and FK to `auth.users(id)`
- `company_id` is NOT NULL and FK to `companies(id)`
- One-to-one relationship: one profile per user
- User must belong to exactly one company

**FK Constraints:**
- ✅ `profiles.user_id` → `auth.users(id)` (CASCADE on delete)
- ✅ `profiles.company_id` → `companies(id)` (RESTRICT on delete)

---

## Diagnosis Steps

### Step 1: Run Diagnostic Queries

Execute `diagnose_profile_issue.sql` to check:

1. **Tables exist?** ✅ Should show: companies and profiles tables exist
2. **FK constraints?** ✅ Should show: both FK constraints exist
3. **Companies data?** ⚠️ Check if any companies exist
4. **User profiles?** ⚠️ Check if current user has profile
5. **Company_ID validity?** ⚠️ Check if company_id references valid company

### Step 2: Check Summary Counts

From query #7 in diagnostic script:
- `total_auth_users`: Number of users in auth.users
- `total_profiles`: Number of profiles (should match auth_users)
- `users_without_profile`: Should be 0
- `profiles_without_company_id`: Should be 0 (FK constraint prevents NULL)
- `profiles_with_invalid_company_id`: Should be 0
- `companies_count`: Should be >= 1

---

## Common Issues & Solutions

### Issue 1: No Companies Exist

**Symptom**: `companies_count = 0`

**Impact**: Cannot create profiles (FK constraint requires valid company_id)

**Solution**: 
```sql
-- Run: setup_default_tenant.sql (creates default company)
-- OR manually:
INSERT INTO companies (name) VALUES ('Default Company');
```

### Issue 2: User Has No Profile

**Symptom**: `users_without_profile > 0`

**Impact**: API fails because it can't find user's profile

**Solution**: 
```sql
-- Run: fix_missing_profiles.sql (creates profiles for all users)
-- OR manually:
INSERT INTO profiles (user_id, company_id, role)
VALUES (
    'USER_ID_HERE',
    (SELECT id FROM companies LIMIT 1),
    'agent'
);
```

### Issue 3: Profile Exists But Company_ID is Invalid

**Symptom**: `profiles_with_invalid_company_id > 0`

**Impact**: FK constraint violation when API tries to use it

**Solution**:
```sql
-- Run: fix_missing_profiles.sql (fixes invalid company_ids)
-- OR manually:
UPDATE profiles
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM companies WHERE id = profiles.company_id
);
```

---

## Recommended Solutions

### Solution A: Complete Tenant Setup (RECOMMENDED for Development)

**Use**: `setup_default_tenant.sql`

**What it does:**
1. Creates default company if missing
2. Creates profiles for all users without profiles
3. Fixes any invalid company_ids
4. Fully idempotent

**When to use:**
- Initial development setup
- After importing users
- When setting up staging environment
- When you want complete tenant isolation

### Solution B: Quick Fix (For Immediate Issue)

**Use**: `fix_missing_profiles.sql`

**What it does:**
1. Creates default company if missing
2. Creates profiles only for users missing them
3. Fixes invalid company_ids

**When to use:**
- Quick fix for specific issue
- When you know which users need profiles
- Production hotfix (with caution)

---

## API Route Analysis

**File**: `app/api/directory/create/route.ts`

### Current Implementation (Lines 79-91)

```typescript
// Get company_id from profiles table (for tenant isolation)
const { data: profile, error: profileError } = await supabaseAdmin
  .from("profiles")
  .select("company_id")
  .eq("user_id", user.id)
  .single();

if (profileError || !profile?.company_id) {
  return NextResponse.json(
    { error: "User profile not found or company_id missing. Please contact administrator." },
    { status: 403 }
  );
}
```

**Status**: ✅ API logic is correct and secure

**Behavior**:
- Queries profiles table for current user
- Validates profile exists
- Validates company_id exists
- Returns clear error if either is missing

**Recommendation**: ✅ **No API changes needed** - this is the correct approach

---

## Best Practices

### Development Setup

1. **Run `setup_default_tenant.sql`** after creating auth users
2. **Auto-create profiles** when users sign up (via trigger or application logic)
3. **Assign to default company** for new users

### Production Setup

1. **Proper onboarding flow** that creates profiles with correct company_id
2. **Company management** - users assigned to correct companies
3. **Validation** - ensure profiles exist before allowing Directory operations

### Alternative: Auto-Create Profile in API (Not Recommended)

**Option**: API could auto-create profile if missing

**Why NOT recommended:**
- Breaks tenant isolation (what company_id to use?)
- Security risk (users could create profiles for wrong company)
- Better to have explicit profile creation in onboarding flow

---

## Fix Scripts Summary

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `diagnose_profile_issue.sql` | Diagnostic queries | **First** - to identify problem |
| `setup_default_tenant.sql` | Complete tenant setup | Development/staging initial setup |
| `fix_missing_profiles.sql` | Quick fix missing profiles | Specific issue fix |

---

## Execution Order

### For New Setup:
1. Run `setup_default_tenant.sql` - Complete tenant isolation setup
2. Verify: Check that all users have profiles with valid company_id

### For Existing Setup with Issues:
1. Run `diagnose_profile_issue.sql` - Identify problems
2. Run `fix_missing_profiles.sql` - Fix missing profiles
3. Verify: Re-run diagnostic queries to confirm fix

### For Production:
1. Review diagnostic results
2. Manually create appropriate companies
3. Manually assign users to correct companies via profiles
4. Or run fix script with proper company assignment

---

## Verification After Fix

### Quick Check:
```sql
-- Should return 0 (all users have profiles)
SELECT COUNT(*) FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;

-- Should return 0 (all profiles have valid company_id)
SELECT COUNT(*) FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
WHERE c.id IS NULL;

-- Should return >= 1 (at least one company exists)
SELECT COUNT(*) FROM companies;
```

### Detailed Check:
```sql
-- List all users and their profile status
SELECT 
    au.email,
    CASE WHEN p.user_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_profile,
    c.name as company_name,
    CASE 
        WHEN p.user_id IS NULL THEN 'MISSING PROFILE'
        WHEN p.company_id IS NULL THEN 'MISSING company_id'
        WHEN c.id IS NULL THEN 'INVALID company_id'
        ELSE 'OK'
    END as status
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
LEFT JOIN companies c ON c.id = p.company_id;
```

---

## Files Reference

1. **`diagnose_profile_issue.sql`** - Comprehensive diagnostic queries
2. **`fix_missing_profiles.sql`** - Quick fix for missing profiles
3. **`setup_default_tenant.sql`** - Complete tenant setup (recommended)
4. **`PROFILE_ISSUE_DIAGNOSIS_REPORT.md`** - This report

---

## Summary

**Problem**: User missing profile or company_id

**API Status**: ✅ Correct - no code changes needed

**Root Cause**: 
- Users exist in `auth.users` but no corresponding profile in `profiles`
- OR profiles exist but company_id is invalid/NULL

**Solution**: 
- **Development**: Run `setup_default_tenant.sql`
- **Quick Fix**: Run `fix_missing_profiles.sql`
- **Diagnosis**: Run `diagnose_profile_issue.sql` first

**Verification**: Use diagnostic queries to confirm all users have valid profiles

---

## Message for Architect Agent

**Issue Diagnosed**: Missing user profiles or invalid company_id causing Directory party creation to fail.

**API Route**: ✅ Correct - properly queries profiles table and validates company_id.

**Root Cause**: Users exist in auth.users but missing profiles, or profiles have invalid company_id.

**Solution**: Provided 3 scripts - diagnostic, quick fix, and complete setup.

**Recommendation**: Use `setup_default_tenant.sql` for development, proper onboarding for production.

**Status**: Ready for execution - all scripts are idempotent and safe.


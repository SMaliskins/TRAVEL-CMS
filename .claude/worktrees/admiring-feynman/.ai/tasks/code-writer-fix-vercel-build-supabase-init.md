# CODE WRITER TASK: Fix Vercel Build — Supabase Initialization Error

**Created:** 2026-01-05  
**Priority:** CRITICAL (blocks deployment)  
**Requested by:** SM  

---

## Problem

Vercel build fails with error:
```
Error: supabaseUrl is required.
at /api/orders/create/route.ts
```

Build compiles TypeScript successfully, but fails at "Collecting page data" stage.

---

## Root Cause

In `/app/api/orders/create/route.ts` (lines 6-9), Supabase client is created **directly in module scope** with non-null assertion (`!`):

```typescript
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

Problem: During Vercel build, environment variables are **not available** at build time (only at runtime). The `!` assertion fails because the values are `undefined`.

---

## Solution

Replace the inline Supabase client creation with import from `lib/supabaseAdmin.ts`, which already handles this correctly with a fallback:

```typescript
// lib/supabaseAdmin.ts already has:
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build";
```

---

## Changes Required

**File:** `app/api/orders/create/route.ts`

1. **Remove** lines 6-10 (inline supabaseAdmin creation)
2. **Remove** lines 12-13 (unused supabaseUrl and supabaseAnonKey variables)
3. **Add** import: `import { supabaseAdmin } from "@/lib/supabaseAdmin";`

---

## Before (current code):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrdersColumns, resolveOrderInsertPayload } from "@/lib/orders/resolveOrderColumns";

// Create Supabase admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
```

## After (fixed code):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getOrdersColumns, resolveOrderInsertPayload } from "@/lib/orders/resolveOrderColumns";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
```

---

## Verification

After fix, run:
```bash
npm run build
```

Build should pass "Collecting page data" stage without `supabaseUrl is required` error.

---

## Smoke Test

- [ ] `npm run build` completes successfully
- [ ] No "supabaseUrl is required" error
- [ ] Vercel deployment succeeds
- [ ] `/api/orders/create` endpoint works in production


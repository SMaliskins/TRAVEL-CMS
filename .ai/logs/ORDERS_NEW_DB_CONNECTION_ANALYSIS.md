# Orders New Page - Database Connection Analysis

**Date:** 2025-12-25  
**Page:** `/orders/new`  
**Status:** ✅ Analysis Complete

---

## 🔍 Database Connection Points

### 1. Client-Side (Page Component)

**File:** `app/orders/new/page.tsx`

#### Connection Points:

1. **Supabase Client Import (line 5):**
   ```typescript
   import { supabase } from "@/lib/supabaseClient";
   ```
   ✅ **Status:** Imported correctly

2. **User Authentication Check (lines 76-91):**
   ```typescript
   useEffect(() => {
     const fetchUser = async () => {
       const { data } = await supabase.auth.getUser();
       // ...
     };
     fetchUser();
   }, []);
   ```
   ✅ **Status:** Uses Supabase auth - should work if configured

3. **Session Token Retrieval (lines 151-152):**
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   const accessToken = session?.access_token || null;
   ```
   ✅ **Status:** Gets session token for API calls

4. **API Call to Create Order (lines 155-173):**
   ```typescript
   const response = await fetch("/api/orders/create", {
     method: "POST",
     headers: { 
       "Content-Type": "application/json",
       ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {})
     },
     body: JSON.stringify({...}),
   });
   ```
   ✅ **Status:** Calls API endpoint with auth token

---

### 2. Server-Side (API Endpoint)

**File:** `app/api/orders/create/route.ts`

#### Connection Points:

1. **Supabase Admin Client (lines 1-12):**
   ```typescript
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
   
   const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
     auth: { persistSession: false }
   });
   ```
   ⚠️ **Status:** Uses environment variables - need to verify they are set

2. **Database Queries:**
   - `getCompanyId()` (lines 28-39): Queries `profiles` table
   - `generateOrderNumber()` (lines 42+): Queries `orders` table
   - Order creation: Inserts into `orders` table

---

### 3. Components Used on Page

#### PartySelect Component

**Location:** `components/PartySelect` (imported line 8)

This component likely loads directory data from database via API:
- Probably calls `/api/directory` endpoint
- Needs database connection to load party/client data

---

## ✅ Connection Status Summary

### Client-Side:
- ✅ Supabase client imported (`@/lib/supabaseClient`)
- ✅ Auth methods used (`getUser`, `getSession`)
- ✅ API calls include auth token
- ✅ PartySelect uses `/api/directory` endpoint (not direct DB access)
- ⚠️ **Need to verify:** Environment variables set

### Server-Side:
- ✅ Supabase admin client created
- ✅ Database queries present (profiles, orders tables)
- ⚠️ **CRITICAL ISSUE FOUND:** Line 75 uses `from("parties")` but table is `party` (singular)
- ⚠️ **Need to verify:** Environment variables set (SUPABASE_SERVICE_ROLE_KEY)

### API Endpoints Used:
1. `/api/directory` - Used by PartySelect component (line 54)
2. `/api/orders/create` - Used to create new order (line 155)

---

## 🔍 Verification Steps

### Step 1: Check Environment Variables

**Required Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

**Check in:**
- `.env.local` (local development)
- Vercel Dashboard → Settings → Environment Variables (production)

### Step 2: Check Supabase Client Configuration

**File:** `lib/supabaseClient.ts`

Verify it exports `supabase` client correctly.

### Step 3: Test Database Connection

**Check browser console (F12):**
- Any errors when page loads?
- Any errors when submitting form?
- Network tab: Check API calls status

**Check server logs:**
- Any errors in terminal (`npm run dev`)?
- Database connection errors?

### Step 4: Test API Endpoint

**Test manually:**
```bash
curl -X POST http://localhost:3000/api/orders/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "clientPartyId": "test-id",
    "orderType": "TA",
    "ownerAgent": "SM",
    "cities": [],
    "countries": [],
    "checkIn": null,
    "return": null,
    "status": "Active"
  }'
```

---

## 🎯 Potential Issues

### ⚠️ Issue 1: WRONG TABLE NAME (CRITICAL)
**Location:** `app/api/orders/create/route.ts` line 75
**Problem:** 
```typescript
.from("parties")  // ❌ WRONG - table is "party" (singular)
```
**Should be:**
```typescript
.from("party")  // ✅ CORRECT
```
**Impact:** `getClientDisplayName()` function will fail with "relation 'parties' does not exist"

### Issue 2: Environment Variables Not Set
**Symptom:** API calls fail, errors about "placeholder" URLs
**Fix:** Set environment variables

### Issue 3: Database Tables Don't Exist
**Symptom:** API errors about tables not found
**Fix:** Run migrations to create tables

### Issue 4: RLS Policies Blocking
**Symptom:** API works but returns empty results
**Fix:** Check RLS policies on `orders`, `profiles`, `party` tables

### Issue 5: Authentication Issues
**Symptom:** 401 Unauthorized errors
**Fix:** Check user session, auth token validity

---

## 📋 Quick Diagnostic Checklist

- [ ] Environment variables set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Supabase client initialized correctly
- [ ] User can authenticate (login works)
- [ ] API endpoint `/api/orders/create` exists and accessible
- [ ] Database tables exist (`orders`, `profiles`, `party`, `client_party`)
- [ ] RLS policies allow access
- [ ] No errors in browser console
- [ ] No errors in server logs

---

## 🔧 Next Steps

1. **Check Environment Variables:**
   ```bash
   # In terminal
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   # (Service key won't show - it's server-side only)
   ```

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for errors when loading `/orders/new`

3. **Check Network Tab:**
   - Open DevTools → Network
   - Try creating an order
   - Check status of `/api/orders/create` request

4. **Check Server Logs:**
   - Terminal where `npm run dev` is running
   - Look for database connection errors

---

**Status:** ⏳ **Need verification** - Check environment variables and test connection


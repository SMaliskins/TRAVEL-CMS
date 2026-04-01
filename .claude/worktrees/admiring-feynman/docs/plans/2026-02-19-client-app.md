# MyTravelConcierge Client App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Добавить к существующей Travel CRM мобильное приложение для клиентов (React Native/Expo) с backend API, аутентификацией, просмотром поездок, документов и AI Concierge.

**Architecture:** Backend — новые API routes `/api/client/v1/*` в существующем Next.js 16 + Supabase проекте. Мобильное приложение — отдельный Expo проект в папке `Client/`. Авторизация — JWT (jose) + Refresh Token (Expo SecureStore). AI Concierge — Claude Sonnet через `@anthropic-ai/sdk` уже установленный в проекте.

**Tech Stack:**
- Backend: Next.js 16, Supabase (supabaseAdmin из `lib/supabaseAdmin.ts`), jose (JWT), bcryptjs, stripe, @anthropic-ai/sdk
- Mobile: React Native 0.74 + Expo SDK 51, Zustand, TanStack Query v5, Axios
- Auth: JWT 15min (jose) + Refresh Token 30 дней (Expo SecureStore)
- Важно: проект НЕ использует Prisma — только Supabase!

**Ключевые пути (без src/ — проект не имеет src папки):**
- API routes: `app/api/client/v1/`
- Lib utilities: `lib/client-auth/`, `lib/commission/`
- Mobile app: `Client/` (не `mobile/`)
- Supabase admin: уже есть в `lib/supabaseAdmin.ts`

---

## ФАЗА 1: MVP — Backend

---

### Task 1: SQL Migration — новые таблицы в Supabase

**Files:**
- Create: `docs/migrations/001_client_app.sql`

**Step 1: Написать SQL миграцию**

```sql
-- docs/migrations/001_client_app.sql
-- Run this in Supabase SQL Editor

-- ClientProfile: профиль клиента в мобильном приложении
CREATE TABLE IF NOT EXISTS client_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_client_id       UUID NOT NULL UNIQUE,  -- FK to parties table
  password_hash       TEXT NOT NULL,
  refresh_token_hash  TEXT,
  avatar_url          TEXT,
  notification_token  TEXT,
  invited_by_agent_id UUID,  -- FK to profiles (agent who invited)
  referral_code       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ
);

-- CommissionLedger: записи начисленных комиссий
CREATE TABLE IF NOT EXISTS commission_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL,
  agent_profile_id  UUID NOT NULL REFERENCES client_profiles(id),
  level             INT NOT NULL CHECK (level IN (1, 2, 3)),
  gross_margin      DECIMAL(12,2) NOT NULL,
  commission_rate   DECIMAL(5,4) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAYABLE','PAID')),
  payout_id         UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CommissionPayout: выплаты агентам
CREATE TABLE IF NOT EXISTS commission_payouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES client_profiles(id),
  total_amount     DECIMAL(12,2) NOT NULL,
  invoice_number   TEXT,
  payment_method   TEXT NOT NULL DEFAULT 'BANK_TRANSFER' CHECK (payment_method IN ('BANK_TRANSFER','INVOICE','AUTO')),
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','PAID')),
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK from commission_ledger to commission_payouts
ALTER TABLE commission_ledger
  ADD CONSTRAINT fk_commission_payout
  FOREIGN KEY (payout_id) REFERENCES commission_payouts(id);

-- Indexes
CREATE INDEX idx_client_profiles_crm_client_id ON client_profiles(crm_client_id);
CREATE INDEX idx_client_profiles_referral_code ON client_profiles(referral_code);
CREATE INDEX idx_commission_ledger_booking_id ON commission_ledger(booking_id);
CREATE INDEX idx_commission_ledger_agent_profile_id ON commission_ledger(agent_profile_id);
CREATE INDEX idx_commission_ledger_status ON commission_ledger(status);
CREATE INDEX idx_commission_payouts_agent_profile_id ON commission_payouts(agent_profile_id);

-- ConciergeSession: история чатов AI Concierge
CREATE TABLE IF NOT EXISTS concierge_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES client_profiles(id),
  messages        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Step 2: Применить миграцию**

Открыть Supabase Dashboard → SQL Editor → вставить содержимое файла → Run.

**Step 3: Проверить таблицы**

В Supabase Dashboard → Table Editor убедиться что появились: `client_profiles`, `commission_ledger`, `commission_payouts`, `concierge_sessions`.

**Step 4: Commit**

```bash
git add docs/migrations/001_client_app.sql
git commit -m "feat(client-app): add SQL migration for client app tables"
```

---

### Task 2: JWT helpers для клиентской авторизации

**Files:**
- Create: `lib/client-auth/jwt.ts`
- Create: `lib/client-auth/middleware.ts`

**Step 1: Написать JWT helpers**

```typescript
// lib/client-auth/jwt.ts
import { SignJWT, jwtVerify } from 'jose'
import crypto from 'crypto'

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.CLIENT_JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production'
)
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.CLIENT_JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production'
)
const INVITATION_SECRET = new TextEncoder().encode(
  process.env.CLIENT_JWT_INVITATION_SECRET || 'dev-invitation-secret-change-in-production'
)

export interface ClientTokenPayload {
  clientId: string
  crmClientId: string
  sub: string
}

export async function signAccessToken(payload: ClientTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(ACCESS_SECRET)
}

export async function signRefreshToken(payload: ClientTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(REFRESH_SECRET)
}

export async function signInvitationToken(crmClientId: string, agentId: string): Promise<string> {
  return new SignJWT({ crmClientId, agentId, type: 'invitation' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(INVITATION_SECRET)
}

export async function verifyAccessToken(token: string): Promise<ClientTokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET)
  return payload as unknown as ClientTokenPayload
}

export async function verifyRefreshToken(token: string): Promise<ClientTokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET)
  return payload as unknown as ClientTokenPayload
}

export async function verifyInvitationToken(token: string) {
  const { payload } = await jwtVerify(token, INVITATION_SECRET)
  return payload as { crmClientId: string; agentId: string; type: string }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
```

**Step 2: Написать auth middleware**

```typescript
// lib/client-auth/middleware.ts
import { NextRequest } from 'next/server'
import { verifyAccessToken, ClientTokenPayload } from './jwt'

export async function getAuthenticatedClient(req: NextRequest): Promise<ClientTokenPayload> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED')
  }
  const token = authHeader.split(' ')[1]
  try {
    return await verifyAccessToken(token)
  } catch {
    throw new Error('UNAUTHORIZED')
  }
}

export function unauthorizedResponse() {
  return Response.json({ data: null, error: 'Unauthorized' }, { status: 401 })
}
```

**Step 3: Commit**

```bash
git add lib/client-auth/
git commit -m "feat(client-app): add JWT helpers and auth middleware for client API"
```

---

### Task 3: POST /api/client/v1/auth/register

**Files:**
- Create: `app/api/client/v1/auth/register/route.ts`

**Step 1: Написать endpoint регистрации по invitation token**

```typescript
// app/api/client/v1/auth/register/route.ts
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  verifyInvitationToken,
  signAccessToken,
  signRefreshToken,
  hashToken,
} from '@/lib/client-auth/jwt'
import { z } from 'zod'

// zod не установлен — используем ручную валидацию
function validateBody(body: unknown): { invitationToken: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const { invitationToken, password } = body as Record<string, unknown>
  if (typeof invitationToken !== 'string' || typeof password !== 'string') return null
  if (password.length < 8) return null
  return { invitationToken, password }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = validateBody(body)
    if (!input) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Verify invitation token
    let invitation: { crmClientId: string; agentId: string; type: string }
    try {
      invitation = await verifyInvitationToken(input.invitationToken)
    } catch {
      return Response.json({ data: null, error: 'Invalid or expired invitation token' }, { status: 400 })
    }

    if (invitation.type !== 'invitation') {
      return Response.json({ data: null, error: 'Invalid token type' }, { status: 400 })
    }

    // Check if already registered
    const { data: existing } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('crm_client_id', invitation.crmClientId)
      .single()

    if (existing) {
      return Response.json({ data: null, error: 'Client already registered' }, { status: 409 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12)

    // Create refresh token
    const refreshToken = crypto.randomUUID()
    const refreshTokenHash = hashToken(refreshToken)

    // Create client profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('client_profiles')
      .insert({
        crm_client_id: invitation.crmClientId,
        password_hash: passwordHash,
        refresh_token_hash: refreshTokenHash,
        invited_by_agent_id: invitation.agentId,
      })
      .select()
      .single()

    if (profileError || !profile) {
      console.error('Failed to create client profile:', profileError)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    // Issue tokens
    const tokenPayload = { clientId: profile.id, crmClientId: profile.crm_client_id, sub: profile.id }
    const [accessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ])

    // Store new refresh token hash
    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: hashToken(newRefreshToken), last_login_at: new Date().toISOString() })
      .eq('id', profile.id)

    return Response.json({
      data: { accessToken, refreshToken: newRefreshToken, clientId: profile.id },
      error: null,
    }, { status: 201 })
  } catch (err) {
    console.error('Register error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

**Step 2: Проверить что файл создан корректно (linter)**

В IDE убедиться что нет TypeScript ошибок.

**Step 3: Commit**

```bash
git add app/api/client/v1/auth/register/route.ts
git commit -m "feat(client-app): add POST /api/client/v1/auth/register"
```

---

### Task 4: POST /api/client/v1/auth/login + refresh + logout

**Files:**
- Create: `app/api/client/v1/auth/login/route.ts`
- Create: `app/api/client/v1/auth/refresh/route.ts`
- Create: `app/api/client/v1/auth/logout/route.ts`

**Step 1: Login endpoint**

```typescript
// app/api/client/v1/auth/login/route.ts
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { signAccessToken, signRefreshToken, hashToken } from '@/lib/client-auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Find client by email in CRM (parties table)
    const { data: party } = await supabaseAdmin
      .from('parties')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!party) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

    // Find client profile
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, password_hash')
      .eq('crm_client_id', party.id)
      .single()

    if (!profile) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, profile.password_hash)
    if (!valid) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

    // Issue tokens
    const tokenPayload = { clientId: profile.id, crmClientId: profile.crm_client_id, sub: profile.id }
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ])

    // Store refresh token hash + update last login
    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: hashToken(refreshToken), last_login_at: new Date().toISOString() })
      .eq('id', profile.id)

    return Response.json({ data: { accessToken, refreshToken, clientId: profile.id }, error: null })
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

**Step 2: Refresh token endpoint**

```typescript
// app/api/client/v1/auth/refresh/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyRefreshToken, signAccessToken, signRefreshToken, hashToken } from '@/lib/client-auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json()
    if (!refreshToken) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Verify JWT signature
    let payload: { clientId: string; crmClientId: string; sub: string }
    try {
      payload = await verifyRefreshToken(refreshToken)
    } catch {
      return Response.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Verify token hash matches DB (rotation check)
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, refresh_token_hash')
      .eq('id', payload.clientId)
      .single()

    if (!profile || profile.refresh_token_hash !== hashToken(refreshToken)) {
      return Response.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Issue new token pair (rotation)
    const tokenPayload = { clientId: profile.id, crmClientId: profile.crm_client_id, sub: profile.id }
    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ])

    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: hashToken(newRefreshToken) })
      .eq('id', profile.id)

    return Response.json({ data: { accessToken: newAccessToken, refreshToken: newRefreshToken }, error: null })
  } catch (err) {
    console.error('Refresh error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

**Step 3: Logout endpoint**

```typescript
// app/api/client/v1/auth/logout/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    // Invalidate refresh token
    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: null })
      .eq('id', client.clientId)

    return Response.json({ data: { success: true }, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 4: Commit**

```bash
git add app/api/client/v1/auth/
git commit -m "feat(client-app): add login, refresh, logout auth endpoints"
```

---

### Task 5: GET/PATCH /api/client/v1/profile

**Files:**
- Create: `app/api/client/v1/profile/route.ts`

**Step 1: Profile endpoint**

```typescript
// app/api/client/v1/profile/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    // Get client profile + CRM party data
    const { data: profile, error } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, avatar_url, referral_code, invited_by_agent_id, created_at, last_login_at')
      .eq('id', client.clientId)
      .single()

    if (error || !profile) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    // Get CRM party data (name, email, phone)
    const { data: party } = await supabaseAdmin
      .from('parties')
      .select('id, first_name, last_name, email, phone')
      .eq('id', profile.crm_client_id)
      .single()

    return Response.json({
      data: {
        id: profile.id,
        firstName: party?.first_name,
        lastName: party?.last_name,
        email: party?.email,
        phone: party?.phone,
        avatarUrl: profile.avatar_url,
        referralCode: profile.referral_code,
        createdAt: profile.created_at,
        lastLoginAt: profile.last_login_at,
      },
      error: null,
    })
  } catch {
    return unauthorizedResponse()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const body = await req.json()

    // Update allowed fields in client_profiles
    const profileUpdates: Record<string, unknown> = {}
    if (body.avatarUrl !== undefined) profileUpdates.avatar_url = body.avatarUrl
    if (body.notificationToken !== undefined) profileUpdates.notification_token = body.notificationToken

    if (Object.keys(profileUpdates).length > 0) {
      await supabaseAdmin
        .from('client_profiles')
        .update(profileUpdates)
        .eq('id', client.clientId)
    }

    // Update allowed fields in parties
    const partyUpdates: Record<string, unknown> = {}
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('crm_client_id')
      .eq('id', client.clientId)
      .single()

    if (profile && (body.firstName !== undefined || body.lastName !== undefined || body.phone !== undefined)) {
      if (body.firstName !== undefined) partyUpdates.first_name = body.firstName
      if (body.lastName !== undefined) partyUpdates.last_name = body.lastName
      if (body.phone !== undefined) partyUpdates.phone = body.phone

      await supabaseAdmin
        .from('parties')
        .update(partyUpdates)
        .eq('id', profile.crm_client_id)
    }

    return Response.json({ data: { success: true }, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 2: Commit**

```bash
git add app/api/client/v1/profile/route.ts
git commit -m "feat(client-app): add GET/PATCH /api/client/v1/profile"
```

---

### Task 6: GET /api/client/v1/bookings (список + upcoming + history)

**Files:**
- Create: `app/api/client/v1/bookings/route.ts`
- Create: `app/api/client/v1/bookings/upcoming/route.ts`
- Create: `app/api/client/v1/bookings/history/route.ts`

> Перед написанием — изучить существующую структуру таблицы заказов. Посмотреть `/app/api/orders/route.ts` чтобы понять какие поля есть в таблице orders/bookings.

**Step 1: Изучить структуру таблицы orders**

Прочитать `app/api/orders/route.ts` и понять поля таблицы (client_id / party_id, start_date, end_date, status, total_amount).

**Step 2: Написать bookings list endpoint**

```typescript
// app/api/client/v1/bookings/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    // Get all orders for this client (via crm_client_id)
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_code, status, start_date, end_date, total_amount, currency,
        destination_city, destination_country,
        created_at, updated_at
      `)
      .eq('client_id', client.crmClientId)
      .order('start_date', { ascending: false })

    if (error) {
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    return Response.json({ data: orders ?? [], error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 3: Upcoming endpoint**

```typescript
// app/api/client/v1/bookings/upcoming/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const now = new Date().toISOString()

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_code, status, start_date, end_date, total_amount, currency, destination_city, destination_country')
      .eq('client_id', client.crmClientId)
      .gte('start_date', now)
      .order('start_date', { ascending: true })

    if (error) return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })

    return Response.json({ data: orders ?? [], error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 4: History endpoint**

```typescript
// app/api/client/v1/bookings/history/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const now = new Date().toISOString()

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_code, status, start_date, end_date, total_amount, currency, destination_city, destination_country')
      .eq('client_id', client.crmClientId)
      .lt('end_date', now)
      .order('end_date', { ascending: false })

    if (error) return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })

    return Response.json({ data: orders ?? [], error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 5: Commit**

```bash
git add app/api/client/v1/bookings/
git commit -m "feat(client-app): add bookings list/upcoming/history endpoints"
```

---

### Task 7: GET /api/client/v1/bookings/[id] + itinerary + documents

**Files:**
- Create: `app/api/client/v1/bookings/[id]/route.ts`
- Create: `app/api/client/v1/bookings/[id]/itinerary/route.ts`
- Create: `app/api/client/v1/bookings/[id]/documents/route.ts`

> Изучить существующий `/app/api/orders/[orderCode]/route.ts` для понимания структуры данных (services, documents).

**Step 1: Single booking endpoint**

```typescript
// app/api/client/v1/bookings/[id]/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await getAuthenticatedClient(req)
    const { id } = await params

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_code, status, start_date, end_date, total_amount, currency,
        destination_city, destination_country, notes, created_at,
        services:order_services(id, service_type, name, start_date, end_date, status, total_amount, currency, details)
      `)
      .eq('id', id)
      .eq('client_id', client.crmClientId)
      .single()

    if (error || !order) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    return Response.json({ data: order, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 2: Itinerary endpoint**

```typescript
// app/api/client/v1/bookings/[id]/itinerary/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await getAuthenticatedClient(req)
    const { id } = await params

    // Verify ownership
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('client_id', client.crmClientId)
      .single()

    if (!order) return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })

    // Get services sorted by date for timeline
    const { data: services } = await supabaseAdmin
      .from('order_services')
      .select('id, service_type, name, start_date, end_date, status, details, notes')
      .eq('order_id', id)
      .order('start_date', { ascending: true })

    return Response.json({ data: services ?? [], error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 3: Documents endpoint с S3 signed URLs**

```typescript
// app/api/client/v1/bookings/[id]/documents/route.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await getAuthenticatedClient(req)
    const { id } = await params

    // Verify ownership
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('client_id', client.crmClientId)
      .single()

    if (!order) return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })

    // Get documents — Supabase Storage signed URLs (15 min TTL)
    // Adjust table/column names based on actual schema
    const { data: docs } = await supabaseAdmin
      .from('order_documents')
      .select('id, name, document_type, file_path, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    // Generate signed URLs for each document
    const docsWithUrls = await Promise.all(
      (docs ?? []).map(async (doc) => {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 900) // 15 minutes
        return { ...doc, downloadUrl: signedUrl?.signedUrl ?? null }
      })
    )

    return Response.json({ data: docsWithUrls, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 4: Commit**

```bash
git add app/api/client/v1/bookings/
git commit -m "feat(client-app): add booking detail, itinerary, documents endpoints"
```

---

## ФАЗА 1: MVP — Mobile App

---

### Task 8: Init Expo project в папке Client/

**Files:**
- Create: `Client/` — Expo project (команды ниже)

**Step 1: Инициализировать Expo проект**

```bash
cd Client
npx create-expo-app@latest . --template blank-typescript
```

**Step 2: Установить зависимости**

```bash
npx expo install expo-secure-store expo-notifications expo-image-picker expo-local-authentication expo-linking
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npm install zustand @tanstack/react-query axios
npm install react-native-pdf
```

**Step 3: Настроить `app.json`**

Добавить:
```json
{
  "expo": {
    "name": "MyTravelConcierge",
    "slug": "mytravelconcierge",
    "scheme": "mytravelconcierge",
    "ios": { "bundleIdentifier": "com.mytravelconcierge.app" },
    "android": { "package": "com.mytravelconcierge.app" },
    "plugins": ["expo-secure-store", "expo-notifications"]
  }
}
```

**Step 4: Commit**

```bash
cd Client
git add .
git commit -m "feat(mobile): init Expo project MyTravelConcierge"
```

---

### Task 9: API Client (Axios + interceptors + token refresh)

**Files:**
- Create: `Client/src/api/client.ts`
- Create: `Client/src/api/auth.ts`
- Create: `Client/src/api/bookings.ts`
- Create: `Client/src/store/authStore.ts`

**Step 1: Написать Axios API client с auto-refresh**

```typescript
// Client/src/api/client.ts
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-cms-domain.com'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/client/v1`,
  timeout: 15000,
})

// Request interceptor: add access token
apiClient.interceptors.request.use(async (config) => {
  const accessToken = await SecureStore.getItemAsync('accessToken')
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post(`${BASE_URL}/api/client/v1/auth/refresh`, { refreshToken })
        
        await SecureStore.setItemAsync('accessToken', data.data.accessToken)
        await SecureStore.setItemAsync('refreshToken', data.data.refreshToken)

        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`
        return apiClient(originalRequest)
      } catch {
        // Refresh failed — clear tokens and force re-login
        await SecureStore.deleteItemAsync('accessToken')
        await SecureStore.deleteItemAsync('refreshToken')
        // Signal to app that user needs to login again
        // (AuthStore will detect missing tokens on next check)
        throw error
      }
    }
    return Promise.reject(error)
  }
)
```

**Step 2: Auth store (Zustand)**

```typescript
// Client/src/store/authStore.ts
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { apiClient } from '../api/client'

interface AuthState {
  accessToken: string | null
  isAuthenticated: boolean
  clientId: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isAuthenticated: false,
  clientId: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken')
      const clientId = await SecureStore.getItemAsync('clientId')
      set({ accessToken: token, isAuthenticated: !!token, clientId, isLoading: false })
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password })
    const { accessToken, refreshToken, clientId } = data.data
    await SecureStore.setItemAsync('accessToken', accessToken)
    await SecureStore.setItemAsync('refreshToken', refreshToken)
    await SecureStore.setItemAsync('clientId', clientId)
    set({ accessToken, isAuthenticated: true, clientId })
  },

  logout: async () => {
    try { await apiClient.post('/auth/logout') } catch { /* ignore */ }
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('clientId')
    set({ accessToken: null, isAuthenticated: false, clientId: null })
  },
}))
```

**Step 3: Commit**

```bash
cd Client
git add src/
git commit -m "feat(mobile): add API client with token refresh and auth store"
```

---

### Task 10: Navigation structure

**Files:**
- Create: `Client/src/navigation/AuthStack.tsx`
- Create: `Client/src/navigation/MainStack.tsx`
- Create: `Client/src/navigation/index.tsx`
- Modify: `Client/App.tsx`

**Step 1: Написать навигацию**

```typescript
// Client/src/navigation/index.tsx
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { useAuthStore } from '../store/authStore'
import { AuthStack } from './AuthStack'
import { MainStack } from './MainStack'
import { ActivityIndicator, View } from 'react-native'

export function RootNavigator() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => { checkAuth() }, [])

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#1a73e8" />
    </View>
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  )
}
```

```typescript
// Client/src/navigation/AuthStack.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { RegisterScreen } from '../screens/auth/RegisterScreen'
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen'

const Stack = createNativeStackNavigator()

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  )
}
```

```typescript
// Client/src/navigation/MainStack.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { HomeScreen } from '../screens/home/HomeScreen'
import { TripsScreen } from '../screens/trips/TripsScreen'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'
import { ConciergeScreen } from '../screens/concierge/ConciergeScreen'
import { DocumentsScreen } from '../screens/documents/DocumentsScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function TripsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TripsList" component={TripsScreen} options={{ title: 'Поездки' }} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Детали поездки' }} />
    </Stack.Navigator>
  )
}

export function MainStack() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#1a73e8' }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="Trips" component={TripsStack} options={{ title: 'Поездки', headerShown: false }} />
      <Tab.Screen name="Concierge" component={ConciergeScreen} options={{ title: 'Консьерж' }} />
      <Tab.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Документы' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  )
}
```

**Step 2: Commit**

```bash
cd Client
git add src/navigation/
git commit -m "feat(mobile): add navigation structure AuthStack + MainStack + BottomTabs"
```

---

### Task 11: LoginScreen + RegisterScreen

**Files:**
- Create: `Client/src/screens/auth/LoginScreen.tsx`
- Create: `Client/src/screens/auth/RegisterScreen.tsx`

**Step 1: LoginScreen**

```typescript
// Client/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuthStore } from '../../store/authStore'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Ошибка', 'Введите email и пароль')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch {
      Alert.alert('Ошибка', 'Неверный email или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>MyTravelConcierge</Text>
        <Text style={styles.subtitle}>Войдите в аккаунт</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Вход...' : 'Войти'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#1a73e8', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#1a73e8', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

**Step 2: Commit**

```bash
cd Client
git add src/screens/auth/
git commit -m "feat(mobile): add LoginScreen and RegisterScreen"
```

---

### Task 12: HomeScreen + TripsScreen + TripDetailScreen + DocumentsScreen + ProfileScreen

**Files:**
- Create: `Client/src/screens/home/HomeScreen.tsx`
- Create: `Client/src/screens/trips/TripsScreen.tsx`
- Create: `Client/src/screens/trips/TripDetailScreen.tsx`
- Create: `Client/src/screens/documents/DocumentsScreen.tsx`
- Create: `Client/src/screens/profile/ProfileScreen.tsx`
- Create: `Client/src/screens/concierge/ConciergeScreen.tsx` (placeholder)
- Create: `Client/src/api/bookings.ts`

> Это самый большой шаг — пять экранов. Каждый экран реализуется как функциональный компонент с React Query для fetching данных.

**Step 1: Написать bookings API**

```typescript
// Client/src/api/bookings.ts
import { apiClient } from './client'

export const bookingsApi = {
  getAll: () => apiClient.get('/bookings').then(r => r.data.data),
  getUpcoming: () => apiClient.get('/bookings/upcoming').then(r => r.data.data),
  getHistory: () => apiClient.get('/bookings/history').then(r => r.data.data),
  getById: (id: string) => apiClient.get(`/bookings/${id}`).then(r => r.data.data),
  getItinerary: (id: string) => apiClient.get(`/bookings/${id}/itinerary`).then(r => r.data.data),
  getDocuments: (id: string) => apiClient.get(`/bookings/${id}/documents`).then(r => r.data.data),
  getProfile: () => apiClient.get('/profile').then(r => r.data.data),
}
```

**Step 2: HomeScreen с виджетом ближайшей поездки**

```typescript
// Client/src/screens/home/HomeScreen.tsx
import React from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { bookingsApi } from '../../api/bookings'

export function HomeScreen() {
  const { data: upcoming, isLoading, refetch } = useQuery({
    queryKey: ['bookings', 'upcoming'],
    queryFn: bookingsApi.getUpcoming,
  })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: bookingsApi.getProfile })

  const nextTrip = upcoming?.[0]

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Привет, {profile?.firstName || 'путешественник'} 👋</Text>
        <Text style={styles.subtitle}>Добро пожаловать в MyTravelConcierge</Text>
      </View>

      {nextTrip && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ближайшая поездка</Text>
          <Text style={styles.cardTitle}>{nextTrip.destination_city}, {nextTrip.destination_country}</Text>
          <Text style={styles.cardDate}>
            {new Date(nextTrip.start_date).toLocaleDateString('ru-RU')} — {new Date(nextTrip.end_date).toLocaleDateString('ru-RU')}
          </Text>
          <Text style={styles.cardStatus}>{nextTrip.status}</Text>
        </View>
      )}

      {!nextTrip && !isLoading && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Нет запланированных поездок</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#1a73e8' },
  greeting: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 8 },
  cardDate: { fontSize: 14, color: '#666', marginTop: 4 },
  cardStatus: { fontSize: 12, color: '#1a73e8', fontWeight: '600', marginTop: 8, textTransform: 'uppercase' },
  emptyCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 },
})
```

**Step 3: TripsScreen с табами upcoming/history**

Реализовать TripsScreen с двумя табами и TripCard компонентом. Использовать `useQuery` для fetching.

**Step 4: Commit**

```bash
cd Client
git add src/
git commit -m "feat(mobile): add Home, Trips, TripDetail, Documents, Profile screens"
```

---

## ФАЗА 2: AI Concierge — Backend

---

### Task 13: POST /api/client/v1/concierge/chat (Claude tool use)

**Files:**
- Create: `app/api/client/v1/concierge/chat/route.ts`
- Create: `lib/client-concierge/tools.ts`
- Create: `lib/client-concierge/systemPrompt.ts`

**Step 1: Написать инструменты (tools) для Claude**

```typescript
// lib/client-concierge/tools.ts
import Anthropic from '@anthropic-ai/sdk'

export const conciergeTools: Anthropic.Tool[] = [
  {
    name: 'search_hotels',
    description: 'Search for available hotels in a destination',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'City name' },
        check_in: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
        guests: { type: 'number', description: 'Number of guests' },
        rooms: { type: 'number', description: 'Number of rooms' },
      },
      required: ['city', 'check_in', 'check_out', 'guests'],
    },
  },
  {
    name: 'search_transfers',
    description: 'Search for airport transfers',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Pickup location (airport code or address)' },
        to: { type: 'string', description: 'Destination address' },
        date: { type: 'string', description: 'Transfer date YYYY-MM-DD' },
        passengers: { type: 'number', description: 'Number of passengers' },
      },
      required: ['from', 'to', 'date', 'passengers'],
    },
  },
  {
    name: 'get_client_trips',
    description: 'Get upcoming trips for the current client',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
]
```

**Step 2: System prompt builder**

```typescript
// lib/client-concierge/systemPrompt.ts
export function buildConciergeSystemPrompt(client: { firstName: string; lastName: string; id: string }, language: string = 'ru') {
  return `You are a professional travel concierge assistant for MyTravelConcierge.
Client: ${client.firstName} ${client.lastName}, ID: ${client.id}
Preferred language: ${language}
Today: ${new Date().toISOString().split('T')[0]}

You help clients with:
- Searching for hotels and transfers
- Getting information about their upcoming trips
- Providing travel advice and recommendations

You have access to tools: search_hotels, search_transfers, get_client_trips.
Always confirm pricing and dates before suggesting bookings.
Respond in ${language === 'ru' ? 'Russian' : language === 'lv' ? 'Latvian' : 'English'}.
Be concise, professional, and helpful.`
}
```

**Step 3: Chat endpoint**

```typescript
// app/api/client/v1/concierge/chat/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { conciergeTools } from '@/lib/client-concierge/tools'
import { buildConciergeSystemPrompt } from '@/lib/client-concierge/systemPrompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const { message, sessionId, language = 'ru' } = await req.json()

    if (!message) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Get or create session
    let session
    if (sessionId) {
      const { data } = await supabaseAdmin
        .from('concierge_sessions')
        .select('id, messages')
        .eq('id', sessionId)
        .eq('client_id', client.clientId)
        .single()
      session = data
    }

    if (!session) {
      const { data } = await supabaseAdmin
        .from('concierge_sessions')
        .insert({ client_id: client.clientId, messages: [] })
        .select()
        .single()
      session = data
    }

    // Get client info for system prompt
    const { data: profileData } = await supabaseAdmin
      .from('client_profiles')
      .select('crm_client_id')
      .eq('id', client.clientId)
      .single()

    const { data: party } = await supabaseAdmin
      .from('parties')
      .select('first_name, last_name')
      .eq('id', profileData?.crm_client_id)
      .single()

    const systemPrompt = buildConciergeSystemPrompt(
      { firstName: party?.first_name || '', lastName: party?.last_name || '', id: client.clientId },
      language
    )

    // Build messages history
    const history: Anthropic.MessageParam[] = session.messages || []
    history.push({ role: 'user', content: message })

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools: conciergeTools,
      messages: history,
    })

    // Extract text response
    const assistantMessage = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // Add assistant response to history
    history.push({ role: 'assistant', content: response.content })

    // Save session
    await supabaseAdmin
      .from('concierge_sessions')
      .update({ messages: history, updated_at: new Date().toISOString() })
      .eq('id', session.id)

    return Response.json({
      data: {
        sessionId: session.id,
        message: assistantMessage,
        toolUse: response.content.filter(b => b.type === 'tool_use'),
        stopReason: response.stop_reason,
      },
      error: null,
    })
  } catch (err) {
    console.error('Concierge chat error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
```

**Step 4: Commit**

```bash
git add app/api/client/v1/concierge/ lib/client-concierge/
git commit -m "feat(client-app): add AI Concierge chat endpoint with Claude tool use"
```

---

### Task 14: Hotel & Transfer search endpoints

**Files:**
- Create: `app/api/client/v1/concierge/hotels/search/route.ts`
- Create: `app/api/client/v1/concierge/transfers/search/route.ts`

> Изучить существующий `lib/ratehawk/client.ts` для понимания как вызывать RateHawk API.

**Step 1: Hotel search (RateHawk)**

```typescript
// app/api/client/v1/concierge/hotels/search/route.ts
import { NextRequest } from 'next/server'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
// Import existing ratehawk client
import { ratehawkClient } from '@/lib/ratehawk/client'

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const { city, checkIn, checkOut, guests = 2, rooms = 1 } = await req.json()

    if (!city || !checkIn || !checkOut) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Use existing RateHawk integration
    const results = await ratehawkClient.searchHotels({ city, checkIn, checkOut, guests, rooms })

    return Response.json({ data: results, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 2: Transfer search (placeholder — SIXT/Blacklane integration)**

```typescript
// app/api/client/v1/concierge/transfers/search/route.ts
import { NextRequest } from 'next/server'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const { from, to, date, passengers = 2 } = await req.json()

    if (!from || !to || !date) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // TODO: Integrate SIXT API or Blacklane API
    // For now return placeholder structure
    return Response.json({
      data: [],
      error: null,
      message: 'Transfer search API integration pending',
    })
  } catch {
    return unauthorizedResponse()
  }
}
```

**Step 3: Commit**

```bash
git add app/api/client/v1/concierge/
git commit -m "feat(client-app): add hotel and transfer search endpoints for concierge"
```

---

### Task 15: ConciergeScreen (mobile chat UI)

**Files:**
- Create: `Client/src/screens/concierge/ConciergeScreen.tsx`
- Create: `Client/src/components/ChatBubble.tsx`
- Create: `Client/src/api/concierge.ts`

**Step 1: Concierge API**

```typescript
// Client/src/api/concierge.ts
import { apiClient } from './client'

export const conciergeApi = {
  sendMessage: (message: string, sessionId?: string) =>
    apiClient.post('/concierge/chat', { message, sessionId }).then(r => r.data.data),
}
```

**Step 2: ChatBubble component**

```typescript
// Client/src/components/ChatBubble.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface ChatBubbleProps {
  message: string
  isUser: boolean
  timestamp?: string
}

export function ChatBubble({ message, isUser, timestamp }: ChatBubbleProps) {
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      {!isUser && <Text style={styles.aiLabel}>AI Консьерж</Text>}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>{message}</Text>
      </View>
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: 4, maxWidth: '80%' },
  userContainer: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  aiContainer: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  aiLabel: { fontSize: 11, color: '#888', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  userBubble: { backgroundColor: '#1a73e8', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  text: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: '#333' },
  timestamp: { fontSize: 10, color: '#aaa', marginTop: 2, marginHorizontal: 4 },
})
```

**Step 3: ConciergeScreen**

```typescript
// Client/src/screens/concierge/ConciergeScreen.tsx
import React, { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { ChatBubble } from '../../components/ChatBubble'
import { conciergeApi } from '../../api/concierge'

interface Message { id: string; text: string; isUser: boolean; timestamp: string }

export function ConciergeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', text: 'Привет! Я ваш AI консьерж. Помогу с поиском отелей, трансферов и ответами на вопросы о путешествиях.', isUser: false, timestamp: '' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const listRef = useRef<FlatList>(null)

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: Date.now().toString(), text: input.trim(), isUser: true, timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const result = await conciergeApi.sendMessage(userMsg.text, sessionId)
      if (!sessionId && result.sessionId) setSessionId(result.sessionId)
      const aiMsg: Message = { id: (Date.now() + 1).toString(), text: result.message, isUser: false, timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: 'Ошибка соединения. Попробуйте ещё раз.', isUser: false, timestamp: '' }])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <ChatBubble message={item.text} isUser={item.isUser} timestamp={item.timestamp} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      {loading && <Text style={styles.typing}>AI печатает...</Text>}
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Напишите сообщение..." multiline returnKeyType="send" onSubmitEditing={sendMessage} />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!input.trim() || loading}>
          <Text style={styles.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  list: { padding: 16, paddingBottom: 8 },
  typing: { fontSize: 12, color: '#888', paddingLeft: 16, paddingBottom: 4 },
  inputRow: { flexDirection: 'row', padding: 8, paddingBottom: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { backgroundColor: '#1a73e8', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendText: { color: '#fff', fontSize: 18 },
})
```

**Step 4: Commit**

```bash
cd Client
git add src/
git commit -m "feat(mobile): add AI Concierge chat screen with ChatBubble component"
```

---

## Переменные окружения (добавить в .env.local)

```env
# Client App Auth
CLIENT_JWT_ACCESS_SECRET=<generate-32-char-random-string>
CLIENT_JWT_REFRESH_SECRET=<generate-32-char-random-string>
CLIENT_JWT_INVITATION_SECRET=<generate-32-char-random-string>

# Mobile App (в Client/.env)
EXPO_PUBLIC_API_URL=https://your-domain.com
```

---

## Порядок выполнения

1. **Task 1** — SQL миграция (нужна до всего остального)
2. **Task 2** — JWT helpers
3. **Task 3** — Register endpoint
4. **Task 4** — Login/Refresh/Logout
5. **Task 5** — Profile endpoint
6. **Task 6** — Bookings list/upcoming/history
7. **Task 7** — Booking detail/itinerary/documents
8. **Task 8** — Init Expo project
9. **Task 9** — API client + auth store
10. **Task 10** — Navigation structure
11. **Task 11** — LoginScreen
12. **Task 12** — Все основные экраны
13. **Task 13** — Concierge chat backend (Claude)
14. **Task 14** — Hotel/transfer search
15. **Task 15** — ConciergeScreen (mobile)

---

## Важные замечания

- **Таблица клиентов в CRM:** Нужно уточнить реальное название таблицы с клиентами — в коде используется `parties`, но нужно проверить через Supabase Dashboard
- **Таблица заказов:** В коде используется `orders` и `order_services` — проверить реальные имена полей перед Task 6-7
- **RateHawk:** `lib/ratehawk/client.ts` уже существует — изучить его API перед Task 14
- **Documents storage:** Уточнить используется ли Supabase Storage или AWS S3 перед Task 7

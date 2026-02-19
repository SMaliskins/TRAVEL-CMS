# MyTravelConcierge — Client App

## Project Overview

Travel CRM platform with a client-facing React Native mobile app (MyTravelConcierge).
The CRM backend already exists (Next.js 14 + Prisma + PostgreSQL). We are adding:
1. Client authentication module (JWT + Refresh tokens)
2. Mobile app (React Native + Expo)
3. AI Concierge (Claude API integration)
4. MLM referral commission system
5. MCP server for external AI agents

## Tech Stack

- **Backend**: Next.js 14 App Router, API Routes at `/api/client/v1/`
- **Database**: PostgreSQL + Prisma ORM (existing schema, we ADD new tables)
- **Mobile**: React Native 0.74 + Expo SDK 51
- **State**: Zustand + TanStack Query (React Query v5)
- **Auth**: JWT (15 min) + Refresh Token (30 days) stored in Expo SecureStore
- **Payments**: Stripe + Banklinks (Montonio for Baltic banks)
- **Push**: Expo Notifications + Firebase FCM
- **AI**: Claude Sonnet via Anthropic API (tool use / function calling)
- **Hotel APIs**: RateHawk + Hotelston (already integrated in CRM)
- **Transfer APIs**: SIXT + Blacklane
- **File Storage**: AWS S3 / Cloudflare R2 for vouchers and documents

## Folder Structure

```
travel-cms/
├── prisma/
│   └── schema.prisma          # ADD new models here
├── src/
│   └── app/
│       └── api/
│           └── client/
│               └── v1/
│                   ├── auth/
│                   │   ├── register/route.ts
│                   │   ├── login/route.ts
│                   │   ├── refresh/route.ts
│                   │   ├── logout/route.ts
│                   │   └── forgot-password/route.ts
│                   ├── profile/route.ts
│                   ├── bookings/
│                   │   ├── route.ts
│                   │   ├── upcoming/route.ts
│                   │   ├── history/route.ts
│                   │   └── [id]/
│                   │       ├── route.ts
│                   │       ├── itinerary/route.ts
│                   │       └── documents/route.ts
│                   ├── concierge/
│                   │   ├── chat/route.ts
│                   │   ├── hotels/
│                   │   │   ├── search/route.ts
│                   │   │   └── [hotelId]/route.ts
│                   │   ├── transfers/
│                   │   │   └── search/route.ts
│                   │   └── payment/
│                   │       ├── intent/route.ts
│                   │       └── confirm/route.ts
│                   └── referral/
│                       ├── code/route.ts
│                       └── stats/route.ts
├── src/
│   └── lib/
│       ├── auth/
│       │   ├── jwt.ts          # JWT sign/verify helpers
│       │   ├── tokens.ts       # Access + refresh token logic
│       │   └── middleware.ts   # Auth middleware for API routes
│       ├── commission/
│       │   └── calculator.ts   # MLM commission calculation
│       └── mcp/
│           └── server.ts       # MCP server definition
└── mobile/                     # React Native Expo app
    ├── app.json
    ├── package.json
    └── src/
        ├── navigation/
        │   ├── AuthStack.tsx
        │   ├── MainStack.tsx
        │   └── BottomTabs.tsx
        ├── screens/
        │   ├── auth/
        │   │   ├── LoginScreen.tsx
        │   │   ├── RegisterScreen.tsx
        │   │   └── ForgotPasswordScreen.tsx
        │   ├── home/
        │   │   └── HomeScreen.tsx
        │   ├── trips/
        │   │   ├── TripsScreen.tsx
        │   │   ├── TripDetailScreen.tsx
        │   │   └── ItineraryScreen.tsx
        │   ├── concierge/
        │   │   └── ConciergeScreen.tsx
        │   ├── documents/
        │   │   └── DocumentsScreen.tsx
        │   └── profile/
        │       └── ProfileScreen.tsx
        ├── store/
        │   ├── authStore.ts    # Zustand: auth state
        │   └── userStore.ts    # Zustand: user profile
        ├── api/
        │   ├── client.ts       # Axios instance with interceptors
        │   ├── auth.ts         # Auth API calls
        │   ├── bookings.ts     # Bookings API calls
        │   └── concierge.ts    # Concierge API calls
        └── components/
            ├── TripCard.tsx
            ├── ItineraryTimeline.tsx
            ├── ChatBubble.tsx
            └── DocumentCard.tsx
```

## Database — New Prisma Models

Add these models to the EXISTING `prisma/schema.prisma`:

```prisma
model ClientProfile {
  id               String    @id @default(uuid())
  crmClientId      String    @unique  // FK to existing Client model
  passwordHash     String
  refreshTokenHash String?
  avatarUrl        String?
  notificationToken String?
  invitedByAgentId String?   // FK to Agent for L1 referral
  referralCode     String    @unique @default(cuid())
  stripeCustomerId String?
  createdAt        DateTime  @default(now())
  lastLoginAt      DateTime?
  commissions      CommissionLedger[]
  payouts          CommissionPayout[]
}

model CommissionLedger {
  id               String    @id @default(uuid())
  bookingId        String
  agentProfileId   String
  level            Int       // 1, 2, or 3
  grossMargin      Decimal
  commissionRate   Decimal   // L1=0.02, L2=0.01, L3=0.005
  commissionAmount Decimal
  status           CommissionStatus @default(PENDING)
  payoutId         String?
  createdAt        DateTime  @default(now())
  agent            ClientProfile @relation(fields: [agentProfileId], references: [id])
  payout           CommissionPayout? @relation(fields: [payoutId], references: [id])
}

model CommissionPayout {
  id             String    @id @default(uuid())
  agentProfileId String
  totalAmount    Decimal
  invoiceNumber  String?
  paymentMethod  PaymentMethod @default(BANK_TRANSFER)
  status         PayoutStatus  @default(PENDING)
  paidAt         DateTime?
  createdAt      DateTime  @default(now())
  agent          ClientProfile @relation(fields: [agentProfileId], references: [id])
  commissions    CommissionLedger[]
}

enum CommissionStatus {
  PENDING    // booking paid, trip not completed yet
  PAYABLE    // trip completed, ready to pay out
  PAID       // paid out
}

enum PayoutStatus {
  PENDING
  PROCESSING
  PAID
}

enum PaymentMethod {
  BANK_TRANSFER
  INVOICE
  AUTO
}
```

## API Authentication Pattern

Every protected route must use this pattern:

```typescript
// src/lib/auth/middleware.ts
import { verifyAccessToken } from './jwt'
import { NextRequest } from 'next/server'

export async function getAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED')
  }
  const token = authHeader.split(' ')[1]
  const payload = verifyAccessToken(token)
  return payload // { clientId, agentId, ... }
}
```

Usage in route:
```typescript
export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    // ... handler logic
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

## JWT Configuration

```typescript
// Access token: 15 minutes, RS256
// Refresh token: 30 days, stored as hash in ClientProfile.refreshTokenHash
// Invitation token: 24 hours, sent via email/SMS on client creation

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '30d'
const INVITATION_TOKEN_EXPIRY = '24h'
```

## Commission Calculation Logic

When a booking is completed via AI Concierge:

```typescript
// src/lib/commission/calculator.ts
// Margin = client_price - supplier_price
// Distribution:
//   2% → bank/payment processor (deducted before commission)
//   2% → L1 agent (who invited the client)
//   1% → L2 agent (who invited the L1 agent)
//   0.5% → L3 agent (who invited the L2 agent)
//   remaining → platform profit

const COMMISSION_RATES = {
  L1: 0.02,
  L2: 0.01,
  L3: 0.005,
}

// Trigger: after booking status changes to COMPLETED (post-checkout)
// Create CommissionLedger entries for each level in the agent chain
```

## AI Concierge — System Prompt

```typescript
const buildSystemPrompt = (client: ClientProfile, language: string) => `
You are a professional travel concierge assistant.
Client: ${client.fullName}, ID: ${client.id}
Language: ${language}
Today: ${new Date().toISOString().split('T')[0]}

You have access to tools: search_hotels, search_transfers, book_hotel, 
book_transfer, get_booking_details, create_payment_intent.

Always confirm pricing and dates before booking.
Respond in the client's preferred language.
Be concise, professional, and helpful.
`
```

## Mobile App — Key Patterns

**API Client with auto token refresh:**
```typescript
// mobile/src/api/client.ts
// Axios instance that:
// 1. Adds Authorization: Bearer {accessToken} header
// 2. On 401 → calls /auth/refresh with refresh token from SecureStore
// 3. Retries original request with new access token
// 4. On refresh failure → clears tokens → redirects to Login
```

**Auth Store (Zustand):**
```typescript
// mobile/src/store/authStore.ts
interface AuthState {
  accessToken: string | null
  isAuthenticated: boolean
  clientId: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}
// Refresh token stored in Expo SecureStore (NOT in Zustand state)
```

## Implementation Phases

### Phase 1 — Start Here (MVP)
1. Add Prisma models (ClientProfile, CommissionLedger, CommissionPayout)
2. Run `npx prisma migrate dev --name add_client_app`
3. Implement `/api/client/v1/auth/*` endpoints
4. Implement `/api/client/v1/profile` endpoint
5. Implement `/api/client/v1/bookings/*` endpoints
6. Implement `/api/client/v1/bookings/[id]/documents` with S3 signed URLs
7. Set up Expo project in `/mobile`
8. Build navigation structure (AuthStack + BottomTabs)
9. Build screens: Login, Home, Trips, TripDetail, Itinerary, Documents

### Phase 2 — AI Concierge
1. Implement `/api/client/v1/concierge/chat` with Claude tool use
2. Connect RateHawk + Hotelston for hotel search
3. Connect SIXT + Blacklane for transfer search
4. Stripe payment flow (PaymentIntent → confirm → webhook)
5. Build ConciergeScreen in mobile app

### Phase 3 — Referral MLM
1. CommissionLedger write logic on booking completion
2. Agent chain traversal (L1 → L2 → L3)
3. `/api/client/v1/referral/*` endpoints
4. CRM admin panel for payout management
5. Monthly auto-payout cron job

### Phase 4 — MCP Server
1. Implement MCP server at `src/lib/mcp/server.ts`
2. Export tools: search_hotels, book_hotel, search_transfers, get_client_trips, etc.
3. Add `/api/mcp/*` endpoint for MCP protocol

## Environment Variables Needed

```env
# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_INVITATION_SECRET=

# Database (already exists)
DATABASE_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# S3 / R2
S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AI
ANTHROPIC_API_KEY=

# Push Notifications
FCM_SERVER_KEY=

# Existing hotel APIs (already configured in CRM)
RATEHAWK_API_KEY=
HOTELSTON_API_KEY=
```

## Coding Conventions

- TypeScript strict mode everywhere
- Zod for all API input validation
- Return `{ data, error }` pattern from all API routes
- All dates in ISO 8601 UTC
- All monetary amounts as integers in cents (e.g., 10000 = €100.00)
- Prisma transactions for any multi-table writes
- Never store raw tokens — always hash with bcrypt/sha256 before DB write
- Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`

## Security Rules

- Never expose internal IDs directly — use opaque tokens where possible
- Validate that the authenticated client owns the requested resource (e.g., booking belongs to client)
- Rate limit auth endpoints: 10 attempts / 15 min per IP
- All file downloads must use time-limited signed URLs (S3 presigned, 15 min TTL)
- Refresh tokens must be rotated on every use

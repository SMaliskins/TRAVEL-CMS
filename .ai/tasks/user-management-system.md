# 👥 USER MANAGEMENT SYSTEM — Specification

**Date:** 2026-01-12  
**Updated:** 2026-01-12 (SaaS Model)  
**Agent:** Runner (Architect)  
**Priority:** 🔴 CRITICAL  
**Complexity:** 🔴 Complex  
**Estimated Time:** 16-20 hours  

---

## 📋 OVERVIEW

### Core Features:
1. **User Management** — Supervisor добавляет пользователей
2. **Dynamic Roles** — Роли хранятся в БД (можно добавлять новые)
3. **Feature Modules** — Модули функционала с ценами
4. **Subscriptions** — Подписки для коммерческой продажи (SaaS)

### Готовность к SaaS:
- Каждая компания = отдельный tenant
- Модульная система (включаешь нужные features)
- Биллинг по подписке (monthly/yearly)

---

## 🎭 ROLES & PERMISSIONS

### Current Roles (extensible)

| Role | Level | Scope | Description |
|------|-------|-------|-------------|
| **Supervisor** | 5 | All | Полный доступ + управление users |
| **Director** | 4 | All | Все данные, настройки компании |
| **Accountant** | 3 | All | Финансы, отчёты, платежи |
| **Agent** | 2 | All | Все заказы (основной сотрудник) |
| **Subagent** | 1 | Own | Только свои заказы (партнёр) |

### Permission Matrix

| Permission | Subagent | Agent | Accountant | Director | Supervisor |
|------------|:--------:|:-----:|:----------:|:--------:|:----------:|
| **Orders** |
| View orders | Own | All | All | All | All |
| Create order | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit order | Own | All | All | All | All |
| Delete order | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Services** |
| Add services | Own | All | All | All | All |
| Edit services | Own | All | All | All | All |
| See Service Price | Own | ✅ | ✅ | ✅ | ✅ |
| See Margin | Own | ✅ | ✅ | ✅ | ✅ |
| **Finance** |
| View invoices | Own | All | All | All | All |
| Create invoice | Own | ✅ | ✅ | ✅ | ✅ |
| Record payment | Own | ✅ | ✅ | ✅ | ✅ |
| Financial reports | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Directory** |
| View contacts | All | All | All | All | All |
| Add contacts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit contacts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete contacts | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Users** |
| View users | ❌ | ❌ | ❌ | ✅ Read | ✅ All |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Settings** |
| Company settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| System settings | ❌ | ❌ | ❌ | ❌ | ✅ |

> **Note:** "Own" = только заказы, созданные этим пользователем или назначенные ему

---

## 💰 FEATURE MODULES & SUBSCRIPTIONS (SaaS)

### Feature Modules (примеры)

| Module | Description | Price/mo | Included In |
|--------|-------------|----------|-------------|
| `orders` | Управление заказами | €0 | All plans |
| `services` | Добавление сервисов | €0 | All plans |
| `invoicing` | Выставление счетов | €10 | Pro+ |
| `payments` | Учёт платежей | €10 | Pro+ |
| `reports` | Финансовые отчёты | €15 | Business+ |
| `booking_api` | Booking.com интеграция | €25 | Business+ |
| `email_tracking` | Отслеживание email | €5 | Pro+ |
| `multi_users` | >3 пользователей | €5/user | Pro+ |
| `api_access` | REST API доступ | €50 | Enterprise |
| `white_label` | Свой домен/брендинг | €100 | Enterprise |

### Subscription Plans

| Plan | Price/mo | Users | Features |
|------|----------|-------|----------|
| **Free** | €0 | 1 | orders, services, directory |
| **Starter** | €19 | 3 | Free + invoicing |
| **Pro** | €49 | 10 | Starter + payments, reports, email |
| **Business** | €99 | 25 | Pro + booking_api, priority support |
| **Enterprise** | Custom | ∞ | All + api_access, white_label, SLA |

---

## 🗄️ DATABASE SCHEMA

### Migration: `migrations/user_management.sql`

```sql
-- ============================================
-- PART 1: ROLES (Dynamic, extensible)
-- ============================================

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- 'agent', 'supervisor', etc.
  display_name TEXT NOT NULL,          -- 'Агент', 'Супервайзер'
  level INTEGER NOT NULL DEFAULT 1,    -- Hierarchy level (1-5)
  scope TEXT NOT NULL DEFAULT 'all',   -- 'own' | 'all'
  description TEXT,
  is_system BOOLEAN DEFAULT false,     -- Cannot be deleted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default roles
INSERT INTO roles (name, display_name, level, scope, is_system) VALUES
  ('subagent', 'Субагент', 1, 'own', true),
  ('agent', 'Агент', 2, 'all', true),
  ('accountant', 'Бухгалтер', 3, 'all', true),
  ('director', 'Директор', 4, 'all', true),
  ('supervisor', 'Супервайзер', 5, 'all', true);

-- Role permissions
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,            -- 'orders.view', 'users.manage'
  scope TEXT DEFAULT 'all',            -- Override: 'own' | 'all'
  UNIQUE(role_id, permission)
);

-- ============================================
-- PART 2: USERS
-- ============================================

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_login_at TIMESTAMPTZ,
  UNIQUE(id, company_id)
);

-- User-specific permission overrides (optional)
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,        -- true = allow, false = deny
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

-- ============================================
-- PART 3: FEATURE MODULES
-- ============================================

CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,           -- 'invoicing', 'booking_api'
  name TEXT NOT NULL,                  -- 'Выставление счетов'
  description TEXT,
  price_monthly NUMERIC(10,2) DEFAULT 0,
  price_yearly NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default features
INSERT INTO features (code, name, price_monthly) VALUES
  ('orders', 'Управление заказами', 0),
  ('services', 'Сервисы', 0),
  ('directory', 'Справочник', 0),
  ('invoicing', 'Счета', 10),
  ('payments', 'Платежи', 10),
  ('reports', 'Отчёты', 15),
  ('booking_api', 'Booking.com API', 25),
  ('email_tracking', 'Email tracking', 5),
  ('multi_users', 'Доп. пользователи', 5),
  ('api_access', 'REST API', 50),
  ('white_label', 'White Label', 100);

-- ============================================
-- PART 4: SUBSCRIPTIONS
-- ============================================

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,           -- 'free', 'pro', 'business'
  name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2),
  max_users INTEGER,                   -- NULL = unlimited
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan includes features
CREATE TABLE public.plan_features (
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, feature_id)
);

-- Company subscriptions
CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'past_due'
  billing_cycle TEXT DEFAULT 'monthly',  -- 'monthly', 'yearly'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,           -- For Stripe integration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additional features purchased separately
CREATE TABLE public.company_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  feature_id UUID NOT NULL REFERENCES features(id),
  quantity INTEGER DEFAULT 1,            -- For per-unit features (extra users)
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, feature_id)
);

-- ============================================
-- PART 5: INDEXES
-- ============================================

CREATE INDEX idx_user_profiles_company ON user_profiles(company_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role_id);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_company_subscriptions_company ON company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_status ON company_subscriptions(status);

-- ============================================
-- PART 6: RLS POLICIES
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supervisors can manage users in their company
CREATE POLICY "Supervisors manage users" ON user_profiles
  FOR ALL
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.id = auth.uid() AND r.name = 'supervisor'
    )
  );

-- Directors can view users
CREATE POLICY "Directors view users" ON user_profiles
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.id = auth.uid() AND r.level >= 4
    )
  );

-- Users can view/update own profile
CREATE POLICY "Own profile access" ON user_profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Roles are readable by all
CREATE POLICY "Roles readable" ON roles FOR SELECT USING (true);

-- Features are readable by all
CREATE POLICY "Features readable" ON features FOR SELECT USING (true);

-- Subscriptions visible to directors+
CREATE POLICY "Subscriptions visible" ON company_subscriptions
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.id = auth.uid() AND r.level >= 4
    )
  );
```

---

## 🔌 API ENDPOINTS

### `app/api/users/route.ts`

```typescript
// GET /api/users — List users (Supervisor/Director only)
// POST /api/users — Create user (Supervisor only)

export async function GET(request: Request) {
  const user = await getCurrentUser();
  
  if (!['supervisor', 'director'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*, auth_user:auth.users(email, last_sign_in_at)')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false });
  
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  
  if (user.role !== 'supervisor') {
    return NextResponse.json({ error: 'Only supervisors can add users' }, { status: 403 });
  }
  
  const body = await request.json();
  const { email, firstName, lastName, role, phone } = body;
  
  // 1. Create auth user with temp password
  const tempPassword = generateTempPassword();
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  
  if (authError) throw authError;
  
  // 2. Create user profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: authUser.user.id,
      company_id: user.company_id,
      role,
      first_name: firstName,
      last_name: lastName,
      phone,
      created_by: user.id,
    })
    .select()
    .single();
  
  // 3. Send welcome email with temp password
  await sendWelcomeEmail(email, tempPassword);
  
  return NextResponse.json(profile);
}
```

### `app/api/users/[userId]/route.ts`

```typescript
// GET /api/users/:userId — Get user details
// PATCH /api/users/:userId — Update user (role, status)
// DELETE /api/users/:userId — Deactivate user (soft delete)
```

---

## 🖥️ UI COMPONENTS

### Page: `app/settings/users/page.tsx`

```tsx
export default function UsersPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Button onClick={() => setShowAddModal(true)}>
          + Add User
        </Button>
      </div>
      
      <UserList users={users} onEdit={handleEdit} onDeactivate={handleDeactivate} />
      
      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} onSuccess={refetch} />
      )}
    </div>
  );
}
```

### Component: `components/users/UserList.tsx`

```tsx
// Table with columns:
// | Name | Email | Role | Status | Last Login | Actions |
// Actions: Edit, Deactivate/Activate
```

### Component: `components/users/AddUserModal.tsx`

```tsx
// Form fields:
// - Email* (required)
// - First Name*
// - Last Name*
// - Phone
// - Role* (dropdown: Agent, Accountant, Director, Supervisor)
// 
// On submit: POST /api/users
// Success: "User created. Welcome email sent."
```

### Component: `components/users/EditUserModal.tsx`

```tsx
// Edit: Role, Phone, Name
// Cannot change email
// Supervisor cannot demote themselves
```

---

## 🔐 SECURITY CONSIDERATIONS

1. **Supervisor Self-Protection**
   - Supervisor cannot demote/deactivate themselves
   - Must be at least 1 active Supervisor per company

2. **Password Policy**
   - Temp password: 12 chars, mixed case + numbers + symbols
   - Force password change on first login

3. **Audit Log**
   - Log all user management actions
   - Who created/edited/deactivated whom and when

4. **Session Management**
   - Deactivated users: invalidate sessions immediately
   - Role change: require re-login

---

## 📁 FILE STRUCTURE

```
app/
├── settings/
│   └── users/
│       └── page.tsx           # Users list page
├── api/
│   └── users/
│       ├── route.ts           # GET (list), POST (create)
│       └── [userId]/
│           └── route.ts       # GET, PATCH, DELETE

components/
└── users/
    ├── UserList.tsx           # Users table
    ├── AddUserModal.tsx       # Add user form
    ├── EditUserModal.tsx      # Edit user form
    └── RoleBadge.tsx          # Role display component

lib/
├── auth/
│   ├── roles.ts               # Role constants & helpers
│   └── permissions.ts         # Permission checking
└── email/
    └── templates/
        └── welcome.tsx        # Welcome email template

migrations/
└── user_management.sql        # DB migration
```

---

## 🧪 TESTING CHECKLIST

### Functional:
- [ ] Supervisor can view all users
- [ ] Supervisor can add new user
- [ ] Supervisor can edit user role
- [ ] Supervisor can deactivate user
- [ ] Director can view users (read-only)
- [ ] Agent/Accountant cannot access /settings/users
- [ ] Welcome email sent on user creation
- [ ] Deactivated user cannot login

### Security:
- [ ] RLS policies work correctly
- [ ] Supervisor cannot demote self
- [ ] At least 1 Supervisor must exist
- [ ] Password policy enforced
- [ ] Sessions invalidated on deactivation

### UX:
- [ ] Clear error messages
- [ ] Loading states
- [ ] Confirmation dialogs for destructive actions
- [ ] Role badges with colors

---

## 📊 IMPLEMENTATION PHASES

### Phase 1: Database (4h) — DB Specialist
- [ ] Create migration: roles, user_profiles, permissions
- [ ] Create migration: features, subscriptions
- [ ] Add RLS policies
- [ ] Insert default roles & features
- [ ] Test policies manually

### Phase 2: Auth Helpers (2h) — Code Writer
- [ ] `lib/auth/roles.ts` — role helpers
- [ ] `lib/auth/permissions.ts` — permission checking
- [ ] `lib/auth/features.ts` — feature access checking
- [ ] `lib/auth/getCurrentUser.ts` — get user with role

### Phase 3: Users API (3h) — Code Writer
- [ ] GET /api/users
- [ ] POST /api/users
- [ ] PATCH /api/users/:id
- [ ] DELETE /api/users/:id (soft delete)
- [ ] GET /api/roles

### Phase 4: Users UI (4h) — Code Writer
- [ ] UserList component
- [ ] AddUserModal
- [ ] EditUserModal
- [ ] RoleBadge component
- [ ] /settings/users page
- [ ] Navigation for Supervisor

### Phase 5: Features/Subscriptions API (3h) — Code Writer
- [ ] GET /api/features
- [ ] GET /api/subscription
- [ ] POST /api/subscription (change plan)
- [ ] Feature access middleware

### Phase 6: Billing UI (2h) — Code Writer (Future)
- [ ] /settings/billing page
- [ ] Plan comparison
- [ ] Stripe integration (placeholder)

### Phase 7: Security Review (1h) — Security
- [ ] Audit RLS policies
- [ ] Check API authorization
- [ ] Test edge cases (supervisor self-delete, etc.)

### Phase 8: QA (2h) — QA
- [ ] Full testing checklist
- [ ] Role-based access testing
- [ ] Feature toggle testing

---

## 📁 UPDATED FILE STRUCTURE

```
app/
├── settings/
│   ├── users/
│   │   └── page.tsx           # Users list (Supervisor only)
│   ├── billing/
│   │   └── page.tsx           # Subscription management
│   └── roles/
│       └── page.tsx           # Roles management (Future)
├── api/
│   ├── users/
│   │   ├── route.ts           # GET, POST
│   │   └── [userId]/
│   │       └── route.ts       # GET, PATCH, DELETE
│   ├── roles/
│   │   └── route.ts           # GET roles list
│   ├── features/
│   │   └── route.ts           # GET features, check access
│   └── subscription/
│       └── route.ts           # GET, POST (change plan)

components/
└── users/
    ├── UserList.tsx
    ├── AddUserModal.tsx
    ├── EditUserModal.tsx
    ├── RoleBadge.tsx
    └── RoleSelect.tsx

lib/
├── auth/
│   ├── roles.ts               # Role constants & helpers
│   ├── permissions.ts         # hasPermission(user, 'orders.delete')
│   ├── features.ts            # hasFeature(company, 'booking_api')
│   └── getCurrentUser.ts      # Get user with role & permissions
└── billing/
    └── stripe.ts              # Stripe integration (future)

migrations/
├── user_management.sql        # Roles, users, permissions
└── features_subscriptions.sql # Features, plans, billing
```

---

## 🔮 FUTURE CONSIDERATIONS

1. **Stripe Integration** — для автоматического биллинга
2. **Role Builder** — UI для создания custom roles
3. **Permission Granularity** — per-field permissions
4. **Usage Limits** — лимиты по заказам, сервисам
5. **Audit Log** — кто что изменил и когда
6. **2FA** — двухфакторная аутентификация для Supervisor

---

**Created by:** Runner (Architect)  
**Status:** ✅ SPECIFICATION COMPLETE (v2 — SaaS Ready)  
**Estimated Time:** 20-24 hours  
**Next Step:** DB Specialist creates migration

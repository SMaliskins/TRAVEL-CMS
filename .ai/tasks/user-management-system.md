# 👥 USER MANAGEMENT SYSTEM — Specification

**Date:** 2026-01-12  
**Agent:** Runner (Architect)  
**Priority:** 🔴 CRITICAL  
**Complexity:** 🔴 Complex  
**Estimated Time:** 8-12 hours  

---

## 📋 OVERVIEW

Supervisor должен иметь возможность:
1. Добавлять новых пользователей в систему
2. Назначать роли (Agent, Accountant, Director, Supervisor)
3. Управлять правами доступа
4. Деактивировать пользователей

---

## 🎭 ROLES & PERMISSIONS

### Role Hierarchy

```
Supervisor (Level 4)
    ↓
Director (Level 3)
    ↓
Accountant (Level 2)
    ↓
Agent (Level 1)
```

### Permission Matrix

| Permission | Agent | Accountant | Director | Supervisor |
|------------|-------|------------|----------|------------|
| **Orders** |
| View orders | ✅ Own | ✅ All | ✅ All | ✅ All |
| Create order | ✅ | ✅ | ✅ | ✅ |
| Edit order | ✅ Own | ✅ All | ✅ All | ✅ All |
| Delete order | ❌ | ❌ | ✅ | ✅ |
| **Services** |
| Add services | ✅ Own | ✅ All | ✅ All | ✅ All |
| Edit services | ✅ Own | ✅ All | ✅ All | ✅ All |
| See Service Price | ❌ | ✅ | ✅ | ✅ |
| See Margin | ❌ | ✅ | ✅ | ✅ |
| **Finance** |
| View invoices | ✅ Own | ✅ All | ✅ All | ✅ All |
| Create invoice | ✅ | ✅ | ✅ | ✅ |
| Record payment | ❌ | ✅ | ✅ | ✅ |
| Financial reports | ❌ | ✅ | ✅ | ✅ |
| **Directory** |
| View contacts | ✅ All | ✅ All | ✅ All | ✅ All |
| Add contacts | ✅ | ✅ | ✅ | ✅ |
| Edit contacts | ✅ | ✅ | ✅ | ✅ |
| Delete contacts | ❌ | ❌ | ✅ | ✅ |
| **Users** |
| View users | ❌ | ❌ | ✅ Read | ✅ All |
| Add users | ❌ | ❌ | ❌ | ✅ |
| Edit users | ❌ | ❌ | ❌ | ✅ |
| Deactivate users | ❌ | ❌ | ❌ | ✅ |
| **Settings** |
| Company settings | ❌ | ❌ | ✅ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |

---

## 🗄️ DATABASE SCHEMA

### Migration: `migrations/user_management.sql`

```sql
-- User roles enum
CREATE TYPE user_role AS ENUM ('agent', 'accountant', 'director', 'supervisor');

-- Extend auth.users with role (or use separate table)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  role user_role NOT NULL DEFAULT 'agent',
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(id, company_id)
);

-- Permissions table (optional, for granular control)
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

-- Indexes
CREATE INDEX idx_user_profiles_company ON user_profiles(company_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Supervisors can see all users in their company
CREATE POLICY "Supervisors can manage users" ON user_profiles
  FOR ALL
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- Directors can view users (read-only)
CREATE POLICY "Directors can view users" ON user_profiles
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('director', 'supervisor')
    )
  );

-- Users can view own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can update own profile (limited fields)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
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

### Phase 1: Database (2h) — DB Specialist
- [ ] Create migration file
- [ ] Add RLS policies
- [ ] Test policies manually

### Phase 2: API (3h) — Code Writer
- [ ] GET /api/users
- [ ] POST /api/users
- [ ] PATCH /api/users/:id
- [ ] DELETE /api/users/:id

### Phase 3: UI (4h) — Code Writer
- [ ] UserList component
- [ ] AddUserModal
- [ ] EditUserModal
- [ ] /settings/users page
- [ ] Navigation link for Supervisor

### Phase 4: Security Review (1h) — Security
- [ ] Audit RLS policies
- [ ] Check API authorization
- [ ] Test edge cases

### Phase 5: QA (2h) — QA
- [ ] Full testing checklist
- [ ] Cross-browser testing
- [ ] Mobile responsiveness

---

**Created by:** Runner (Architect)  
**Status:** ✅ SPECIFICATION COMPLETE  
**Next Step:** DB Specialist creates migration

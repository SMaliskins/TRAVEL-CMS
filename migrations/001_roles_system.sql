-- ============================================
-- MIGRATION: Roles System
-- Date: 2026-01-12
-- Description: Dynamic roles with permissions
-- ============================================

-- ============================================
-- PART 1: ROLES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- 'agent', 'supervisor', etc.
  display_name TEXT NOT NULL,          -- 'Агент', 'Супервайзер'
  display_name_en TEXT,                -- 'Agent', 'Supervisor'
  level INTEGER NOT NULL DEFAULT 1,    -- Hierarchy level (1-5)
  scope TEXT NOT NULL DEFAULT 'all'    -- 'own' | 'all'
    CHECK (scope IN ('own', 'all')),
  description TEXT,
  color TEXT DEFAULT '#6B7280',        -- Badge color (gray-500)
  is_system BOOLEAN DEFAULT false,     -- Cannot be deleted if true
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 2: DEFAULT ROLES
-- ============================================

INSERT INTO public.roles (name, display_name, display_name_en, level, scope, color, is_system, description) VALUES
  ('subagent', 'Субагент', 'Subagent', 1, 'own', '#9CA3AF', true, 'Партнёр, видит только свои заказы'),
  ('agent', 'Агент', 'Agent', 2, 'all', '#3B82F6', true, 'Основной сотрудник, все заказы'),
  ('accountant', 'Бухгалтер', 'Accountant', 3, 'all', '#10B981', true, 'Финансы, платежи, отчёты'),
  ('director', 'Директор', 'Director', 4, 'all', '#8B5CF6', true, 'Все данные + настройки компании'),
  ('supervisor', 'Супервайзер', 'Supervisor', 5, 'all', '#EF4444', true, 'Полный доступ + управление пользователями')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name_en = EXCLUDED.display_name_en,
  level = EXCLUDED.level,
  scope = EXCLUDED.scope,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================
-- PART 3: ROLE PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,            -- 'orders.view', 'users.manage'
  scope TEXT DEFAULT 'all'             -- Override scope: 'own' | 'all'
    CHECK (scope IN ('own', 'all')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission)
);

-- ============================================
-- PART 4: DEFAULT PERMISSIONS
-- ============================================

-- Helper function to get role_id by name
CREATE OR REPLACE FUNCTION get_role_id(role_name TEXT) RETURNS UUID AS $$
  SELECT id FROM public.roles WHERE name = role_name;
$$ LANGUAGE SQL;

-- SUPERVISOR permissions (all)
INSERT INTO public.role_permissions (role_id, permission, scope)
SELECT get_role_id('supervisor'), permission, 'all'
FROM unnest(ARRAY[
  'orders.view', 'orders.create', 'orders.edit', 'orders.delete',
  'services.view', 'services.create', 'services.edit', 'services.delete',
  'services.price.view', 'services.margin.view',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.send',
  'payments.view', 'payments.create', 'payments.edit',
  'reports.view', 'reports.export',
  'directory.view', 'directory.create', 'directory.edit', 'directory.delete',
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'settings.company', 'settings.system'
]) AS permission
ON CONFLICT (role_id, permission) DO NOTHING;

-- DIRECTOR permissions (all except users.manage and settings.system)
INSERT INTO public.role_permissions (role_id, permission, scope)
SELECT get_role_id('director'), permission, 'all'
FROM unnest(ARRAY[
  'orders.view', 'orders.create', 'orders.edit', 'orders.delete',
  'services.view', 'services.create', 'services.edit', 'services.delete',
  'services.price.view', 'services.margin.view',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.send',
  'payments.view', 'payments.create', 'payments.edit',
  'reports.view', 'reports.export',
  'directory.view', 'directory.create', 'directory.edit', 'directory.delete',
  'users.view',
  'settings.company'
]) AS permission
ON CONFLICT (role_id, permission) DO NOTHING;

-- ACCOUNTANT permissions (finance focus)
INSERT INTO public.role_permissions (role_id, permission, scope)
SELECT get_role_id('accountant'), permission, 'all'
FROM unnest(ARRAY[
  'orders.view', 'orders.create', 'orders.edit',
  'services.view', 'services.create', 'services.edit',
  'services.price.view', 'services.margin.view',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.send',
  'payments.view', 'payments.create', 'payments.edit',
  'reports.view', 'reports.export',
  'directory.view', 'directory.create', 'directory.edit'
]) AS permission
ON CONFLICT (role_id, permission) DO NOTHING;

-- AGENT permissions (all orders, no reports)
INSERT INTO public.role_permissions (role_id, permission, scope)
SELECT get_role_id('agent'), permission, 'all'
FROM unnest(ARRAY[
  'orders.view', 'orders.create', 'orders.edit',
  'services.view', 'services.create', 'services.edit',
  'services.price.view', 'services.margin.view',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.send',
  'payments.view', 'payments.create', 'payments.edit',
  'directory.view', 'directory.create', 'directory.edit'
]) AS permission
ON CONFLICT (role_id, permission) DO NOTHING;

-- SUBAGENT permissions (own only)
INSERT INTO public.role_permissions (role_id, permission, scope)
SELECT get_role_id('subagent'), permission, 'own'
FROM unnest(ARRAY[
  'orders.view', 'orders.create', 'orders.edit',
  'services.view', 'services.create', 'services.edit',
  'services.price.view', 'services.margin.view',
  'invoices.view', 'invoices.create',
  'payments.view', 'payments.create',
  'directory.view', 'directory.create', 'directory.edit'
]) AS permission
ON CONFLICT (role_id, permission) DO NOTHING;

-- ============================================
-- PART 5: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_level ON public.roles(level);
CREATE INDEX IF NOT EXISTS idx_roles_active ON public.roles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission);

-- ============================================
-- PART 6: RLS POLICIES
-- ============================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Roles are readable by all authenticated users
DROP POLICY IF EXISTS "Roles readable by all" ON public.roles;
CREATE POLICY "Roles readable by all" ON public.roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Role permissions readable by all authenticated users
DROP POLICY IF EXISTS "Role permissions readable by all" ON public.role_permissions;
CREATE POLICY "Role permissions readable by all" ON public.role_permissions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service_role can modify roles (via API)
DROP POLICY IF EXISTS "Service role manages roles" ON public.roles;
CREATE POLICY "Service role manages roles" ON public.roles
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages role permissions" ON public.role_permissions;
CREATE POLICY "Service role manages role permissions" ON public.role_permissions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PART 7: HELPER FUNCTIONS
-- ============================================

-- Get user's role level
CREATE OR REPLACE FUNCTION public.get_user_role_level(user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(r.level, 0)
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON u.id = up.id
  LEFT JOIN public.roles r ON up.role_id = r.id
  WHERE u.id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, required_permission TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.role_permissions rp ON up.role_id = rp.role_id
    WHERE up.id = user_id
      AND rp.permission = required_permission
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- DONE
-- ============================================

COMMENT ON TABLE public.roles IS 'System roles with hierarchy levels';
COMMENT ON TABLE public.role_permissions IS 'Permissions assigned to each role';

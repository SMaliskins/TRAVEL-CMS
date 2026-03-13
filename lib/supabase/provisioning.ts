import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SUPABASE_API = "https://api.supabase.com/v1";

function getAccessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set");
  return token;
}

function getOrgSlug(): string {
  const slug = process.env.SUPABASE_ORG_SLUG;
  if (!slug) throw new Error("SUPABASE_ORG_SLUG is not set");
  return slug;
}

function headers() {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    "Content-Type": "application/json",
  };
}

// ── Types ──────────────────────────────────────────────

export interface ProjectCredentials {
  projectRef: string;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  region: string;
  status: string;
}

interface SupabaseProjectResponse {
  id: string;
  ref: string;
  name: string;
  region: string;
  status: string;
  organization_id: string;
}

interface ApiKeyResponse {
  api_key: string;
  name: string;
  id: string;
}

// ── Project Lifecycle ──────────────────────────────────

export async function createProject(
  companyName: string,
  region: string = "eu-central-1"
): Promise<{ projectRef: string; region: string }> {
  const dbPassword = generateSecurePassword();

  const res = await fetch(`${SUPABASE_API}/projects`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: sanitizeProjectName(companyName),
      organization_slug: getOrgSlug(),
      db_pass: dbPassword,
      region,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Supabase project: ${res.status} ${err}`);
  }

  const project: SupabaseProjectResponse = await res.json();

  return {
    projectRef: project.ref,
    region: project.region,
  };
}

export async function waitForProjectReady(
  projectRef: string,
  maxWaitMs: number = 120_000
): Promise<void> {
  const start = Date.now();
  const pollInterval = 5_000;

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${SUPABASE_API}/projects/${projectRef}`, {
      headers: headers(),
    });

    if (res.ok) {
      const project: SupabaseProjectResponse = await res.json();
      if (project.status === "ACTIVE_HEALTHY") return;
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(`Project ${projectRef} did not become ready within ${maxWaitMs / 1000}s`);
}

export async function getProjectApiKeys(
  projectRef: string
): Promise<{ anonKey: string; serviceRoleKey: string }> {
  const res = await fetch(`${SUPABASE_API}/projects/${projectRef}/api-keys?reveal=true`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Failed to get API keys: ${res.status}`);
  }

  const keys: ApiKeyResponse[] = await res.json();
  const anon = keys.find((k) => k.name === "anon" || k.name === "anon key");
  const service = keys.find((k) => k.name === "service_role" || k.name === "service_role key");

  if (!anon || !service) {
    throw new Error("Could not find anon or service_role keys");
  }

  return {
    anonKey: anon.api_key,
    serviceRoleKey: service.api_key,
  };
}

export async function pauseProject(projectRef: string): Promise<void> {
  const res = await fetch(`${SUPABASE_API}/projects/${projectRef}/pause`, {
    method: "POST",
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to pause project: ${res.status} ${err}`);
  }
}

export async function restoreProject(projectRef: string): Promise<void> {
  const res = await fetch(`${SUPABASE_API}/projects/${projectRef}/restore`, {
    method: "POST",
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to restore project: ${res.status} ${err}`);
  }
}

export async function deleteProject(projectRef: string): Promise<void> {
  const res = await fetch(`${SUPABASE_API}/projects/${projectRef}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete project: ${res.status} ${err}`);
  }
}

// ── Schema Initialization ──────────────────────────────

export async function applySchemaToProject(
  projectUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const schema = getFullSchema();
  const statements = splitSqlStatements(schema);

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;

    const { error } = await client.rpc("exec_sql", { query: trimmed }).single();
    if (error) {
      console.error(`Schema statement failed: ${trimmed.slice(0, 100)}...`, error);
    }
  }
}

// ── Full Provisioning Orchestrator ─────────────────────

export async function provisionCompanyDatabase(
  companyId: string,
  companyName: string,
  region: string = "eu-central-1"
): Promise<ProjectCredentials> {
  await supabaseAdmin
    .from("companies")
    .update({ supabase_status: "provisioning" })
    .eq("id", companyId);

  try {
    const { projectRef, region: actualRegion } = await createProject(companyName, region);

    await waitForProjectReady(projectRef);

    const keys = await getProjectApiKeys(projectRef);
    const projectUrl = `https://${projectRef}.supabase.co`;

    await applySchemaToProject(projectUrl, keys.serviceRoleKey);

    await supabaseAdmin
      .from("companies")
      .update({
        supabase_project_ref: projectRef,
        supabase_url: projectUrl,
        supabase_anon_key: keys.anonKey,
        supabase_service_role_key: keys.serviceRoleKey,
        supabase_configured: true,
        supabase_status: "active",
        supabase_region: actualRegion,
      })
      .eq("id", companyId);

    return {
      projectRef,
      url: projectUrl,
      anonKey: keys.anonKey,
      serviceRoleKey: keys.serviceRoleKey,
      region: actualRegion,
      status: "active",
    };
  } catch (error) {
    await supabaseAdmin
      .from("companies")
      .update({ supabase_status: "none" })
      .eq("id", companyId);

    throw error;
  }
}

// ── Suspend / Reactivate ───────────────────────────────

export async function suspendCompanyDatabase(companyId: string): Promise<void> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("supabase_project_ref")
    .eq("id", companyId)
    .single();

  if (!company?.supabase_project_ref) return;

  await pauseProject(company.supabase_project_ref);

  await supabaseAdmin
    .from("companies")
    .update({ supabase_status: "paused" })
    .eq("id", companyId);
}

export async function reactivateCompanyDatabase(companyId: string): Promise<void> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("supabase_project_ref")
    .eq("id", companyId)
    .single();

  if (!company?.supabase_project_ref) return;

  await restoreProject(company.supabase_project_ref);

  await supabaseAdmin
    .from("companies")
    .update({ supabase_status: "active" })
    .eq("id", companyId);
}

export async function archiveCompanyDatabase(companyId: string): Promise<void> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("supabase_project_ref")
    .eq("id", companyId)
    .single();

  if (!company?.supabase_project_ref) return;

  await deleteProject(company.supabase_project_ref);

  await supabaseAdmin
    .from("companies")
    .update({
      supabase_status: "archived",
      supabase_configured: false,
      supabase_project_ref: null,
      supabase_url: null,
      supabase_anon_key: null,
      supabase_service_role_key: null,
    })
    .eq("id", companyId);
}

// ── Storage Usage ──────────────────────────────────────

export interface StorageUsage {
  storageUsedBytes: number;
  dbSizeBytes: number;
}

export async function getProjectStorageUsage(projectRef: string): Promise<StorageUsage> {
  const res = await fetch(`${SUPABASE_API}/projects/${projectRef}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Failed to get project info: ${res.status}`);
  }

  const project = await res.json();

  return {
    storageUsedBytes: project.storage_used_bytes || 0,
    dbSizeBytes: project.db_size_bytes || 0,
  };
}

// ── Helpers ────────────────────────────────────────────

function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 24;
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getFullSchema(): string {
  // Base Travel CMS schema for a fresh company Supabase project.
  // This is a simplified version — full schema should be generated from supabase_schema.sql + migrations.
  // For now, returns the essential tables needed for the CMS to work.
  return `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table (single row — this agency)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- User profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  email text,
  first_name text,
  last_name text,
  role text DEFAULT 'agent',
  phone text,
  avatar_url text,
  email_signature text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Parties (clients and partners)
CREATE TABLE IF NOT EXISTS public.party_person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  first_name text,
  last_name text,
  email text,
  phone text,
  date_of_birth date,
  nationality text,
  passport_number text,
  passport_expiry date,
  passport_country text,
  gender text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.party_company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  registration_number text,
  vat_number text,
  address text,
  email text,
  phone text,
  role text DEFAULT 'client',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  order_code text NOT NULL,
  status text DEFAULT 'active',
  date_from date,
  date_to date,
  destination text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order services
CREATE TABLE IF NOT EXISTS public.order_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  category text NOT NULL,
  name text,
  supplier text,
  date_from date,
  date_to date,
  cost numeric(12,2) DEFAULT 0,
  sale_price numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'EUR',
  res_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  order_id uuid REFERENCES public.orders(id),
  invoice_number text,
  status text DEFAULT 'draft',
  total_amount numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'EUR',
  issue_date date,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Directory
CREATE TABLE IF NOT EXISTS public.directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  type text NOT NULL,
  party_person_id uuid REFERENCES public.party_person(id),
  party_company_id uuid REFERENCES public.party_company(id),
  role text DEFAULT 'client',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory ENABLE ROW LEVEL SECURITY;

-- RLS: users see only their company's data
CREATE POLICY "users_own_company" ON public.user_profiles FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "party_person_own_company" ON public.party_person FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "party_company_own_company" ON public.party_company FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "orders_own_company" ON public.orders FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "order_services_own_company" ON public.order_services FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "invoices_own_company" ON public.invoices FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "directory_own_company" ON public.directory FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('boarding-passes', 'boarding-passes', false) ON CONFLICT DO NOTHING;
  `;
}

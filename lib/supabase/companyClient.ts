import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface CachedClient {
  client: SupabaseClient;
  createdAt: number;
}

const clientCache = new Map<string, CachedClient>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of clientCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      clientCache.delete(key);
    }
  }
}

function evictLRU() {
  if (clientCache.size <= MAX_CACHE_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of clientCache) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }
  if (oldestKey) clientCache.delete(oldestKey);
}

/**
 * Returns a Supabase admin client for a specific company.
 * If the company has a dedicated Supabase project, returns a client for that project.
 * Otherwise, returns the shared master supabaseAdmin.
 */
export async function getCompanySupabaseAdmin(companyId: string): Promise<SupabaseClient> {
  evictExpired();

  const cached = clientCache.get(companyId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.client;
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("supabase_configured, supabase_url, supabase_service_role_key, supabase_status")
    .eq("id", companyId)
    .single();

  if (!company?.supabase_configured || company.supabase_status !== "active") {
    return supabaseAdmin;
  }

  if (!company.supabase_url || !company.supabase_service_role_key) {
    return supabaseAdmin;
  }

  const client = createClient(company.supabase_url, company.supabase_service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  evictLRU();
  clientCache.set(companyId, { client, createdAt: Date.now() });

  return client;
}

/**
 * Returns a Supabase browser client for a specific company (anon key).
 * Used for client-side operations like auth and real-time subscriptions.
 */
export async function getCompanySupabaseClient(companyId: string): Promise<{
  url: string;
  anonKey: string;
  isDedicated: boolean;
}> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("supabase_configured, supabase_url, supabase_anon_key, supabase_status")
    .eq("id", companyId)
    .single();

  if (
    !company?.supabase_configured ||
    company.supabase_status !== "active" ||
    !company.supabase_url ||
    !company.supabase_anon_key
  ) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      isDedicated: false,
    };
  }

  return {
    url: company.supabase_url,
    anonKey: company.supabase_anon_key,
    isDedicated: true,
  };
}

/**
 * Invalidate the cached client for a company.
 * Call this when company credentials are updated.
 */
export function invalidateCompanyClient(companyId: string) {
  clientCache.delete(companyId);
}

/**
 * Clear all cached clients.
 */
export function clearClientCache() {
  clientCache.clear();
}

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client using service role key
 * This client bypasses RLS policies
 * 
 * WARNING: Only use on the server side (API routes, server actions)
 * Never expose the service role key to the client
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build";

// Create client with dummy key if not set (for build time)
// At runtime, if key is invalid, operations will fail with clear error
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper to check if service role key is actually set
export function isServiceRoleKeySet(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && 
         process.env.SUPABASE_SERVICE_ROLE_KEY !== "dummy-key-for-build";
}


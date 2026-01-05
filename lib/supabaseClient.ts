import { createClient, SupabaseClient } from "@supabase/supabase-js";

// These are inlined at BUILD TIME by Next.js
// If they show as undefined/placeholder in production, Vercel build didn't have access to them
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Track if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Log error but DON'T throw - let app render with error state
if (!isSupabaseConfigured) {
  const errorMsg = `
=== SUPABASE CONFIG ERROR ===
NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || "NOT SET"}
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "SET" : "NOT SET"}

This means environment variables were not available during Vercel build.
Fix: In Vercel Dashboard → Settings → Environment Variables:
1. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
2. Ensure they are enabled for "Production" environment
3. Redeploy (without build cache)
=============================`;
  
  console.error(errorMsg);
}

// Create client (with placeholder if not configured - will fail gracefully)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

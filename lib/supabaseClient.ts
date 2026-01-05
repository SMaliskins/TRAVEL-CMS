import { createClient, SupabaseClient } from "@supabase/supabase-js";

// These are inlined at BUILD TIME by Next.js
// If they show as undefined/placeholder in production, Vercel build didn't have access to them
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Runtime validation
if (!supabaseUrl || !supabaseAnonKey) {
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
  
  // Don't throw during SSR/build, only show error in browser
  if (typeof window !== "undefined") {
    throw new Error("Supabase not configured. Check console for details.");
  }
}

// Create client (with fallback for build time only)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

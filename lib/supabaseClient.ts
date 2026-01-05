import { createClient, SupabaseClient } from "@supabase/supabase-js";

// For build time, use placeholder. At runtime, env vars should be available.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Debug logging (only in browser)
if (typeof window !== "undefined") {
  console.log("=== SUPABASE CLIENT INIT ===");
  console.log("URL:", supabaseUrl);
  console.log("URL is placeholder:", supabaseUrl.includes("placeholder"));
  console.log("Key is set:", !!supabaseAnonKey && !supabaseAnonKey.includes("placeholder"));
  console.log("============================");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase URL:", supabaseUrl ? "SET" : "MISSING");
      console.error("Supabase Anon Key:", supabaseAnonKey ? "SET" : "MISSING");
      throw new Error("Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

// Export as getter to ensure lazy initialization
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  }
});

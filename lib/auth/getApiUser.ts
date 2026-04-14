import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export interface ApiUser {
  userId: string;
  companyId: string;
  role: string;
  scope: "own" | "all";
}

export async function getApiUser(request: NextRequest): Promise<ApiUser | null> {
  let authUser = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) authUser = data.user;
  }

  if (!authUser) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Cookie: cookieHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error && data?.user) authUser = data.user;
    }
  }

  if (!authUser) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id, is_active, role:roles(name)")
    .eq("id", authUser.id)
    .single();

  if (profile?.is_active === false) {
    return null;
  }

  // Fallback: profiles table (demo user, legacy setups)
  if (!profile?.company_id) {
    const { data: legacyProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id, role")
      .eq("user_id", authUser.id)
      .single();

    if (legacyProfile?.company_id) {
      const roleName = (legacyProfile.role as string) || "agent";
      const ownRoles = ["subagent", "agent", "manager"];
      const scope = ownRoles.includes(roleName) ? ("own" as const) : ("all" as const);
      return { userId: authUser.id, companyId: legacyProfile.company_id, role: roleName, scope };
    }
    return null;
  }

  const roleRaw = profile.role as unknown;
  const roleObj = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw as { name: string } | null;
  const roleName = roleObj?.name || "agent";
  const ownRoles = ["subagent", "agent", "manager"];
  const scope = ownRoles.includes(roleName) ? "own" as const : "all" as const;

  return { userId: authUser.id, companyId: profile.company_id, role: roleName, scope };
}

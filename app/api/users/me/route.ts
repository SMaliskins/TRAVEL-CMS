import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Get user from request
async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }

  return null;
}

// GET: Get current user info with role
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile with role using admin client (bypasses RLS)
    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        id,
        first_name,
        last_name,
        email,
        role_id,
        company_id,
        roles(id, name)
      `)
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Get user profile error:", error);
      return NextResponse.json({ error: "Failed to get profile" }, { status: 500 });
    }

    const roleName = (profile?.roles as { id: string; name: string } | null)?.name || null;

    return NextResponse.json({
      id: profile?.id,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      email: profile?.email,
      role_id: profile?.role_id,
      role: roleName,
      company_id: profile?.company_id,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

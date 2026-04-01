import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getUserAndCompany(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  let user = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) user = data.user;
  }

  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Cookie: cookieHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error && data?.user) user = data.user;
    }
  }

  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;
  return { userId: user.id, companyId: profile.company_id };
}

/**
 * GET /api/notifications/staff
 * ?unreadCount=true  → { unreadCount: number }
 * otherwise          → { notifications: [...], unreadCount: number }
 */
export async function GET(request: NextRequest) {
  const auth = await getUserAndCompany(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadCount") === "true";

  if (unreadOnly) {
    const { count } = await supabaseAdmin
      .from("staff_notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", auth.companyId)
      .eq("read", false);

    return NextResponse.json({ unreadCount: count || 0 });
  }

  const { data, error } = await supabaseAdmin
    .from("staff_notifications")
    .select("*")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  const { count } = await supabaseAdmin
    .from("staff_notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", auth.companyId)
    .eq("read", false);

  return NextResponse.json({ notifications: data || [], unreadCount: count || 0 });
}

/**
 * PATCH /api/notifications/staff
 * Body: { ids: string[] } or { markAllRead: true }
 */
export async function PATCH(request: NextRequest) {
  const auth = await getUserAndCompany(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.markAllRead) {
    const { error } = await supabaseAdmin
      .from("staff_notifications")
      .update({ read: true })
      .eq("company_id", auth.companyId)
      .eq("read", false);

    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { error } = await supabaseAdmin
      .from("staff_notifications")
      .update({ read: true })
      .eq("company_id", auth.companyId)
      .in("id", body.ids);

    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide ids[] or markAllRead" }, { status: 400 });
}

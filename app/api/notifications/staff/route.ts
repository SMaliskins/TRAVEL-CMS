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

function extractSystemUpdateVersion(refId: string | null | undefined): string | null {
  const match = refId?.match(/^system_update:(.+)$/);
  return match?.[1] ?? null;
}

async function getReadSystemUpdateVersions(companyId: string, userId: string, versions: string[]) {
  const uniqueVersions = [...new Set(versions.filter(Boolean))];
  if (uniqueVersions.length === 0) return new Set<string>();

  const { data } = await supabaseAdmin
    .from("release_views")
    .select("release_version")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .not("read_at", "is", null)
    .in("release_version", uniqueVersions);

  return new Set((data || []).map((row) => row.release_version as string));
}

async function markSystemUpdatesRead(companyId: string, userId: string, versions: string[]) {
  const uniqueVersions = [...new Set(versions.filter(Boolean))];
  if (uniqueVersions.length === 0) return;

  const now = new Date().toISOString();
  await supabaseAdmin.from("release_views").upsert(
    uniqueVersions.map((releaseVersion) => ({
      company_id: companyId,
      release_version: releaseVersion,
      user_id: userId,
      seen_at: now,
      read_at: now,
    })),
    { onConflict: "company_id,release_version,user_id" }
  );
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
    const { data: systemUpdates } = await supabaseAdmin
      .from("staff_notifications")
      .select("id, ref_id")
      .eq("company_id", auth.companyId)
      .eq("type", "system_update");

    const systemVersions = (systemUpdates || [])
      .map((n) => extractSystemUpdateVersion(n.ref_id as string | null))
      .filter((v): v is string => !!v);
    const readSystemVersions = await getReadSystemUpdateVersions(
      auth.companyId,
      auth.userId,
      systemVersions
    );
    const unreadSystemCount = systemVersions.filter((v) => !readSystemVersions.has(v)).length;

    const { count } = await supabaseAdmin
      .from("staff_notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", auth.companyId)
      .neq("type", "system_update")
      .eq("read", false);

    return NextResponse.json({ unreadCount: (count || 0) + unreadSystemCount });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
  const typeFilter = searchParams.get("type");

  let query = supabaseAdmin
    .from("staff_notifications")
    .select("*")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  const systemVersions = (data || [])
    .filter((n) => n.type === "system_update")
    .map((n) => extractSystemUpdateVersion(n.ref_id))
    .filter((v): v is string => !!v);
  const readSystemVersions = await getReadSystemUpdateVersions(
    auth.companyId,
    auth.userId,
    systemVersions
  );

  const notifications = (data || []).map((n) => {
    if (n.type !== "system_update") return n;
    const version = extractSystemUpdateVersion(n.ref_id);
    return { ...n, read: version ? readSystemVersions.has(version) : n.read };
  });

  const { count } = await supabaseAdmin
    .from("staff_notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", auth.companyId)
    .neq("type", "system_update")
    .eq("read", false);

  const unreadSystemCount = notifications.filter((n) => n.type === "system_update" && !n.read).length;

  return NextResponse.json({ notifications, unreadCount: (count || 0) + unreadSystemCount });
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
    const { data: toRead } = await supabaseAdmin
      .from("staff_notifications")
      .select("ref_id, type")
      .eq("company_id", auth.companyId)
      .eq("read", false);
    const { data: allSystemUpdates } = await supabaseAdmin
      .from("staff_notifications")
      .select("ref_id")
      .eq("company_id", auth.companyId)
      .eq("type", "system_update");
    const versions = (allSystemUpdates || [])
      .map((n) => extractSystemUpdateVersion(n.ref_id as string | null))
      .filter((v): v is string => !!v);

    const { error } = await supabaseAdmin
      .from("staff_notifications")
      .update({ read: true })
      .eq("company_id", auth.companyId)
      .neq("type", "system_update")
      .eq("read", false);

    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    await markSystemUpdatesRead(auth.companyId, auth.userId, versions);
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { data: toRead } = await supabaseAdmin
      .from("staff_notifications")
      .select("id, ref_id, type")
      .eq("company_id", auth.companyId)
      .in("id", body.ids);
    const versions = (toRead || [])
      .filter((n) => n.type === "system_update")
      .map((n) => extractSystemUpdateVersion(n.ref_id as string | null))
      .filter((v): v is string => !!v);
    const nonSystemIds = (toRead || [])
      .filter((n) => n.type !== "system_update")
      .map((n) => n.id as string);

    if (nonSystemIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("staff_notifications")
        .update({ read: true })
        .eq("company_id", auth.companyId)
        .in("id", nonSystemIds);

      if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
    await markSystemUpdatesRead(auth.companyId, auth.userId, versions);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide ids[] or markAllRead" }, { status: 400 });
}

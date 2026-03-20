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
  if (!user && request.headers.get("cookie")) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: request.headers.get("cookie") || "" } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) user = data.user;
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
 * GET /api/notifications/release-stats?releaseVersion=2026-03-20
 * Returns: { seenCount, readCount, reactions: { like: n, love: n, ... }, reactionDetails: [ { emoji, userId, displayName } ] }
 */
export async function GET(request: NextRequest) {
  const auth = await getUserAndCompany(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const releaseVersion = request.nextUrl.searchParams.get("releaseVersion");
  if (!releaseVersion) {
    return NextResponse.json({ error: "releaseVersion required" }, { status: 400 });
  }

  const [viewsRes, reactionsRes] = await Promise.all([
    supabaseAdmin
      .from("release_views")
      .select("user_id, seen_at, read_at")
      .eq("company_id", auth.companyId)
      .eq("release_version", releaseVersion),
    supabaseAdmin
      .from("release_reactions")
      .select("user_id, emoji")
      .eq("company_id", auth.companyId)
      .eq("release_version", releaseVersion),
  ]);

  if (viewsRes.error) {
    console.error("release-stats views error:", viewsRes.error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
  if (reactionsRes.error) {
    console.error("release-stats reactions error:", reactionsRes.error);
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }

  const views = viewsRes.data || [];
  const reactions = reactionsRes.data || [];
  const seenCount = views.length;
  const readCount = views.filter((v) => v.read_at != null).length;

  const reactionsSummary: Record<string, number> = {};
  for (const r of reactions) {
    reactionsSummary[r.emoji] = (reactionsSummary[r.emoji] || 0) + 1;
  }

  const userIds = [...new Set(reactions.map((r) => r.user_id))];
  let reactionDetails: { emoji: string; userId: string; displayName: string }[] = [];
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);
    const map = new Map((profiles || []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "—"]));
    reactionDetails = reactions.map((r) => ({
      emoji: r.emoji,
      userId: r.user_id,
      displayName: map.get(r.user_id) || "—",
    }));
  }

  return NextResponse.json({
    seenCount,
    readCount,
    reactions: reactionsSummary,
    reactionDetails,
  });
}

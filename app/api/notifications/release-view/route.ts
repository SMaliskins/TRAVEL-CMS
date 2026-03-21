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
 * POST /api/notifications/release-view
 * Body: { releaseVersion: string } e.g. "2026-03-20"
 * Records that the user has seen (expanded) this release. Upserts release_views with seen_at = now().
 */
export async function POST(request: NextRequest) {
  const auth = await getUserAndCompany(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const releaseVersion = body?.releaseVersion;
  if (!releaseVersion || typeof releaseVersion !== "string") {
    return NextResponse.json({ error: "releaseVersion required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("release_views")
    .upsert(
      {
        company_id: auth.companyId,
        release_version: releaseVersion,
        user_id: auth.userId,
        seen_at: new Date().toISOString(),
      },
      { onConflict: "company_id,release_version,user_id" }
    );

  if (error) {
    console.error("release-view POST error:", error);
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const ALLOWED_EMOJIS = ["like", "love", "wow", "celebrate", "thumbsup"] as const;

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
 * POST /api/notifications/release-reaction
 * Body: { releaseVersion: string, emoji: string } — emoji one of: like, love, wow, celebrate, thumbsup
 * Upserts the current user's reaction (one per user per release).
 */
export async function POST(request: NextRequest) {
  const auth = await getUserAndCompany(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const releaseVersion = body?.releaseVersion;
  const emoji = body?.emoji;
  if (!releaseVersion || typeof releaseVersion !== "string") {
    return NextResponse.json({ error: "releaseVersion required" }, { status: 400 });
  }
  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "emoji must be one of: " + ALLOWED_EMOJIS.join(", ") }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("release_reactions")
    .upsert(
      {
        company_id: auth.companyId,
        release_version: releaseVersion,
        user_id: auth.userId,
        emoji,
      },
      { onConflict: "company_id,release_version,user_id" }
    );

  if (error) {
    console.error("release-reaction POST error:", error);
    return NextResponse.json({ error: "Failed to save reaction" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/notifications/release-reaction?releaseVersion=2026-03-20
 * Removes the current user's reaction for the release (toggle off, Instagram-style).
 */
export async function DELETE(request: NextRequest) {
  const auth = await getUserAndCompany(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const releaseVersion = request.nextUrl.searchParams.get("releaseVersion");
  if (!releaseVersion) {
    return NextResponse.json({ error: "releaseVersion required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("release_reactions")
    .delete()
    .eq("company_id", auth.companyId)
    .eq("release_version", releaseVersion)
    .eq("user_id", auth.userId);

  if (error) {
    console.error("release-reaction DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove reaction" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

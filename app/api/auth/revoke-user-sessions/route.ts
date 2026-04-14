import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { ROLES } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminAuth = {
  signOutUser?: (userId: string) => Promise<{ error: { message: string } | null }>;
};

/**
 * POST /api/auth/revoke-user-sessions
 * Body: { userId: string }
 * Supervisor: revoke all Supabase refresh tokens for that user (all devices) and delete heartbeat rows.
 */
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (apiUser.role !== ROLES.SUPERVISOR) {
      return NextResponse.json({ error: "Forbidden: Supervisor role required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const { data: target, error: profErr } = await supabaseAdmin
      .from("user_profiles")
      .select("id, company_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profErr || !target || (target as { company_id?: string }).company_id !== apiUser.companyId) {
      return NextResponse.json({ error: "User not found in your company" }, { status: 404 });
    }

    const adminAuth = supabaseAdmin.auth.admin as AdminAuth;
    if (typeof adminAuth.signOutUser !== "function") {
      console.error("[revoke-user-sessions] auth.admin.signOutUser not available");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { error: signErr } = await adminAuth.signOutUser(targetUserId);
    if (signErr) {
      console.error("[revoke-user-sessions] signOutUser", signErr);
      return NextResponse.json({ error: signErr.message || "Failed to revoke sessions" }, { status: 500 });
    }

    const { error: delErr } = await supabaseAdmin
      .from("user_auth_sessions")
      .delete()
      .eq("user_id", targetUserId)
      .eq("company_id", apiUser.companyId);

    if (delErr) {
      console.warn("[revoke-user-sessions] delete rows", delErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[revoke-user-sessions]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

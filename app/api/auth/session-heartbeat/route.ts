import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { getRequestClientIp } from "@/lib/auth/requestClientIp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/auth/session-heartbeat
 * Authenticated staff: upsert presence row for this browser (device id + user agent + IP).
 */
export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const raw = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (raw.length < 8 || raw.length > 128) {
      return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
    }

    const ua = (request.headers.get("user-agent") || "").slice(0, 512);
    const ip = getRequestClientIp(request);
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin.from("user_auth_sessions").upsert(
      {
        user_id: apiUser.userId,
        company_id: apiUser.companyId,
        device_fingerprint: raw,
        user_agent: ua || null,
        ip_address: ip,
        last_seen_at: now,
      },
      { onConflict: "user_id,device_fingerprint" }
    );

    if (error) {
      console.error("[session-heartbeat]", error);
      return NextResponse.json({ error: "Failed to record session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[session-heartbeat]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { ROLES } from "@/lib/auth/roles";
import { deviceLabelFromUserAgent } from "@/lib/auth/deviceLabelFromUa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACTIVE_MS = 10 * 60 * 1000;

/**
 * GET /api/auth/company-sessions
 * Supervisor: list recent staff sessions for the company (from heartbeat table).
 */
export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (apiUser.role !== ROLES.SUPERVISOR) {
      return NextResponse.json({ error: "Forbidden: Supervisor role required" }, { status: 403 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("user_auth_sessions")
      .select("id, user_id, device_fingerprint, user_agent, ip_address, last_seen_at, created_at")
      .eq("company_id", apiUser.companyId)
      .order("last_seen_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[company-sessions]", error);
      return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
    }

    const list = rows || [];
    const userIds = [...new Set(list.map((r) => r.user_id as string))];

    const { data: profiles } =
      userIds.length === 0
        ? { data: [] as { id: string; first_name?: string | null; last_name?: string | null }[] }
        : await supabaseAdmin
            .from("user_profiles")
            .select("id, first_name, last_name")
            .eq("company_id", apiUser.companyId)
            .in("id", userIds);

    const nameByUser = new Map<string, string>();
    for (const p of profiles || []) {
      const pr = p as { id: string; first_name?: string | null; last_name?: string | null };
      const name = [pr.first_name, pr.last_name].filter(Boolean).join(" ").trim() || "—";
      nameByUser.set(pr.id, name);
    }

    const emailMap = new Map<string, string>();
    const { data: listAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of listAuth?.users || []) {
      if (userIds.includes(u.id)) emailMap.set(u.id, u.email || "");
    }

    const now = Date.now();
    const sessions = list.map((r) => {
      const last = r.last_seen_at ? new Date(r.last_seen_at as string).getTime() : 0;
      const active = now - last < ACTIVE_MS;
      const ua = (r.user_agent as string) || "";
      return {
        id: r.id,
        userId: r.user_id,
        userName: nameByUser.get(r.user_id as string) || "—",
        email: emailMap.get(r.user_id as string) || "",
        deviceLabel: deviceLabelFromUserAgent(ua),
        userAgent: ua,
        ipAddress: (r.ip_address as string) || null,
        lastSeenAt: r.last_seen_at,
        createdAt: r.created_at,
        active,
      };
    });

    return NextResponse.json({ sessions });
  } catch (e) {
    console.error("[company-sessions]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

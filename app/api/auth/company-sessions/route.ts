import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { ROLES } from "@/lib/auth/roles";
import { deviceLabelFromUserAgent } from "@/lib/auth/deviceLabelFromUa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ACTIVE_MS = 10 * 60 * 1000;

type SessionRow = {
  id: string;
  user_id: string;
  user_agent: string | null;
  ip_address: string | null;
  last_seen_at: string | null;
};

/**
 * GET /api/auth/company-sessions
 * Supervisor: all company users with presence (heartbeat) and/or Auth last sign-in.
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

    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name, is_active")
      .eq("company_id", apiUser.companyId)
      .order("first_name", { ascending: true });

    if (profErr) {
      console.error("[company-sessions] profiles", profErr);
      return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
    }

    const profileList = profiles || [];
    const profileIds = new Set(profileList.map((p) => (p as { id: string }).id));

    const { data: sessionRows, error: sessErr } = await supabaseAdmin
      .from("user_auth_sessions")
      .select("id, user_id, user_agent, ip_address, last_seen_at")
      .eq("company_id", apiUser.companyId)
      .order("last_seen_at", { ascending: false })
      .limit(2000);

    if (sessErr) {
      console.error("[company-sessions] sessions", sessErr);
      return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
    }

    const byUser = new Map<string, SessionRow[]>();
    for (const r of sessionRows || []) {
      const row = r as SessionRow;
      const uid = row.user_id;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(row);
    }

    const authUsers: { id: string; email?: string; last_sign_in_at?: string | null }[] = [];
    let page = 1;
    for (;;) {
      const { data: pageData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      const batch = pageData?.users || [];
      if (batch.length === 0) break;
      authUsers.push(...batch);
      if (batch.length < 1000) break;
      page += 1;
    }

    const emailMap = new Map<string, string>();
    const lastSignInMap = new Map<string, string | null>();
    for (const u of authUsers) {
      if (!profileIds.has(u.id)) continue;
      emailMap.set(u.id, u.email || "");
      lastSignInMap.set(u.id, u.last_sign_in_at ?? null);
    }

    const now = Date.now();
    const users = profileList.map((p) => {
      const pr = p as { id: string; first_name?: string | null; last_name?: string | null; is_active?: boolean | null };
      const uid = pr.id;
      const userName = [pr.first_name, pr.last_name].filter(Boolean).join(" ").trim() || "—";
      const sessions = (byUser.get(uid) || []).slice();
      sessions.sort((a, b) => {
        const ta = new Date(a.last_seen_at || 0).getTime();
        const tb = new Date(b.last_seen_at || 0).getTime();
        return tb - ta;
      });

      const latest = sessions[0];
      const heartbeatAt = latest?.last_seen_at ?? null;
      const lastSignInAt = lastSignInMap.get(uid) ?? null;

      const hbTime = heartbeatAt ? new Date(heartbeatAt).getTime() : 0;
      const active = hbTime > 0 && now - hbTime < ACTIVE_MS;

      const deviceCount = sessions.length;
      let devicesLabel = "—";
      if (deviceCount === 1) {
        devicesLabel = deviceLabelFromUserAgent(sessions[0].user_agent || "");
      } else if (deviceCount > 1) {
        const first = deviceLabelFromUserAgent(sessions[0].user_agent || "");
        devicesLabel = `${first} +${deviceCount - 1}`;
      }

      const ipHint = latest?.ip_address ? String(latest.ip_address) : null;

      return {
        userId: uid,
        userName,
        email: emailMap.get(uid) || "",
        isActiveProfile: pr.is_active !== false,
        deviceCount,
        devicesLabel,
        ipHint,
        heartbeatAt,
        lastSignInAt,
        active,
        hasHeartbeat: deviceCount > 0,
      };
    });

    return NextResponse.json({ users });
  } catch (e) {
    console.error("[company-sessions]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

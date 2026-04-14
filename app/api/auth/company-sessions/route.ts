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

function maxActivitySource(
  heartbeatAt: string | null,
  lastSignInAt: string | null,
  crmAt: string | null
): { at: string | null; source: "app" | "login" | "crm" } {
  const items: { at: string; source: "app" | "login" | "crm" }[] = [];
  if (heartbeatAt) items.push({ at: heartbeatAt, source: "app" });
  if (lastSignInAt) items.push({ at: lastSignInAt, source: "login" });
  if (crmAt) items.push({ at: crmAt, source: "crm" });
  if (items.length === 0) return { at: null, source: "login" };
  return items.reduce((a, b) => (new Date(a.at) > new Date(b.at) ? a : b));
}

/**
 * GET /api/auth/company-sessions
 * Supervisor: all company users — heartbeat, Auth last sign-in, and CRM (order_communications) last activity.
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

    const crmLastMap = new Map<string, string>();
    const { data: crmRpc, error: crmErr } = await supabaseAdmin.rpc("company_users_last_comm_activity", {
      p_company_id: apiUser.companyId,
    });
    if (crmErr) {
      console.warn("[company-sessions] CRM activity RPC (apply migrations/add_company_users_last_comm_activity_fn.sql):", crmErr.message);
    } else if (Array.isArray(crmRpc)) {
      for (const row of crmRpc) {
        const r = row as { user_id?: string; last_at?: string };
        if (r.user_id && r.last_at) crmLastMap.set(r.user_id, r.last_at);
      }
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
      const lastCrmAt = crmLastMap.get(uid) ?? null;
      const { at: lastActivityAt, source: lastActivitySource } = maxActivitySource(
        heartbeatAt,
        lastSignInAt,
        lastCrmAt
      );

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
        lastCrmAt,
        lastActivityAt,
        lastActivitySource,
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

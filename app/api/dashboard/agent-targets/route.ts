import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function getCompanyId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", userId)
    .single();
  return data?.company_id || null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "periodStart and periodEnd required" }, { status: 400 });
    }

    const { data: agents } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name, is_active, role_id, role:roles(name)")
      .eq("company_id", companyId);

    const { data: servicesData } = await supabaseAdmin
      .from("order_services")
      .select("client_price, service_price, res_status, category, commission_amount, vat_rate, orders!inner(company_id, created_at, owner_user_id, manager_user_id)")
      .eq("orders.company_id", companyId)
      .gte("orders.created_at", periodStart)
      .lte("orders.created_at", periodEnd + "T23:59:59");

    const agentProfit: Record<string, number> = {};

    for (const svc of servicesData || []) {
      if (svc.res_status === "cancelled") continue;

      const orderRaw = svc.orders as unknown;
      const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw as { owner_user_id?: string; manager_user_id?: string } | null;
      const agentId = order?.owner_user_id || order?.manager_user_id;
      if (!agentId) continue;

      const cp = parseFloat(svc.client_price?.toString() || "0");
      const sp = parseFloat(svc.service_price?.toString() || "0");
      const cat = ((svc.category as string) || "").toLowerCase();
      const isTour = cat.includes("tour") || cat.includes("package");
      const dbRate = Number(svc.vat_rate) || 0;
      const vatRate = dbRate > 0 ? dbRate : (cat.includes("flight") ? 0 : 21);

      let margin = 0;
      if (isTour && svc.commission_amount != null) {
        margin = cp - (sp - (Number(svc.commission_amount) || 0));
      } else {
        margin = cp - sp;
      }

      const vatAmount = vatRate > 0 && margin >= 0
        ? Math.round(margin * vatRate / (100 + vatRate) * 100) / 100
        : 0;

      const netProfit = margin - vatAmount;
      agentProfit[agentId] = (agentProfit[agentId] || 0) + netProfit;
    }

    const agentRoles = ["agent", "manager", "supervisor", "admin", "director"];
    const result = (agents || [])
      .filter((a) => {
        const roleRaw = a.role as unknown;
        const roleObj = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw as { name: string } | null;
        const roleName = (roleObj?.name || "").toLowerCase();
        return agentRoles.includes(roleName) && a.is_active !== false;
      })
      .map((a) => {
        const name = `${a.first_name || ""} ${a.last_name || ""}`.trim() || "—";
        const profit = Math.round((agentProfit[a.id] || 0) * 100) / 100;
        return { id: a.id, name, profit };
      })
      .sort((a, b) => b.profit - a.profit);

    return NextResponse.json({ agents: result });
  } catch (error) {
    console.error("Agent targets error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

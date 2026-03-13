import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "supervisor" && user.role !== "Supervisor") {
    return NextResponse.json({ error: "Supervisor only" }, { status: 403 });
  }

  const { data: company, error } = await supabaseAdmin
    .from("companies")
    .select(`
      id, name,
      tariff_plan_id, supabase_configured, supabase_status, supabase_region,
      subscription_status, storage_used_bytes, storage_checked_at
    `)
    .eq("id", user.companyId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let currentPlan = null;
  if (company?.tariff_plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("tariff_plans")
      .select("*")
      .eq("id", company.tariff_plan_id)
      .single();
    currentPlan = plan;
  }

  return NextResponse.json({ company, currentPlan });
}

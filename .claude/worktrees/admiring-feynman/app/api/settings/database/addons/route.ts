import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [addonsResult, companyAddonsResult] = await Promise.all([
    supabaseAdmin
      .from("plan_addons")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabaseAdmin
      .from("company_addons")
      .select("*")
      .eq("company_id", user.companyId)
      .eq("is_active", true),
  ]);

  if (addonsResult.error) {
    return NextResponse.json({ error: addonsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    addons: addonsResult.data || [],
    activeAddons: companyAddonsResult.data || [],
  });
}

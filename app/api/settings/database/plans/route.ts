import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: plans, error } = await supabaseAdmin
    .from("tariff_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans });
}

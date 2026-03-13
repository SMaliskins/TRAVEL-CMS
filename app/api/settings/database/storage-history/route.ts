import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "supervisor" && user.role !== "Supervisor") {
    return NextResponse.json({ error: "Supervisor only" }, { status: 403 });
  }

  const { data: history, error } = await supabaseAdmin
    .from("storage_usage_log")
    .select("checked_at, storage_used_bytes, storage_limit_bytes, db_size_bytes, usage_percent")
    .eq("company_id", user.companyId)
    .order("checked_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: history || [] });
}

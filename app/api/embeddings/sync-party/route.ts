import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const client = createClient(url, key);
  const { data: { user } } = await client.auth.getUser(token);
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    const companyId = profile?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "No company" }, { status: 403 });
    }

    const { data: parties } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("company_id", companyId);

    const ids = (parties || []).map((p: { id: string }) => p.id);
    const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const token = request.headers.get("authorization") || "";

    let synced = 0;
    let failed = 0;

    for (const partyId of ids) {
      try {
        const res = await fetch(`${base}/api/embeddings/upsert-party/${partyId}`, {
          method: "POST",
          headers: { Authorization: token },
        });
        if (res.ok) synced++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ synced, failed, total: ids.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

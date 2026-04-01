/**
 * POST /api/directory/bulk-archive
 * Archive multiple contacts (set status=inactive)
 * Body: { ids: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function getAuthInfo(request: NextRequest): Promise<{ companyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", data.user.id)
    .single();
  if (!profile?.company_id) return null;
  return { companyId: profile.company_id };
}

export async function POST(request: NextRequest) {
  const authInfo = await getAuthInfo(request);
  if (!authInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids = body.ids as string[];
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    const { data: parties, error: checkErr } = await supabaseAdmin
      .from("party")
      .select("id, company_id")
      .in("id", ids);

    if (checkErr || !parties) {
      return NextResponse.json(
        { error: "Failed to verify parties" },
        { status: 500 }
      );
    }

    const validIds = parties
      .filter((p) => p.company_id === authInfo.companyId)
      .map((p) => p.id);

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No parties found or access denied" },
        { status: 403 }
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from("party")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .in("id", validIds);

    if (updateErr) {
      console.error("[bulk-archive] Update error:", updateErr);
      return NextResponse.json(
        { error: "Archive failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ archived: validIds.length });
  } catch (error) {
    console.error("Bulk archive error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

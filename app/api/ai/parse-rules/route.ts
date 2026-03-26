import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * Parse Rules CRUD API
 *
 * GET  — list active rules for a document type
 * POST — create a new rule (admin/supervisor only)
 */

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("document_type");

  let query = supabaseAdmin
    .from("parse_rules")
    .select("*")
    .or(`company_id.eq.${apiUser.companyId},company_id.is.null`)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (documentType) {
    query = query.eq("document_type", documentType);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[parse-rules] GET error:", error);
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }

  return NextResponse.json({ rules: data || [] });
}

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only supervisor/admin can create rules
  if (!["supervisor", "admin"].includes(apiUser.role || "")) {
    return NextResponse.json({ error: "Only supervisors and admins can manage parse rules" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { document_type, rule_text, scope, rule_type, priority, example_before, example_after } = body;

    if (!document_type || !rule_text) {
      return NextResponse.json({ error: "document_type and rule_text are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("parse_rules")
      .insert({
        company_id: apiUser.companyId,
        document_type,
        rule_type: rule_type || "correction",
        scope: scope || null,
        priority: priority ?? 100,
        rule_text,
        example_before: example_before || null,
        example_after: example_after || null,
        created_by: apiUser.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("[parse-rules] POST error:", error);
      return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }

    return NextResponse.json({ rule: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

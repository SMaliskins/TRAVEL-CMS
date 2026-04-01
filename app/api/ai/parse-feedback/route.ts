import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * Parse Feedback API
 *
 * POST — submit user correction(s) for a parsed document
 * GET  — list feedback for a document type (admin view)
 *
 * Flow:
 * 1. User sees parsing result with errors
 * 2. User corrects fields → frontend sends corrections here
 * 3. Backend saves to parse_feedback
 * 4. Repeated corrections on the same field auto-create parse_rules (first correction onward for that field)
 */

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { document_type, corrections, detected_operator } = body;

    if (!document_type || !corrections || !Array.isArray(corrections) || corrections.length === 0) {
      return NextResponse.json(
        { error: "document_type and corrections[] are required" },
        { status: 400 }
      );
    }

    // Validate corrections format
    const rows = corrections.map((c: { field_name: string; old_value?: string; new_value?: string; comment?: string; feedback_type?: string }) => ({
      company_id: apiUser.companyId,
      user_id: apiUser.userId,
      document_type,
      field_name: c.field_name,
      old_value: c.old_value || null,
      new_value: c.new_value || null,
      feedback_type: c.feedback_type || "correction",
      comment: c.comment || null,
      detected_operator: detected_operator || null,
    }));

    const { data, error } = await supabaseAdmin
      .from("parse_feedback")
      .insert(rows)
      .select();

    if (error) {
      console.error("[parse-feedback] POST error:", error);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    // Auto-generate rule if same correction appears 3+ times
    await maybeAutoCreateRule(apiUser.companyId, document_type, corrections[0]?.field_name, detected_operator);

    return NextResponse.json({ feedback: data, count: data?.length || 0 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request);
  if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get("document_type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  let query = supabaseAdmin
    .from("parse_feedback")
    .select("*")
    .eq("company_id", apiUser.companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (documentType) {
    query = query.eq("document_type", documentType);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[parse-feedback] GET error:", error);
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 });
  }

  return NextResponse.json({ feedback: data || [] });
}

/**
 * If the same field correction appears at least once (per company / document type),
 * auto-create a parse_rule so future parsing gets it right.
 * Internal/meta fields (names starting with _) are skipped.
 */
async function maybeAutoCreateRule(
  companyId: string,
  documentType: string,
  fieldName: string | undefined,
  operator: string | undefined
): Promise<void> {
  if (!fieldName || fieldName.startsWith("_")) return;

  try {
    // Count similar corrections
    let query = supabaseAdmin
      .from("parse_feedback")
      .select("new_value", { count: "exact" })
      .eq("company_id", companyId)
      .eq("document_type", documentType)
      .eq("field_name", fieldName)
      .eq("is_resolved", false);

    if (operator) {
      query = query.eq("detected_operator", operator);
    }

    const { count } = await query;

    if ((count || 0) < 1) return;

    const { data: corrections } = await supabaseAdmin
      .from("parse_feedback")
      .select("new_value, old_value")
      .eq("company_id", companyId)
      .eq("document_type", documentType)
      .eq("field_name", fieldName)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!corrections || corrections.length < 1) return;

    // Check if a rule already exists for this field
    const { data: existing } = await supabaseAdmin
      .from("parse_rules")
      .select("id")
      .eq("company_id", companyId)
      .eq("document_type", documentType)
      .ilike("rule_text", `%${fieldName}%`)
      .eq("is_active", true)
      .limit(1);

    if (existing && existing.length > 0) return;

    // Create auto-rule
    const latest = corrections[0];
    const ruleText = `For field "${fieldName}": user corrected "${latest.old_value || "(empty)"}" to "${latest.new_value}". Always use "${latest.new_value}" for this pattern.`;

    await supabaseAdmin.from("parse_rules").insert({
      company_id: companyId,
      document_type: documentType,
      rule_type: "correction",
      scope: operator || null,
      priority: 50,
      rule_text: ruleText,
      example_before: latest.old_value || null,
      example_after: latest.new_value || null,
      source_feedback_count: count || 1,
    });

    // Mark corrections as resolved
    await supabaseAdmin
      .from("parse_feedback")
      .update({ is_resolved: true })
      .eq("company_id", companyId)
      .eq("document_type", documentType)
      .eq("field_name", fieldName)
      .eq("is_resolved", false);

    console.log(`[parse-feedback] Auto-created rule for ${documentType}.${fieldName} (${count} corrections)`);
  } catch (err) {
    console.warn("[parse-feedback] Auto-rule creation failed:", err);
  }
}

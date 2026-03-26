import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * Single parse rule operations
 *
 * PATCH  — update rule (toggle active, edit text)
 * DELETE — soft-delete (set is_active = false)
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const apiUser = await getApiUser(request);
  if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["supervisor", "admin"].includes(apiUser.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ruleId } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.rule_text !== undefined) updates.rule_text = body.rule_text;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.scope !== undefined) updates.scope = body.scope;

    const { data, error } = await supabaseAdmin
      .from("parse_rules")
      .update(updates)
      .eq("id", ruleId)
      .eq("company_id", apiUser.companyId)
      .select()
      .single();

    if (error) {
      console.error("[parse-rules] PATCH error:", error);
      return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
    }

    return NextResponse.json({ rule: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const apiUser = await getApiUser(request);
  if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["supervisor", "admin"].includes(apiUser.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ruleId } = await params;

  // Soft delete
  const { error } = await supabaseAdmin
    .from("parse_rules")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("company_id", apiUser.companyId);

  if (error) {
    console.error("[parse-rules] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

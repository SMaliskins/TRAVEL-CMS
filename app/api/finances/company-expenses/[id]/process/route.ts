import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";

const ALLOWED_ROLES = new Set(["finance", "supervisor", "admin"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.has(apiUser.role.toLowerCase())) {
      return NextResponse.json(
        { error: "Forbidden: only Finance can process company expenses" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const processed = body && typeof body === "object" && "processed" in body
      ? Boolean((body as Record<string, unknown>).processed)
      : true;

    const { data: expense, error: fetchError } = await supabaseAdmin
      .from("company_expense_invoices")
      .select("id, company_id, accounting_state")
      .eq("id", id)
      .eq("company_id", apiUser.companyId)
      .maybeSingle();

    if (fetchError || !expense) {
      return NextResponse.json({ error: "Company expense not found" }, { status: 404 });
    }

    const currentState = (expense.accounting_state as string | null) ?? "pending";
    if (processed && currentState === "processed") {
      return NextResponse.json({ error: "Expense is already processed" }, { status: 400 });
    }
    if (!processed && currentState !== "processed") {
      return NextResponse.json({ error: "Expense is not in processed state" }, { status: 400 });
    }

    const updatePayload = processed
      ? {
          accounting_state: "processed",
          accounting_processed_at: new Date().toISOString(),
          accounting_processed_by: apiUser.userId,
        }
      : {
          accounting_state: "pending",
          accounting_processed_at: null,
          accounting_processed_by: null,
        };

    const { error: updateError } = await supabaseAdmin
      .from("company_expense_invoices")
      .update(updatePayload)
      .eq("id", id)
      .eq("company_id", apiUser.companyId);

    if (updateError) {
      console.error("[company-expenses] process update:", updateError);
      return NextResponse.json({ error: "Failed to update accounting state" }, { status: 500 });
    }

    return NextResponse.json({ success: true, expense: { id, ...updatePayload } });
  } catch (error) {
    console.error("[company-expenses] PATCH process:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

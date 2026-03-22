import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = ["supervisor", "finance"];

function canAccessCompanyExpenses(role: string): boolean {
  return ALLOWED_ROLES.includes(role.toLowerCase());
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessCompanyExpenses(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden. Supervisor or Finance only." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.supplier === "string") updates.supplier = body.supplier.trim() || "—";
    if (typeof body.invoice_date === "string") updates.invoice_date = body.invoice_date;
    if (typeof body.amount === "number" && !isNaN(body.amount)) updates.amount = body.amount;
    if (typeof body.currency === "string") updates.currency = body.currency || "EUR";
    if (body.description !== undefined) updates.description = typeof body.description === "string" ? body.description.trim() || null : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("company_expense_invoices")
      .update(updates)
      .eq("id", id)
      .eq("company_id", apiUser.companyId)
      .select("id, company_id, supplier, invoice_date, amount, currency, description, created_at")
      .single();

    if (error) {
      console.error("[company-expenses] PATCH error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[company-expenses] PATCH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessCompanyExpenses(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden. Supervisor or Finance only." }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("company_expense_invoices")
      .delete()
      .eq("id", id)
      .eq("company_id", apiUser.companyId);

    if (error) {
      console.error("[company-expenses] DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ data: { deleted: id } });
  } catch (err) {
    console.error("[company-expenses] DELETE:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.account_name !== undefined) updates.account_name = body.account_name;
    if (body.bank_name !== undefined) updates.bank_name = body.bank_name;
    if (body.iban !== undefined) updates.iban = body.iban;
    if (body.swift !== undefined) updates.swift = body.swift;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.use_in_invoices !== undefined) updates.use_in_invoices = body.use_in_invoices;

    if (body.is_default === true) {
      await supabaseAdmin
        .from("company_bank_accounts")
        .update({ is_default: false })
        .eq("company_id", companyId);
      updates.is_default = true;
    } else if (body.is_default === false) {
      updates.is_default = false;
    }

    const { data, error } = await supabaseAdmin
      .from("company_bank_accounts")
      .update(updates)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      console.error("[bank-accounts] PATCH error:", error);
      const message = error.message || "Failed to update account";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[bank-accounts] PATCH:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

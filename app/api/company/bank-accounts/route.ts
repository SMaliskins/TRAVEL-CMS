import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getCompanyId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  return profile?.company_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("company_bank_accounts")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("account_name");

    if (error) {
      console.error("[bank-accounts] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[bank-accounts] GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId(request);
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { account_name, bank_name, iban, swift, currency, is_default, use_in_invoices } = body;

    if (!account_name) {
      return NextResponse.json({ error: "account_name is required" }, { status: 400 });
    }

    if (is_default) {
      await supabaseAdmin
        .from("company_bank_accounts")
        .update({ is_default: false })
        .eq("company_id", companyId);
    }

    const { data, error } = await supabaseAdmin
      .from("company_bank_accounts")
      .insert({
        company_id: companyId,
        account_name,
        bank_name: bank_name || null,
        iban: iban || null,
        swift: swift || null,
        currency: currency || "EUR",
        is_default: is_default ?? false,
        use_in_invoices: use_in_invoices !== false,
      })
      .select()
      .single();

    if (error) {
      console.error("[bank-accounts] POST error:", error);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[bank-accounts] POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

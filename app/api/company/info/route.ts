import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/company/info - Get company information for current user's company
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company_id from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get company info
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: company.id,
      name: company.name || "",
      legalName: company.legal_name || company.name || "",
      address: company.address || "",
      legalAddress: company.legal_address || company.address || "",
      city: company.city || "",
      country: company.country || "",
      email: company.email || "",
      phone: company.phone || "",
      regNr: company.reg_nr || "",
      vatNr: company.vat_nr || "",
      bankName: company.bank_name || "",
      bankAccount: company.bank_account || "",
      bankSwift: company.bank_swift || "",
      logoUrl: company.logo_url || null,
      defaultCurrency: company.default_currency || "EUR",
    });
  } catch (error: any) {
    console.error("Error in GET /api/company/info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

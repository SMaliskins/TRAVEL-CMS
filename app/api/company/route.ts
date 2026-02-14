import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Get user from request
async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookieHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (!error && data?.user) return data.user;
  }

  return null;
}

// Get company_id and role from user's profile
async function getUserProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select(`
      company_id,
      role:roles(name)
    `)
    .eq("id", userId)
    .single();
  
  const role = data?.role as { name: string } | { name: string }[] | null;
  const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
  
  return {
    companyId: data?.company_id || null,
    roleName: roleName || null
  };
}

// GET: Get company settings
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId } = await getUserProfile(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error) {
      console.error("Get company error:", error);
      return NextResponse.json({ error: "Failed to get company" }, { status: 500 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error("Company GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH: Update company settings (Supervisor only)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId, roleName } = await getUserProfile(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "User has no company assigned" }, { status: 400 });
    }

    // Only Supervisor can update company settings
    if (roleName?.toLowerCase() !== "supervisor") {
      return NextResponse.json({ error: "Only Supervisor can update company settings" }, { status: 403 });
    }

    const body = await request.json();

    // Allowed fields to update
    const allowedFields = [
      // Profile
      "name", "legal_name", "trading_name", "logo_url", "registration_number",
      "country", "vat_number", "legal_address", "operating_address", "website",
      // Company type
      "primary_type", "additional_types", "other_type_description",
      // Contacts (as JSONB)
      "primary_contact", "finance_contact", "tech_contact", "general_contact",
      // Licenses (as JSONB array)
      "licenses",
      // Banking
      "bank_name", "bank_account", "swift_code", "beneficiary_name",
      // Financial / Tax
      "default_vat_rate",
      // IATA
      "is_iata_accredited", "iata_code", "iata_type", "bsp_remittance_frequency",
      // Regional Settings
      "default_currency", "date_format", "document_language", "timezone", "city_label",
      "show_order_source",
      "invoice_languages",
      // Additional
      "working_hours", "emergency_contact", "invoice_prefix",
      "default_payment_terms"
    ];

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .update(updateData)
      .eq("id", companyId)
      .select()
      .single();

    if (error) {
      console.error("Update company error:", error);
      return NextResponse.json({ error: `Failed to update company: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error("Company PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

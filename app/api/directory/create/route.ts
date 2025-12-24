import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";
import { createClient } from "@supabase/supabase-js";

// Get current user from auth header
async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = body as Partial<DirectoryRecord>;

    // Get current user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!data.party_type || (data.party_type !== "person" && data.party_type !== "company")) {
      return NextResponse.json(
        { error: "party_type is required and must be 'person' or 'company'" },
        { status: 400 }
      );
    }

    if (!data.roles || data.roles.length === 0) {
      return NextResponse.json(
        { error: "At least one role is required" },
        { status: 400 }
      );
    }

    if (data.party_type === "person") {
      if (!data.first_name || !data.last_name) {
        return NextResponse.json(
          { error: "first_name and last_name are required for person type" },
          { status: 400 }
        );
      }
    }

    if (data.party_type === "company") {
      if (!data.company_name) {
        return NextResponse.json(
          { error: "company_name is required for company type" },
          { status: 400 }
        );
      }
    }

    // Generate display_name if not provided
    let displayName = data.display_name;
    if (!displayName) {
      if (data.party_type === "person") {
        displayName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
      } else {
        displayName = data.company_name || "";
      }
    }

    // Get company_id from user context (for tenant isolation)
    // TODO: Get from user's company association
    const companyId = data.company_id || user.id; // Fallback to user.id for now

    // Create party record
    const partyData: any = {
      display_name: displayName,
      party_type: data.party_type,
      status: data.status || "active",
      rating: data.rating || null,
      notes: data.notes || null,
      company_id: companyId,
      email: data.email || null,
      phone: data.phone || null,
      email_marketing_consent: data.email_marketing_consent || false,
      phone_marketing_consent: data.phone_marketing_consent || false,
      created_by: user.id,
    };

    const { data: party, error: partyError } = await supabaseAdmin
      .from("party")
      .insert(partyData)
      .select()
      .single();

    if (partyError || !party) {
      console.error("Error creating party:", partyError);
      return NextResponse.json(
        { error: "Failed to create party" },
        { status: 500 }
      );
    }

    const partyId = party.id;

    // Create person or company record
    if (data.party_type === "person") {
      const personData: any = {
        party_id: partyId,
        title: data.title || null,
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob || null,
        personal_code: data.personal_code || null,
        citizenship: data.citizenship || null,
        address: data.address || null,
      };

      const { error: personError } = await supabaseAdmin
        .from("party_person")
        .insert(personData);

      if (personError) {
        console.error("Error creating person:", personError);
        // Clean up party
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Failed to create person record" },
          { status: 500 }
        );
      }
    } else {
      const companyData: any = {
        party_id: partyId,
        company_name: data.company_name,
        reg_number: data.reg_number || null,
        legal_address: data.legal_address || null,
        actual_address: data.actual_address || null,
        bank_details: data.bank_details || null,
      };

      const { error: companyError } = await supabaseAdmin
        .from("party_company")
        .insert(companyData);

      if (companyError) {
        console.error("Error creating company:", companyError);
        // Clean up party
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Failed to create company record" },
          { status: 500 }
        );
      }
    }

    // Create role records
    if (data.roles.includes("client")) {
      await supabaseAdmin.from("client_party").insert({ party_id: partyId });
    }

    if (data.roles.includes("supplier")) {
      const supplierData: any = { party_id: partyId };
      if (data.supplier_details) {
        if (data.supplier_details.business_category) supplierData.business_category = data.supplier_details.business_category;
        if (data.supplier_details.commission_type) supplierData.commission_type = data.supplier_details.commission_type;
        if (data.supplier_details.commission_value !== undefined) supplierData.commission_value = data.supplier_details.commission_value;
        if (data.supplier_details.commission_currency) supplierData.commission_currency = data.supplier_details.commission_currency;
        if (data.supplier_details.commission_valid_from) supplierData.commission_valid_from = data.supplier_details.commission_valid_from;
        if (data.supplier_details.commission_valid_to) supplierData.commission_valid_to = data.supplier_details.commission_valid_to;
        if (data.supplier_details.commission_notes) supplierData.commission_notes = data.supplier_details.commission_notes;
      }
      await supabaseAdmin.from("partner_party").insert(supplierData);
    }

    if (data.roles.includes("subagent")) {
      const subagentData: any = { party_id: partyId };
      if (data.subagent_details) {
        if (data.subagent_details.commission_scheme) subagentData.commission_scheme = data.subagent_details.commission_scheme;
        if (data.subagent_details.commission_tiers) subagentData.commission_tiers = data.subagent_details.commission_tiers;
        if (data.subagent_details.payout_details) subagentData.payout_details = data.subagent_details.payout_details;
      }
      await supabaseAdmin.from("subagents").insert(subagentData);
    }

    return NextResponse.json({
      ok: true,
      record: {
        id: partyId,
        display_name: displayName,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Directory creation error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

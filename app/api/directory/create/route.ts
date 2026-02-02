import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";
import { createClient } from "@supabase/supabase-js";
import { upsertPartyEmbedding } from "@/lib/embeddings/upsert";

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

    // Map camelCase to snake_case for API
    const partyType = data.type === "company" ? "company" : "person";
    
    // Validate required fields
    if (!partyType || (partyType !== "person" && partyType !== "company")) {
      return NextResponse.json(
        { error: "type is required and must be 'person' or 'company'" },
        { status: 400 }
      );
    }

    if (!data.roles || data.roles.length === 0) {
      return NextResponse.json(
        { error: "At least one role is required" },
        { status: 400 }
      );
    }

    if (partyType === "person") {
      if (!data.firstName || !data.lastName) {
        return NextResponse.json(
          { error: "firstName and lastName are required for person type" },
          { status: 400 }
        );
      }
    }

    if (partyType === "company") {
      if (!data.companyName) {
        return NextResponse.json(
          { error: "companyName is required for company type" },
          { status: 400 }
        );
      }
    }

    // Generate display_name if not provided
    let displayName = "";
    if (partyType === "person") {
      displayName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
    } else {
      displayName = data.companyName || "";
    }

    // Get company_id from profiles table (for tenant isolation)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "User profile not found or company_id missing. Please contact administrator." },
        { status: 403 }
      );
    }

    const companyId = profile.company_id;

    // Create party record
    const partyData: any = {
      display_name: displayName,
      party_type: partyType,
      status: data.isActive !== false ? "active" : "inactive",
      rating: null,
      notes: null,
      company_id: companyId,
      email: (data.email && data.email.trim()) ? data.email.trim() : null,
      phone: (data.phone && data.phone.trim()) ? data.phone.trim() : null,
      email_marketing_consent: false,
      phone_marketing_consent: false,
      created_by: user.id,
      // Country
      country: data.country || null,
      // Supplier service areas
      service_areas: data.supplierExtras?.serviceAreas || null,
      // Supplier commissions
      supplier_commissions: data.supplierExtras?.commissions || null,
    };

    const { data: party, error: partyError } = await supabaseAdmin
      .from("party")
      .insert(partyData)
      .select()
      .single();

    if (partyError || !party) {
      console.error("Error creating party:", partyError);
      const errorMessage = partyError?.message || partyError?.code || "Unknown database error";
      const errorDetails = partyError?.details || "";
      return NextResponse.json(
        { 
          error: `Failed to create party: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ""}`,
          details: partyError
        },
        { status: 500 }
      );
    }

    const partyId = party.id;

    // Create person or company record
    if (partyType === "person") {
      const personData: any = {
        party_id: partyId,
        title: data.title || null,
        first_name: data.firstName,
        last_name: data.lastName,
        dob: data.dob || null,
        personal_code: data.personalCode || null,
        citizenship: data.citizenship || null,
        address: null, // Address not in current DirectoryRecord type
        // Passport fields
        passport_number: data.passportNumber || null,
        passport_issue_date: data.passportIssueDate || null,
        passport_expiry_date: data.passportExpiryDate || null,
        passport_issuing_country: data.passportIssuingCountry || null,
        passport_full_name: data.passportFullName || null,
        nationality: data.nationality || null,
        avatar_url: data.avatarUrl || null,
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
        company_name: data.companyName,
        reg_number: data.regNumber || null,
        legal_address: data.legalAddress || null,
        actual_address: data.actualAddress || null,
        bank_details: null, // Not in current DirectoryRecord type
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
      // Verify party exists before inserting client_party
      const { data: partyCheck, error: partyCheckError } = await supabaseAdmin
        .from("party")
        .select("id, party_type")
        .eq("id", partyId)
        .single();
      
      if (partyCheckError || !partyCheck) {
        console.error("Error: Party not found when creating client_party:", {
          partyId,
          error: partyCheckError?.message,
          code: partyCheckError?.code,
        });
        // Clean up party if it exists
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Party not found. Cannot create client record." },
          { status: 500 }
        );
      }
      
      // Determine client_type from party_type
      const clientType = partyCheck.party_type === "company" ? "company" : "person";
      const { error: clientError } = await supabaseAdmin.from("client_party").insert({ 
        party_id: partyId,
        client_type: clientType 
      });
      if (clientError) {
        console.error("Error creating client_party:", {
          partyId,
          client_type: clientType,
          error: clientError.message,
          code: clientError.code,
          details: clientError.details,
          hint: clientError.hint,
        });
        // Clean up party
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Failed to create client record", details: clientError.message },
          { status: 500 }
        );
      }
    }

    if (data.roles.includes("supplier")) {
      // Verify party exists before inserting supplier role
      const { data: partyCheck, error: partyCheckError } = await supabaseAdmin
        .from("party")
        .select("id")
        .eq("id", partyId)
        .single();
      
      if (partyCheckError || !partyCheck) {
        console.error("Error: Party not found when creating supplier_party:", {
          partyId,
          error: partyCheckError?.message,
          code: partyCheckError?.code,
        });
        // Clean up party if it exists
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Party not found. Cannot create supplier record." },
          { status: 500 }
        );
      }
      
      // Supplier role - no additional fields needed
      const supplierData: any = { 
        party_id: partyId, 
        partner_role: 'supplier' 
      };
      
      const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
      if (supplierError) {
        console.error("Error inserting partner_party:", {
          partyId,
          error: supplierError.message,
          code: supplierError.code,
          details: supplierError.details,
          hint: supplierError.hint,
        });
        console.error("Attempted insert:", JSON.stringify(supplierData, null, 2));
        // Clean up party if supplier insert fails
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Failed to create supplier record", details: supplierError.message },
          { status: 500 }
        );
      }
    }

    if (data.roles.includes("subagent")) {
      // Verify party exists before inserting subagent role
      const { data: partyCheck, error: partyCheckError } = await supabaseAdmin
        .from("party")
        .select("id")
        .eq("id", partyId)
        .single();
      
      if (partyCheckError || !partyCheck) {
        console.error("Error: Party not found when creating subagents:", {
          partyId,
          error: partyCheckError?.message,
          code: partyCheckError?.code,
        });
        // Clean up party if it exists
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Party not found. Cannot create subagent record." },
          { status: 500 }
        );
      }
      
      const subagentData: any = { party_id: partyId };
      // Only commission_scheme exists in subagents table
      if (data.subagentExtras?.commissionType) {
        subagentData.commission_scheme = data.subagentExtras.commissionType === "percentage" ? "revenue" : "profit";
      }
      // Note: commissionValue and commissionCurrency are ignored for subagents
      // They don't exist in subagents table schema
      const { error: subagentError } = await supabaseAdmin.from("subagents").insert(subagentData);
      if (subagentError) {
        console.error("Error inserting subagents:", subagentError);
        console.error("Attempted insert:", JSON.stringify(subagentData, null, 2));
        // Clean up party if subagent insert fails
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Failed to create subagent record", details: subagentError.message },
          { status: 500 }
        );
      }
    }

    // Upsert party embedding for semantic search (non-blocking)
    upsertPartyEmbedding(partyId).catch((e) => console.warn("[create] upsertPartyEmbedding:", e));

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

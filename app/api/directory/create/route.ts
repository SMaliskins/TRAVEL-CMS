import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";
import { createClient } from "@supabase/supabase-js";
import { upsertPartyEmbedding } from "@/lib/embeddings/upsert";
import { normalizePhoneForSave } from "@/utils/phone";
import { formatNameForDb } from "@/utils/nameFormat";

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

// Resolve company_id: profiles first, then user_profiles (same as cmsAuth — supports travel experts)
async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.company_id) return profile.company_id;

  const { data: userProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  return userProfile?.company_id ?? null;
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

    const firstNameTrimmed = formatNameForDb((data.firstName ?? "").toString());
    const lastNameTrimmed = formatNameForDb((data.lastName ?? "").toString());
    const companyNameTrimmed = (data.companyName ?? "").toString().trim();

    if (partyType === "person") {
      if (!firstNameTrimmed || !lastNameTrimmed) {
        return NextResponse.json(
          { error: "First name and last name are required for person type" },
          { status: 400 }
        );
      }
    }

    if (partyType === "company") {
      if (!companyNameTrimmed) {
        return NextResponse.json(
          { error: "Company name is required for company type" },
          { status: 400 }
        );
      }
    }

    // Generate display_name from trimmed values
    const displayName = partyType === "person"
      ? `${firstNameTrimmed} ${lastNameTrimmed}`.trim()
      : companyNameTrimmed;

    // Resolve company_id: profiles first, then user_profiles (supports travel experts and other roles)
    const companyId = await getCompanyIdForUser(user.id);
    if (!companyId) {
      return NextResponse.json(
        { error: "User profile not found or company_id missing. Please contact administrator." },
        { status: 403 }
      );
    }

    // Create party record
    const partyData: any = {
      display_name: displayName,
      party_type: partyType,
      status: data.isActive !== false ? "active" : "inactive",
      rating: null,
      notes: null,
      company_id: companyId,
      email: (data.email && data.email.trim()) ? data.email.trim() : null,
      phone: (data.phone && data.phone.trim()) ? normalizePhoneForSave(data.phone.trim()) || null : null,
      email_marketing_consent: false,
      phone_marketing_consent: false,
      created_by: user.id,
      // Country
      country: data.country || null,
      // Supplier service areas
      service_areas: data.supplierExtras?.serviceAreas || null,
      // Supplier services description (rich text)
      supplier_services_description: (data.supplierExtras?.serviceDescription?.trim()) || null,
      // Supplier website
      supplier_website: (data.supplierExtras?.website?.trim()) || null,
      // Supplier documents
      supplier_documents: Array.isArray(data.supplierExtras?.documents) && data.supplierExtras.documents.length > 0 ? data.supplierExtras.documents : null,
      // Supplier commissions
      supplier_commissions: data.supplierExtras?.commissions || null,
      // Corporate accounts / Loyalty cards / Bank accounts
      corporate_accounts: data.corporateAccounts && data.corporateAccounts.length > 0 ? data.corporateAccounts : null,
      loyalty_cards: data.loyaltyCards && data.loyaltyCards.length > 0 ? data.loyaltyCards : null,
      bank_accounts: data.bankAccounts && data.bankAccounts.length > 0
        ? data.bankAccounts.map((a) => ({ bank_name: (a.bankName || "").trim(), iban: (a.iban || "").trim(), swift: (a.swift || "").trim() })).filter((a) => a.bank_name || a.iban)
        : null,
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
        first_name: firstNameTrimmed,
        last_name: lastNameTrimmed,
        gender: data.gender || null,
        dob: data.dob || null,
        personal_code: data.personalCode || null,
        citizenship: data.citizenship || null,
        address: null,
        // Passport fields
        passport_number: data.passportNumber || null,
        passport_issue_date: data.passportIssueDate || null,
        passport_expiry_date: data.passportExpiryDate || null,
        passport_issuing_country: data.passportIssuingCountry || null,
        passport_full_name: data.passportFullName || null,
        nationality: data.nationality || null,
        avatar_url: data.avatarUrl || null,
        // Person client languages
        correspondence_languages: Array.isArray(data.correspondenceLanguages) && data.correspondenceLanguages.length > 0 ? data.correspondenceLanguages : ["en"],
        invoice_language: data.invoiceLanguage || "en",
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
      const firstBank = data.bankAccounts && data.bankAccounts.length > 0 ? data.bankAccounts[0] : null;
      const companyData: any = {
        party_id: partyId,
        company_name: companyNameTrimmed,
        logo_url: data.companyAvatarUrl || null,
        reg_number: data.regNumber || null,
        vat_number: data.vatNumber || null,
        legal_address: data.legalAddress || null,
        actual_address: data.actualAddress || null,
        bank_name: firstBank?.bankName?.trim() || data.bankName || null,
        iban: firstBank?.iban?.trim() || data.iban || null,
        swift: firstBank?.swift?.trim() || data.swift || null,
        contact_person: data.contactPerson || null,
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

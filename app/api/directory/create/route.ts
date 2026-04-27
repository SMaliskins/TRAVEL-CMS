import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DirectoryRecord } from "@/lib/types/directory";
import { getApiUser } from "@/lib/auth/getApiUser";
import { upsertPartyEmbedding } from "@/lib/embeddings/upsert";
import { normalizePhoneForSave } from "@/utils/phone";
import { formatNameForDb } from "@/utils/nameFormat";
import { assertValidDefaultReferralParty } from "@/lib/referral/clientDefaultReferralParty";

function isMissingDefaultReferralColumn(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message || "").toLowerCase();
  const details = String((error as { details?: string } | null)?.details || "").toLowerCase();
  const hint = String((error as { hint?: string } | null)?.hint || "").toLowerCase();
  const full = `${msg} ${details} ${hint}`;
  return full.includes("default_referral_party_id") && (full.includes("schema cache") || full.includes("column"));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = body as Partial<DirectoryRecord>;

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { companyId, userId } = apiUser;

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

    // Robust dedup check: match by name, email, phone, personal_code, reg_number
    const skipDedupCheck = body.skipDedupCheck === true;
    if (!skipDedupCheck) {
      const orFilters: string[] = [];

      // 1. Name match
      if (displayName) {
        orFilters.push(`display_name.ilike.${displayName}`);
      }

      // 2. Email match (strong identifier)
      const emailVal = (data.email ?? "").toString().trim().toLowerCase();
      if (emailVal) {
        orFilters.push(`email.ilike.${emailVal}`);
      }

      // 3. Phone match (strong identifier)
      const phoneVal = (data.phone ?? "").toString().trim().replace(/[\s\-()]/g, "");
      if (phoneVal && phoneVal.length >= 6) {
        orFilters.push(`phone.ilike.%${phoneVal.slice(-8)}%`);
      }

      let existingParties: Array<{ id: string; display_name: string; display_id: number | null }> = [];

      if (orFilters.length > 0) {
        const { data: nameEmailPhoneHits } = await supabaseAdmin
          .from("party")
          .select("id, display_name, display_id")
          .eq("company_id", companyId)
          .eq("status", "active")
          .or(orFilters.join(","))
          .limit(10);

        if (nameEmailPhoneHits && nameEmailPhoneHits.length > 0) {
          existingParties = nameEmailPhoneHits;
        }
      }

      // 4. Person-specific: personal_code match
      if (existingParties.length === 0 && partyType === "person") {
        const pc = (data.personalCode ?? "").toString().trim();
        if (pc && pc.length >= 4) {
          const { data: pcHits } = await supabaseAdmin
            .from("party_person")
            .select("party_id, party:party!inner(id, display_name, display_id, company_id, status)")
            .eq("personal_code", pc)
            .eq("party.company_id", companyId)
            .eq("party.status", "active")
            .limit(5);

          if (pcHits && pcHits.length > 0) {
            existingParties = pcHits.map((r: Record<string, unknown>) => {
              const p = r.party as Record<string, unknown>;
              return {
                id: String(p.id),
                display_name: String(p.display_name || ""),
                display_id: (p.display_id as number) ?? null,
              };
            });
          }
        }
      }

      // 5. Company-specific: reg_number match
      if (existingParties.length === 0 && partyType === "company") {
        const rn = (data.regNumber ?? "").toString().trim();
        if (rn && rn.length >= 3) {
          const { data: rnHits } = await supabaseAdmin
            .from("party_company")
            .select("party_id, party:party!inner(id, display_name, display_id, company_id, status)")
            .eq("reg_number", rn)
            .eq("party.company_id", companyId)
            .eq("party.status", "active")
            .limit(5);

          if (rnHits && rnHits.length > 0) {
            existingParties = rnHits.map((r: Record<string, unknown>) => {
              const p = r.party as Record<string, unknown>;
              return {
                id: String(p.id),
                display_name: String(p.display_name || ""),
                display_id: (p.display_id as number) ?? null,
              };
            });
          }
        }
      }

      if (existingParties.length > 0) {
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = existingParties.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        return NextResponse.json(
          {
            error: "duplicate_found",
            message: `A contact matching "${displayName}" already exists (ID: ${String(unique[0].display_id || "").padStart(5, "0")}). Use the existing record or confirm creation.`,
            duplicates: unique.map((p) => ({
              id: p.id,
              displayName: p.display_name,
              displayId: p.display_id,
            })),
          },
          { status: 409 }
        );
      }
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
      created_by: userId,
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
      // Periodic supplier flag (issues monthly/periodic invoices)
      is_periodic_supplier: data.supplierExtras?.isPeriodicSupplier === true,
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
        seat_preference: data.seatPreference || null,
        meal_preference: data.mealPreference || null,
        preferences_notes: data.preferencesNotes?.trim() || null,
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
      let defaultRefId: string | null = (data.defaultReferralPartyId as string | null | undefined) || null;
      if (defaultRefId) {
        const ok = await assertValidDefaultReferralParty(supabaseAdmin, companyId, defaultRefId);
        if (!ok) defaultRefId = null;
      }
      const { error: clientError } = await supabaseAdmin.from("client_party").insert({
        party_id: partyId,
        client_type: clientType,
        show_referral_in_app: data.showReferralInApp === true,
        default_referral_party_id: defaultRefId,
      });
      if (clientError) {
        if (isMissingDefaultReferralColumn(clientError)) {
          const { error: legacyClientError } = await supabaseAdmin.from("client_party").insert({
            party_id: partyId,
            client_type: clientType,
            show_referral_in_app: data.showReferralInApp === true,
          });
          if (!legacyClientError) {
            defaultRefId = null;
          } else {
            console.error("Error creating legacy client_party fallback:", {
              partyId,
              client_type: clientType,
              error: legacyClientError.message,
              code: legacyClientError.code,
              details: legacyClientError.details,
              hint: legacyClientError.hint,
            });
            await supabaseAdmin.from("party").delete().eq("id", partyId);
            return NextResponse.json(
              { error: "Failed to create client record", details: legacyClientError.message },
              { status: 500 }
            );
          }
        } else {
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

    if (data.roles.includes("referral")) {
      const ref = data.referralExtras || {};
      const { error: referralError } = await supabaseAdmin.from("referral_party").insert({
        party_id: partyId,
        company_id: companyId,
        is_active: true,
        default_currency: (ref.defaultCurrency || "EUR").trim() || "EUR",
        notes: ref.notes?.trim() || null,
      });
      if (referralError) {
        console.error("Error inserting referral_party:", referralError);
        await supabaseAdmin.from("party").delete().eq("id", partyId);
        return NextResponse.json(
          { error: "Failed to create referral record", details: referralError.message },
          { status: 500 }
        );
      }
      const rates = (ref.categoryRates || []).filter(
        (r) =>
          r.categoryId &&
          typeof r.rateValue === "number" &&
          !Number.isNaN(r.rateValue) &&
          (r.rateKind === "percent" || r.rateKind === "fixed")
      );
      if (rates.length > 0) {
        const rows = rates.map((r) => ({
          party_id: partyId,
          company_id: companyId,
          category_id: r.categoryId,
          rate_kind: r.rateKind,
          rate_value: r.rateValue,
        }));
        const { error: ratesError } = await supabaseAdmin.from("referral_party_category_rate").insert(rows);
        if (ratesError) {
          console.error("Error inserting referral_party_category_rate:", ratesError);
          await supabaseAdmin.from("party").delete().eq("id", partyId);
          return NextResponse.json(
            { error: "Failed to save referral category rates", details: ratesError.message },
            { status: 500 }
          );
        }
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

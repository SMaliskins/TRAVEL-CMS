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

/**
 * Build DirectoryRecord from database rows
 */
function buildDirectoryRecord(row: any): DirectoryRecord {
  const roles: DirectoryRole[] = [];
  if (row.is_client) roles.push("client");
  if (row.is_supplier) roles.push("supplier");
  if (row.is_subagent) roles.push("subagent");

  const record: DirectoryRecord = {
    id: row.id,
    type: row.party_type === "company" ? "company" : "person",
    roles,
    isActive: row.status === "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Person fields
  if (row.party_type === "person") {
    record.title = row.title || undefined;
    record.firstName = row.first_name || undefined;
    record.lastName = row.last_name || undefined;
    record.dob = row.dob || undefined;
    record.personalCode = row.personal_code || undefined;
    record.citizenship = row.citizenship || undefined;
    // Passport fields
    record.passportNumber = row.passport_number || undefined;
    record.passportIssueDate = row.passport_issue_date || undefined;
    record.passportExpiryDate = row.passport_expiry_date || undefined;
    record.passportIssuingCountry = row.passport_issuing_country || undefined;
    record.passportFullName = row.passport_full_name || undefined;
    record.nationality = row.nationality || undefined;
  }

  // Company fields
  if (row.party_type === "company") {
    record.companyName = row.company_name || undefined;
    record.regNumber = row.reg_number || undefined;
    record.legalAddress = row.legal_address || undefined;
    record.actualAddress = row.actual_address || undefined;
  }

  // Common fields
  record.phone = row.phone || undefined;
  record.email = row.email || undefined;

  // Supplier details - no additional fields needed
  if (row.is_supplier) {
    record.supplierExtras = {};
  }

  // Subagent details
  if (row.is_subagent) {
    record.subagentExtras = {
      commissionType: row.commission_scheme === "revenue" ? "percentage" : row.commission_scheme === "profit" ? "fixed" : undefined,
    };
  }

  return record;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid party ID format" },
        { status: 400 }
      );
    }

    // Get current user for tenant isolation
    const user = await getCurrentUser(request);
    let userCompanyId: string | null = null;
    
    if (user) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      
      if (profileError) {
        console.error("[Directory GET] Error fetching user profile:", {
          userId: user.id,
          error: profileError.message,
          code: profileError.code,
        });
      }
      
      userCompanyId = profile?.company_id || null;
      
      console.log("[Directory GET] User context:", {
        userId: user.id,
        userCompanyId,
        hasProfile: !!profile,
      });
    } else {
      console.log("[Directory GET] No authenticated user");
    }

    // Fetch party
    let query = supabaseAdmin
      .from("party")
      .select("*")
      .eq("id", id);
    
    // Apply tenant isolation if user is authenticated
    if (userCompanyId) {
      query = query.eq("company_id", userCompanyId);
      console.log("[Directory GET] Applying tenant isolation filter:", {
        id,
        userCompanyId,
      });
    } else {
      console.log("[Directory GET] No tenant isolation (no userCompanyId):", {
        id,
      });
    }
    
    const { data: party, error: partyError } = await query.single();
    
    console.log("[Directory GET] Query result:", {
      id,
      found: !!party,
      error: partyError?.message,
      errorCode: partyError?.code,
    });

    if (partyError) {
      if (partyError.code === "PGRST116" || partyError.message?.includes("single") || partyError.message?.includes("Cannot coerce")) {
        const { data: partyWithoutIsolation } = await supabaseAdmin
          .from("party")
          .select("id, company_id")
          .eq("id", id)
          .maybeSingle();
        
        if (partyWithoutIsolation) {
          console.error("[Directory GET] Record exists but company_id mismatch:", {
            id,
            recordCompanyId: partyWithoutIsolation.company_id,
            userCompanyId,
            userId: user?.id,
          });
          return NextResponse.json(
            { 
              error: "Party not found", 
              details: "Record exists but belongs to a different company",
              hint: "Check company_id match"
            },
            { status: 404 }
          );
        }
      }
      
      console.error("[Directory GET] Error fetching party:", {
        id,
        error: partyError.message,
        code: partyError.code,
        details: partyError.details,
        hint: partyError.hint,
        userCompanyId,
        userId: user?.id,
      });
      return NextResponse.json(
        { error: "Party not found", details: partyError.message },
        { status: 404 }
      );
    }

    if (!party) {
      console.error("[Directory GET] Party not found:", id);
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    // Fetch related data in parallel
    const [personData, companyData, clientData, supplierData, subagentData] = await Promise.all([
      supabaseAdmin
        .from("party_person")
        .select("*")
        .eq("party_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("party_company")
        .select("*")
        .eq("party_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("client_party")
        .select("party_id")
        .eq("party_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("partner_party")
        .select("*")
        .eq("party_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("subagents")
        .select("*")
        .eq("party_id", id)
        .maybeSingle(),
    ]);

    // Log any errors but continue (maybeSingle allows null)
    if (personData.error) console.warn("[Directory GET] Error fetching person data:", personData.error);
    if (companyData.error) console.warn("[Directory GET] Error fetching company data:", companyData.error);
    if (clientData.error) console.warn("[Directory GET] Error fetching client data:", clientData.error);
    if (supplierData.error) console.warn("[Directory GET] Error fetching supplier data:", supplierData.error);
    if (subagentData.error) console.warn("[Directory GET] Error fetching subagent data:", subagentData.error);

    // Debug: Log fetched data
    console.log("[Directory GET] Fetched data for party:", id, {
      party: party ? { id: party.id, display_name: party.display_name, company_id: party.company_id } : null,
      personData: personData.data,
      companyData: companyData.data,
      clientData: clientData.data ? { party_id: clientData.data.party_id } : null,
      supplierData: supplierData.data,
      subagentData: subagentData.data,
      userCompanyId,
    });

    const record = buildDirectoryRecord({
      ...party,
      ...personData.data,
      ...companyData.data,
      is_client: !!clientData.data,
      is_supplier: !!supplierData.data,
      is_subagent: !!subagentData.data,
      ...supplierData.data,
      ...subagentData.data,
    });

    console.log("[Directory GET] Built record:", {
      id: record.id,
      type: record.type,
      roles: record.roles,
      companyName: record.companyName,
      email: record.email,
    });

    return NextResponse.json({ record });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Directory detail error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let { id } = await params;
    const body = await request.json();
    const updates = body as Partial<DirectoryRecord>;

    // Check if ID is from partner_party or subagents table (wrong ID type)
    // If so, resolve to correct party_id
    const { data: partnerPartyCheck } = await supabaseAdmin
      .from("partner_party")
      .select("party_id")
      .eq("id", id)
      .maybeSingle();
    
    if (partnerPartyCheck?.party_id) {
      console.log("[Directory PUT] Resolved partner_party ID to party ID:", {
        partnerPartyId: id,
        partyId: partnerPartyCheck.party_id,
      });
      id = partnerPartyCheck.party_id;
    } else {
      const { data: subagentCheck } = await supabaseAdmin
        .from("subagents")
        .select("party_id")
        .eq("id", id)
        .maybeSingle();
      
      if (subagentCheck?.party_id) {
        console.log("[Directory PUT] Resolved subagent ID to party ID:", {
          subagentId: id,
          partyId: subagentCheck.party_id,
        });
        id = subagentCheck.party_id;
      }
    }

    // Diagnostic: Check if party exists before update
    const { data: existingParty, error: checkError } = await supabaseAdmin
      .from("party")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();

    console.log("[Directory PUT] Checking party existence:", {
      id,
      exists: !!existingParty,
      company_id: existingParty?.company_id,
      error: checkError?.message,
    });

    if (checkError) {
      console.error("[Directory PUT] Error checking party:", checkError);
      return NextResponse.json(
        { error: "Failed to verify party existence", details: checkError.message },
        { status: 500 }
      );
    }

    if (!existingParty) {
      console.error("[Directory PUT] Party not found before update:", { id });
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    // Update party table
    const partyUpdates: any = {};
    if (updates.isActive !== undefined) {
      partyUpdates.status = updates.isActive ? "active" : "inactive";
    }
    if (updates.email !== undefined) {
      partyUpdates.email = (typeof updates.email === 'string' && updates.email.trim()) ? updates.email.trim() : null;
    }
    if (updates.phone !== undefined) {
      partyUpdates.phone = (typeof updates.phone === 'string' && updates.phone.trim()) ? updates.phone.trim() : null;
    }
    partyUpdates.updated_at = new Date().toISOString();

    console.log("[Directory PUT] Updating party:", {
      id,
      partyUpdates,
      hasUpdates: Object.keys(partyUpdates).length > 0,
    });

    const { data: partyAfterUpdate, error: partyError } = await supabaseAdmin
      .from("party")
      .update(partyUpdates)
      .eq("id", id)
      .select();

    console.log("[Directory PUT] Party update result:", {
      id,
      hasError: !!partyError,
      error: partyError ? {
        message: partyError.message,
        code: partyError.code,
        details: partyError.details,
        hint: partyError.hint,
      } : null,
      hasData: !!partyAfterUpdate,
      dataLength: partyAfterUpdate?.length || 0,
      data: partyAfterUpdate?.length === 1 ? partyAfterUpdate[0] : partyAfterUpdate,
    });

    if (partyError) {
      console.error("[Directory PUT] Error updating party:", {
        id,
        partyUpdates,
        error: {
          message: partyError.message,
          code: partyError.code,
          details: partyError.details,
          hint: partyError.hint,
        },
      });
      return NextResponse.json(
        { error: "Failed to update party", details: partyError.message },
        { status: 500 }
      );
    }

    if (!partyAfterUpdate || partyAfterUpdate.length === 0) {
      console.error("[Directory PUT] Party not found after update attempt:", {
        id,
        partyUpdates,
        data: partyAfterUpdate,
        dataLength: partyAfterUpdate?.length || 0,
      });
      
      // Diagnostic: Check if party exists
      const { data: existingParty, error: checkError } = await supabaseAdmin
        .from("party")
        .select("id, company_id, status, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      
      // Check if this ID exists in partner_party (might be wrong ID)
      const { data: partnerPartyCheck } = await supabaseAdmin
        .from("partner_party")
        .select("id, party_id")
        .eq("id", id)
        .maybeSingle();
      
      // Check if this ID exists in subagents (might be wrong ID)
      const { data: subagentCheck } = await supabaseAdmin
        .from("subagents")
        .select("id, party_id")
        .eq("id", id)
        .maybeSingle();
      
      const diagnosticInfo = {
        id,
        updateAttempted: true,
        updateReturnedEmpty: true,
        partyExists: !!existingParty,
        existingParty: existingParty ? {
          id: existingParty.id,
          company_id: existingParty.company_id,
          status: existingParty.status,
        } : null,
        isPartnerPartyId: !!partnerPartyCheck,
        partnerPartyInfo: partnerPartyCheck ? {
          partner_party_id: partnerPartyCheck.id,
          correct_party_id: partnerPartyCheck.party_id,
        } : null,
        isSubagentId: !!subagentCheck,
        subagentInfo: subagentCheck ? {
          subagent_id: subagentCheck.id,
          correct_party_id: subagentCheck.party_id,
        } : null,
        checkError: checkError ? {
          message: checkError.message,
          code: checkError.code,
        } : null,
        partyUpdates,
      };
      
      console.log("[Directory PUT] Diagnostic: Party existence check:", diagnosticInfo);

      // Provide helpful error message if ID is from wrong table
      let errorMessage = "Party not found or update failed";
      if (partnerPartyCheck) {
        errorMessage = `Invalid ID: This is a partner_party ID, not a party ID. Use party ID: ${partnerPartyCheck.party_id}`;
      } else if (subagentCheck) {
        errorMessage = `Invalid ID: This is a subagent ID, not a party ID. Use party ID: ${subagentCheck.party_id}`;
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          diagnostic: diagnosticInfo
        },
        { status: 404 }
      );
    }

    // Update person or company table
    const partyType = updates.type || (updates.firstName ? "person" : updates.companyName ? "company" : null);
    
    // Check if we need to update person table (including passport fields)
    const hasPersonFields = updates.firstName !== undefined || updates.lastName !== undefined || 
                            updates.title !== undefined || updates.dob !== undefined || 
                            updates.personalCode !== undefined || updates.citizenship !== undefined;
    const hasPassportFields = updates.passportNumber !== undefined || updates.passportIssueDate !== undefined ||
                              updates.passportExpiryDate !== undefined || updates.passportIssuingCountry !== undefined ||
                              updates.passportFullName !== undefined || updates.nationality !== undefined;
    
    if (partyType === "person" || hasPersonFields || hasPassportFields) {
      const personUpdates: any = {};
      if (updates.title !== undefined) personUpdates.title = updates.title;
      if (updates.firstName !== undefined) personUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) personUpdates.last_name = updates.lastName;
      if (updates.dob !== undefined) personUpdates.dob = updates.dob;
      if (updates.personalCode !== undefined) personUpdates.personal_code = updates.personalCode;
      if (updates.citizenship !== undefined) personUpdates.citizenship = updates.citizenship;
      // Passport fields - always include if defined
      if (updates.passportNumber !== undefined) personUpdates.passport_number = updates.passportNumber || null;
      if (updates.passportIssueDate !== undefined) personUpdates.passport_issue_date = updates.passportIssueDate || null;
      if (updates.passportExpiryDate !== undefined) personUpdates.passport_expiry_date = updates.passportExpiryDate || null;
      if (updates.passportIssuingCountry !== undefined) personUpdates.passport_issuing_country = updates.passportIssuingCountry || null;
      if (updates.passportFullName !== undefined) personUpdates.passport_full_name = updates.passportFullName || null;
      
      // Nationality - only include if migration has been run (column exists)
      // If column doesn't exist, we'll retry without it
      const nationalityValue = updates.nationality !== undefined ? updates.nationality || null : undefined;
      if (nationalityValue !== undefined) {
        personUpdates.nationality = nationalityValue;
      }

      // Only update if there are fields to update
      if (Object.keys(personUpdates).length > 0) {
        const { error: personError } = await supabaseAdmin
          .from("party_person")
          .upsert({
            party_id: id,
            ...personUpdates,
          });

        // If error is about missing nationality column, retry without it
        if (personError && personError.message?.includes("nationality") && nationalityValue !== undefined) {
          console.warn("Nationality column not found, retrying without it. Please run migration to add nationality column.");
          delete personUpdates.nationality;
          
          // Retry without nationality
          const { error: retryError } = await supabaseAdmin
            .from("party_person")
            .upsert({
              party_id: id,
              ...personUpdates,
            });

          if (retryError) {
            console.error("Error updating person (retry without nationality):", retryError);
            console.error("Person updates attempted:", JSON.stringify(personUpdates, null, 2));
            return NextResponse.json(
              { error: `Failed to update person record: ${retryError.message}`, details: retryError.details },
              { status: 500 }
            );
          }
        } else if (personError) {
          console.error("Error updating person:", personError);
          console.error("Person updates attempted:", JSON.stringify(personUpdates, null, 2));
          return NextResponse.json(
            { error: `Failed to update person record: ${personError.message}`, details: personError.details },
            { status: 500 }
          );
        }
      }
    }

    if (partyType === "company" || updates.companyName) {
      const companyUpdates: any = {};
      if (updates.companyName !== undefined) companyUpdates.company_name = updates.companyName;
      if (updates.regNumber !== undefined) companyUpdates.reg_number = updates.regNumber;
      if (updates.legalAddress !== undefined) companyUpdates.legal_address = updates.legalAddress;
      if (updates.actualAddress !== undefined) companyUpdates.actual_address = updates.actualAddress;

      const { error: companyError } = await supabaseAdmin
        .from("party_company")
        .upsert({
          party_id: id,
          ...companyUpdates,
        });

      if (companyError) {
        console.error("Error updating company:", companyError);
      }
    }

    // Update roles (always update if roles is provided, even if empty array)
    if (updates.roles !== undefined) {
      // Party already updated above (line 299-302), so no need to check again
      // If party update succeeded, the record exists
      // Use party_type from updates
      const partyTypeForClient = updates.type || "person";
      const clientType = partyTypeForClient === "company" ? "company" : "person";

      // Remove all existing roles
      const [clientDeleteResult, partnerDeleteResult, subagentDeleteResult] = await Promise.all([
        supabaseAdmin.from("client_party").delete().eq("party_id", id),
        supabaseAdmin.from("partner_party").delete().eq("party_id", id),
        supabaseAdmin.from("subagents").delete().eq("party_id", id),
      ]);

      // Check for deletion errors
      if (clientDeleteResult.error) {
        console.error("Error deleting client_party:", clientDeleteResult.error);
      }
      if (partnerDeleteResult.error) {
        console.error("Error deleting partner_party:", partnerDeleteResult.error);
      }
      if (subagentDeleteResult.error) {
        console.error("Error deleting subagents:", subagentDeleteResult.error);
      }

      // Add new roles
      if (updates.roles.includes("client")) {
        const { error: clientError } = await supabaseAdmin.from("client_party").insert({ 
          party_id: id,
          client_type: clientType 
        });
        if (clientError) {
          console.error("Error inserting client_party:", {
            id,
            client_type: clientType,
            error: clientError.message,
            code: clientError.code,
            details: clientError.details,
            hint: clientError.hint,
          });
          return NextResponse.json(
            { error: `Failed to save client role: ${clientError.message}`, details: clientError.details },
            { status: 500 }
          );
        }
      }
      if (updates.roles.includes("supplier")) {
        const supplierData: any = { party_id: id, partner_role: 'supplier' };
        
        const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
        if (supplierError) {
          console.error("Error inserting partner_party:", {
            id,
            partner_role: 'supplier',
            error: supplierError.message,
            code: supplierError.code,
            details: supplierError.details,
            hint: supplierError.hint,
            supplierData,
          });
          return NextResponse.json(
            { 
              error: `Failed to update supplier record: ${supplierError.message}`,
              details: supplierError.details,
              hint: supplierError.hint,
              code: supplierError.code,
            },
            { status: 500 }
          );
        }
      }
      if (updates.roles.includes("subagent")) {
        const subagentData: any = { party_id: id };
        if (updates.subagentExtras) {
          if (updates.subagentExtras.commissionType) {
            subagentData.commission_scheme = updates.subagentExtras.commissionType === "percentage" ? "revenue" : "profit";
          }
        }
        const { error: subagentError } = await supabaseAdmin.from("subagents").insert(subagentData);
        if (subagentError) {
          console.error("Error inserting subagents:", subagentError);
          return NextResponse.json(
            { error: `Failed to save subagent role: ${subagentError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // Fetch updated record
    const { data: updatedParty, error: fetchError } = await supabaseAdmin
      .from("party")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching updated party:", {
        id,
        error: fetchError.message,
        code: fetchError.code,
        details: fetchError.details,
      });
      return NextResponse.json(
        { error: "Failed to fetch updated record", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!updatedParty) {
      console.error("Updated party not found after update:", id);
      return NextResponse.json(
        { error: "Failed to fetch updated record: Record not found after update" },
        { status: 500 }
      );
    }

    // Rebuild record with updated data
    const [personData, companyData, clientData, supplierData, subagentData] = await Promise.all([
      supabaseAdmin.from("party_person").select("*").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("party_company").select("*").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("client_party").select("party_id").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("partner_party").select("*").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("subagents").select("*").eq("party_id", id).maybeSingle(),
    ]);

    const record = buildDirectoryRecord({
      ...updatedParty,
      ...personData.data,
      ...companyData.data,
      is_client: !!clientData.data,
      is_supplier: !!supplierData.data,
      is_subagent: !!subagentData.data,
      ...supplierData.data,
      ...subagentData.data,
    });

    return NextResponse.json({ record });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Directory update error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete party (cascade will delete related records)
    const { error } = await supabaseAdmin
      .from("party")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting party:", error);
      return NextResponse.json(
        { error: "Failed to delete party", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Directory delete error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
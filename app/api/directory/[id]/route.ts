import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";

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
    display_name: row.display_name || "",
    party_type: row.party_type,
    roles,
    status: row.status,
    rating: row.rating || undefined,
    notes: row.notes || undefined,
    company_id: row.company_id,
    email: row.email || undefined,
    phone: row.phone || undefined,
    email_marketing_consent: row.email_marketing_consent || false,
    phone_marketing_consent: row.phone_marketing_consent || false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };

  // Person fields
  if (row.party_type === "person") {
    record.title = row.title || undefined;
    record.first_name = row.first_name || undefined;
    record.last_name = row.last_name || undefined;
    record.dob = row.dob || undefined;
    record.personal_code = row.personal_code || undefined;
    record.citizenship = row.citizenship || undefined;
    record.address = row.address || undefined;
  }

  // Company fields
  if (row.party_type === "company") {
    record.company_name = row.company_name || undefined;
    record.reg_number = row.reg_number || undefined;
    record.legal_address = row.legal_address || undefined;
    record.actual_address = row.actual_address || undefined;
    record.bank_details = row.bank_details || undefined;
  }

  // Supplier details
  if (row.is_supplier && (row.business_category || row.commission_type)) {
    record.supplier_details = {
      business_category: row.business_category || undefined,
      commission_type: row.commission_type || undefined,
      commission_value: row.commission_value ? parseFloat(row.commission_value) : undefined,
      commission_currency: row.commission_currency || undefined,
      commission_valid_from: row.commission_valid_from || undefined,
      commission_valid_to: row.commission_valid_to || undefined,
      commission_notes: row.commission_notes || undefined,
    };
  }

  // Subagent details
  if (row.is_subagent && (row.commission_scheme || row.payout_details)) {
    record.subagent_details = {
      commission_scheme: row.commission_scheme || undefined,
      commission_tiers: row.commission_tiers || undefined,
      payout_details: row.payout_details || undefined,
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

    // Fetch party
    const { data: party, error: partyError } = await supabaseAdmin
      .from("party")
      .select("*")
      .eq("id", id)
      .single();

    if (partyError || !party) {
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
    if (personData.error) console.warn("Error fetching person data:", personData.error);
    if (companyData.error) console.warn("Error fetching company data:", companyData.error);
    if (clientData.error) console.warn("Error fetching client data:", clientData.error);
    if (supplierData.error) console.warn("Error fetching supplier data:", supplierData.error);
    if (subagentData.error) console.warn("Error fetching subagent data:", subagentData.error);

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
    const { id } = await params;
    const body = await request.json();
    const updates = body as Partial<DirectoryRecord>;

    // Update party table
    const partyUpdates: any = {};
    if (updates.display_name !== undefined) partyUpdates.display_name = updates.display_name;
    if (updates.status !== undefined) partyUpdates.status = updates.status;
    if (updates.rating !== undefined) partyUpdates.rating = updates.rating;
    if (updates.notes !== undefined) partyUpdates.notes = updates.notes;
    // Always update phone and email (convert empty string to null)
    if (updates.email !== undefined) {
      partyUpdates.email = (typeof updates.email === 'string' && updates.email.trim()) ? updates.email.trim() : null;
    }
    if (updates.phone !== undefined) {
      partyUpdates.phone = (typeof updates.phone === 'string' && updates.phone.trim()) ? updates.phone.trim() : null;
    }
    if (updates.email_marketing_consent !== undefined) partyUpdates.email_marketing_consent = updates.email_marketing_consent;
    if (updates.phone_marketing_consent !== undefined) partyUpdates.phone_marketing_consent = updates.phone_marketing_consent;
    partyUpdates.updated_at = new Date().toISOString();

    const { error: partyError } = await supabaseAdmin
      .from("party")
      .update(partyUpdates)
      .eq("id", id);

    if (partyError) {
      console.error("Error updating party:", partyError);
      console.error("Party updates attempted:", JSON.stringify(partyUpdates, null, 2));
      return NextResponse.json(
        { error: "Failed to update party", details: partyError.message },
        { status: 500 }
      );
    }

    // Update person or company table
    if (updates.party_type === "person" || updates.first_name || updates.last_name) {
      const personUpdates: any = {};
      if (updates.title !== undefined) personUpdates.title = updates.title;
      if (updates.first_name !== undefined) personUpdates.first_name = updates.first_name;
      if (updates.last_name !== undefined) personUpdates.last_name = updates.last_name;
      if (updates.dob !== undefined) personUpdates.dob = updates.dob;
      if (updates.personal_code !== undefined) personUpdates.personal_code = updates.personal_code;
      if (updates.citizenship !== undefined) personUpdates.citizenship = updates.citizenship;
      if (updates.address !== undefined) personUpdates.address = updates.address;

      const { error: personError } = await supabaseAdmin
        .from("party_person")
        .upsert({
          party_id: id,
          ...personUpdates,
        });

      if (personError) {
        console.error("Error updating person:", personError);
      }
    }

    if (updates.party_type === "company" || updates.company_name) {
      const companyUpdates: any = {};
      if (updates.company_name !== undefined) companyUpdates.company_name = updates.company_name;
      if (updates.reg_number !== undefined) companyUpdates.reg_number = updates.reg_number;
      if (updates.legal_address !== undefined) companyUpdates.legal_address = updates.legal_address;
      if (updates.actual_address !== undefined) companyUpdates.actual_address = updates.actual_address;
      if (updates.bank_details !== undefined) companyUpdates.bank_details = updates.bank_details;

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
      // Get party_type to determine client_type for client_party insert
      const { data: partyData } = await supabaseAdmin
        .from("party")
        .select("party_type")
        .eq("id", id)
        .single();
      
      const partyType = partyData?.party_type || updates.party_type || "person";
      const clientType = partyType === "company" ? "company" : "person";

      // Remove all existing roles
      await Promise.all([
        supabaseAdmin.from("client_party").delete().eq("party_id", id),
        supabaseAdmin.from("partner_party").delete().eq("party_id", id),
        supabaseAdmin.from("subagents").delete().eq("party_id", id),
      ]);

      // Add new roles
      if (updates.roles.includes("client")) {
        const { error: clientError } = await supabaseAdmin.from("client_party").insert({ 
          party_id: id,
          client_type: clientType 
        });
        if (clientError) {
          console.error("Error inserting client_party:", clientError);
          console.error("Attempted insert:", { party_id: id, client_type: clientType });
        }
      }
      if (updates.roles.includes("supplier")) {
        const supplierData: any = { party_id: id, partner_role: 'supplier' };
        if (updates.supplier_details) {
          if (updates.supplier_details.business_category) supplierData.business_category = updates.supplier_details.business_category;
          if (updates.supplier_details.commission_type) supplierData.commission_type = updates.supplier_details.commission_type;
          if (updates.supplier_details.commission_value !== undefined) supplierData.commission_value = updates.supplier_details.commission_value;
          if (updates.supplier_details.commission_currency) supplierData.commission_currency = updates.supplier_details.commission_currency;
          if (updates.supplier_details.commission_valid_from) supplierData.commission_valid_from = updates.supplier_details.commission_valid_from;
          if (updates.supplier_details.commission_valid_to) supplierData.commission_valid_to = updates.supplier_details.commission_valid_to;
          if (updates.supplier_details.commission_notes) supplierData.commission_notes = updates.supplier_details.commission_notes;
        }
        const { error: supplierError } = await supabaseAdmin.from("partner_party").insert(supplierData);
        if (supplierError) {
          console.error("Error inserting partner_party:", supplierError);
          console.error("Attempted insert:", JSON.stringify(supplierData, null, 2));
          return NextResponse.json(
            { error: "Failed to update supplier record", details: supplierError.message },
            { status: 500 }
          );
        }
      }
      if (updates.roles.includes("subagent")) {
        const subagentData: any = { party_id: id };
        if (updates.subagent_details) {
          if (updates.subagent_details.commission_scheme) subagentData.commission_scheme = updates.subagent_details.commission_scheme;
          if (updates.subagent_details.commission_tiers) subagentData.commission_tiers = updates.subagent_details.commission_tiers;
          if (updates.subagent_details.payout_details) subagentData.payout_details = updates.subagent_details.payout_details;
        }
        const { error: subagentError } = await supabaseAdmin.from("subagents").insert(subagentData);
        if (subagentError) {
          console.error("Error inserting subagents:", subagentError);
          console.error("Attempted insert:", JSON.stringify(subagentData, null, 2));
        }
      }
    }

    // Fetch updated record
    const { data: updatedParty } = await supabaseAdmin
      .from("party")
      .select("*")
      .eq("id", id)
      .single();

    if (!updatedParty) {
      return NextResponse.json(
        { error: "Failed to fetch updated record" },
        { status: 500 }
      );
    }

    // Fetch related data again
    const [personData, companyData, clientData, supplierData, subagentData] = await Promise.all([
      supabaseAdmin.from("party_person").select("*").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("party_company").select("*").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("client_party").select("party_id").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("partner_party").select("*").eq("party_id", id).maybeSingle(),
      supabaseAdmin.from("subagents").select("*").eq("party_id", id).maybeSingle(),
    ]);

    // Log any errors but continue (maybeSingle allows null)
    if (personData.error) console.warn("Error fetching person data:", personData.error);
    if (companyData.error) console.warn("Error fetching company data:", companyData.error);
    if (clientData.error) console.warn("Error fetching client data:", clientData.error);
    if (supplierData.error) console.warn("Error fetching supplier data:", supplierData.error);
    if (subagentData.error) console.warn("Error fetching subagent data:", subagentData.error);

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

    // Soft delete: set status to 'inactive'
    const { error } = await supabaseAdmin
      .from("party")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error deleting party:", error);
      return NextResponse.json(
        { error: "Failed to delete party" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Directory delete error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}


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
      // Note: subagents table has commission_tiers (jsonb), not commission_value/currency
      // commissionValue and commissionCurrency are from partner_party table (for suppliers)
      commissionValue: undefined, // subagents uses commission_tiers jsonb instead
      commissionCurrency: undefined, // subagents doesn't have currency field
    };
    // If commission_tiers exists, we could parse it, but API type doesn't support it yet
  }

  return record;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const personalCode = searchParams.get("personalCode");
    const phone = searchParams.get("phone");
    const email = searchParams.get("email");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    // Get current user for tenant isolation
    const user = await getCurrentUser(request);
    let userCompanyId: string | null = null;
    
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      userCompanyId = profile?.company_id || null;
    }

    // Build base query
    let query = supabaseAdmin
      .from("party")
      .select("*", { count: "exact" });
    
    // Apply tenant isolation if user is authenticated
    if (userCompanyId) {
      query = query.eq("company_id", userCompanyId);
    }

    // Apply filters
    if (type && (type === "person" || type === "company")) {
      query = query.eq("party_type", type);
    }

    if (status && (status === "active" || status === "inactive" || status === "blocked")) {
      query = query.eq("status", status);
    }

    // NOTE: Role filter is applied AFTER fetching related data
    // because is_client/is_supplier/is_subagent are determined by join tables
    // (client_party, partner_party, subagents), not columns in party table

    // Apply search filter in SQL (ilike on display_name)
    // This ensures search works BEFORE pagination
    if (search) {
      query = query.ilike("display_name", `%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    // Order by updated_at desc
    query = query.order("updated_at", { ascending: false });

    let { data: parties, error, count } = await query;

    if (error) {
      console.error("Error fetching directory:", error);
      return NextResponse.json(
        { error: "Failed to fetch directory records" },
        { status: 500 }
      );
    }

    // If search provided and no results from display_name, try searching in party_person and party_company
    if (search && (!parties || parties.length === 0)) {
      const searchLower = search.toLowerCase();
      
      // Search in party_person by first_name or last_name
      const { data: personMatches } = await supabaseAdmin
        .from("party_person")
        .select("party_id")
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        .limit(limit);
      
      // Search in party_company by company_name
      const { data: companyMatches } = await supabaseAdmin
        .from("party_company")
        .select("party_id")
        .ilike("company_name", `%${search}%`)
        .limit(limit);

      const matchedIds = [
        ...(personMatches || []).map((p: { party_id: string }) => p.party_id),
        ...(companyMatches || []).map((c: { party_id: string }) => c.party_id),
      ];

      if (matchedIds.length > 0) {
        // Fetch parties by these IDs
        let fallbackQuery = supabaseAdmin
          .from("party")
          .select("*", { count: "exact" })
          .in("id", matchedIds);
        
        if (userCompanyId) {
          fallbackQuery = fallbackQuery.eq("company_id", userCompanyId);
        }
        
        const { data: fallbackParties, count: fallbackCount } = await fallbackQuery;
        parties = fallbackParties || [];
        count = fallbackCount || 0;
      }
    }

    if (!parties || parties.length === 0) {
      return NextResponse.json({
        data: [],
        total: count || 0,
        page,
        limit,
      });
    }

    const partyIds = parties.map((p: any) => p.id);

    // Fetch related data in parallel
    const [personData, companyData, clientData, supplierData, subagentData] = await Promise.all([
      // Person data
      supabaseAdmin
        .from("party_person")
        .select("*")
        .in("party_id", partyIds),
      // Company data
      supabaseAdmin
        .from("party_company")
        .select("*")
        .in("party_id", partyIds),
      // Client roles
      supabaseAdmin
        .from("client_party")
        .select("party_id")
        .in("party_id", partyIds),
      // Supplier data
      supabaseAdmin
        .from("partner_party")
        .select("*")
        .in("party_id", partyIds),
      // Subagent data
      supabaseAdmin
        .from("subagents")
        .select("*")
        .in("party_id", partyIds),
    ]);

    // Build maps for quick lookup
    const personMap = new Map((personData.data || []).map((p: any) => [p.party_id, p]));
    const companyMap = new Map((companyData.data || []).map((c: any) => [c.party_id, c]));
    const clientSet = new Set((clientData.data || []).map((c: any) => c.party_id));
    const supplierMap = new Map((supplierData.data || []).map((s: any) => [s.party_id, s]));
    const subagentMap = new Map((subagentData.data || []).map((s: any) => [s.party_id, s]));

    // Apply role filter if specified
    let filteredParties = parties;
    if (role === "client") {
      filteredParties = parties.filter((p: any) => clientSet.has(p.id));
    } else if (role === "supplier") {
      filteredParties = parties.filter((p: any) => supplierMap.has(p.id));
    } else if (role === "subagent") {
      filteredParties = parties.filter((p: any) => subagentMap.has(p.id));
    }

    // Apply search filter (including first_name, last_name, company_name) after loading all data
    if (search) {
      const searchLower = search.toLowerCase();
      filteredParties = filteredParties.filter((p: any) => {
        const matchesDisplayName = p.display_name?.toLowerCase().includes(searchLower);
        const matchesEmail = p.email?.toLowerCase().includes(searchLower);
        const matchesPhone = p.phone?.toLowerCase().includes(searchLower);
        
        // Check person data (first_name, last_name)
        const person = personMap.get(p.id);
        const matchesFirstName = person?.first_name?.toLowerCase().includes(searchLower);
        const matchesLastName = person?.last_name?.toLowerCase().includes(searchLower);
        
        // Check company_name from party_company
        const company = companyMap.get(p.id);
        const matchesCompanyName = company?.company_name?.toLowerCase().includes(searchLower);
        
        return matchesDisplayName || matchesEmail || matchesPhone || 
               matchesFirstName || matchesLastName || matchesCompanyName;
      });
    }

    // Apply additional filters in memory (personalCode, phone, email)
    if (personalCode) {
      filteredParties = filteredParties.filter((p: any) => {
        const person = personMap.get(p.id);
        return person?.personal_code?.toLowerCase().includes(personalCode.toLowerCase());
      });
    }
    
    if (phone) {
      filteredParties = filteredParties.filter((p: any) => {
        return p.phone?.toLowerCase().includes(phone.toLowerCase());
      });
    }
    
    if (email) {
      filteredParties = filteredParties.filter((p: any) => {
        return p.email?.toLowerCase().includes(email.toLowerCase());
      });
    }

    // Build response records
    const records = filteredParties.map((party: any) => {
      const person = personMap.get(party.id);
      const company = companyMap.get(party.id);
      const supplier = supplierMap.get(party.id);
      const subagent = subagentMap.get(party.id);

      // Exclude id from supplier and subagent to prevent overwriting party.id
      const { id: _supplierId, ...supplierData } = supplier || {};
      const { id: _subagentId, ...subagentData } = subagent || {};

      const record = buildDirectoryRecord({
        ...party,
        ...person,
        ...company,
        is_client: clientSet.has(party.id),
        is_supplier: !!supplier,
        is_subagent: !!subagent,
        ...supplierData,  // Without id - prevents overwriting party.id
        ...subagentData,  // Without id - prevents overwriting party.id
      });
      return record;
    });

    return NextResponse.json({
      data: records,
      total: count || 0,
      page,
      limit,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Directory list error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";
import { createClient } from "@supabase/supabase-js";
import { generateEmbeddings } from "@/lib/embeddings";
import { getSearchPatterns, getSemanticQueryVariants, matchesSearch } from "@/lib/directory/searchNormalize";

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
    displayId: row.display_id || undefined,
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
    record.avatarUrl = row.avatar_url || undefined;
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
  record.country = row.country || undefined;

  // Supplier details
  if (row.is_supplier) {
    record.supplierExtras = {
      serviceAreas: row.service_areas || undefined,
      commissions: row.supplier_commissions || undefined,
    };
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

    // Build base query – select only columns needed for list (avoids heavy payload)
    const partyColumns = "id,display_name,company_id,party_type,status,email,phone,updated_at,created_at,display_id,service_areas,supplier_commissions,country";
    let query = supabaseAdmin
      .from("party")
      .select(partyColumns, { count: "exact" });
    
    // Apply tenant isolation if user is authenticated
    if (userCompanyId) {
      query = query.eq("company_id", userCompanyId);
    }

    // Apply filters
    if (type && (type === "person" || type === "company")) {
      query = query.eq("party_type", type);
    }

    // By default return only active contacts (archived visible only when status=archived explicitly)
    const effectiveStatus = status && status.trim() ? status : "active";
    if (effectiveStatus === "active") {
      query = query.eq("status", "active");
    } else if (effectiveStatus === "inactive" || effectiveStatus === "blocked") {
      query = query.eq("status", effectiveStatus);
    } else if (effectiveStatus === "archived") {
      query = query.in("status", ["inactive", "archived"]);
    }

    // NOTE: Role filter is applied AFTER fetching related data
    // because is_client/is_supplier/is_subagent are determined by join tables
    // (client_party, partner_party, subagents), not columns in party table

    // Apply search filter: diacritics, layout transliteration, name variants (DIR3)
    if (search) {
      const patterns = getSearchPatterns(search);
      const safePatterns = patterns.slice(0, 20).map((p) => p.replace(/[%,]/g, "")); // Include keyboard-typo variants
      if (safePatterns.length === 1) {
        query = query.ilike("display_name", `%${safePatterns[0]}%`);
      } else if (safePatterns.length > 1) {
        const orClause = safePatterns.map((p) => `display_name.ilike.%${p}%`).join(",");
        query = query.or(orClause);
      }
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

    // Semantic search: 2–3 query variants (normalized + typo corrections), merge results
    let semanticPartyIds: string[] = [];
    if (search && search.trim().length >= 2 && process.env.OPENAI_API_KEY && userCompanyId) {
      try {
        const variants = getSemanticQueryVariants(search, 3).filter(Boolean);
        if (variants.length === 0) variants.push(search.trim());
        const embeddings = await generateEmbeddings(variants);
        const threshold = (search.trim().length < 25 ? 0.25 : 0.3);
        const allIds = new Set<string>();
        for (const embedding of embeddings) {
          const { data: semanticRows } = await supabaseAdmin.rpc("search_party_semantic", {
            query_embedding: embedding,
            p_company_id: userCompanyId,
            match_limit: limit,
            match_threshold: threshold,
          });
          (semanticRows || []).forEach((r: { party_id: string }) => allIds.add(r.party_id));
        }
        semanticPartyIds = Array.from(allIds);
      } catch (e) {
        console.warn("Semantic search failed:", e);
      }
    }

    // If search provided and no results from display_name, try person/company + semantic fallback
    if (search && (!parties || parties.length === 0)) {
      const patterns = getSearchPatterns(search).slice(0, 10).map((p) => p.replace(/[%,]/g, ""));
      const searchTerms = patterns.length > 0 ? patterns : [search.replace(/[%,]/g, "")];
      const personOr = searchTerms.flatMap((p) => [`first_name.ilike.%${p}%`, `last_name.ilike.%${p}%`]).join(",");
      const companyOr = searchTerms.map((p) => `company_name.ilike.%${p}%`).join(",");
      const { data: personMatches } = await supabaseAdmin
        .from("party_person")
        .select("party_id")
        .or(personOr)
        .limit(limit);
      const { data: companyMatches } = await supabaseAdmin
        .from("party_company")
        .select("party_id")
        .or(companyOr)
        .limit(limit);
      const matchedIds = [
        ...(personMatches || []).map((p: { party_id: string }) => p.party_id),
        ...(companyMatches || []).map((c: { party_id: string }) => c.party_id),
        ...semanticPartyIds,
      ];
      const allIds = [...new Set(matchedIds)];
      if (allIds.length > 0) {
        let fallbackQuery = supabaseAdmin
          .from("party")
          .select(partyColumns, { count: "exact" })
          .in("id", allIds);
        if (userCompanyId) {
          fallbackQuery = fallbackQuery.eq("company_id", userCompanyId);
        }
        // Same status filter as main list: working directory = only active; archive view = inactive/archived
        if (effectiveStatus === "active") {
          fallbackQuery = fallbackQuery.eq("status", "active");
        } else if (effectiveStatus === "inactive" || effectiveStatus === "blocked") {
          fallbackQuery = fallbackQuery.eq("status", effectiveStatus);
        } else if (effectiveStatus === "archived") {
          fallbackQuery = fallbackQuery.in("status", ["inactive", "archived"]);
        }
        const { data: fallbackParties, count: fallbackCount } = await fallbackQuery;
        parties = fallbackParties || [];
        count = fallbackCount || 0;
      }
    } else if (semanticPartyIds.length > 0 && parties && parties.length < limit) {
      const existingIds = new Set((parties || []).map((p: any) => p.id));
      const extraIds = semanticPartyIds.filter((id) => !existingIds.has(id));
      if (extraIds.length > 0) {
        let extraQuery = supabaseAdmin
          .from("party")
          .select(partyColumns)
          .in("id", extraIds.slice(0, limit - (parties?.length || 0)));
        if (userCompanyId) {
          extraQuery = extraQuery.eq("company_id", userCompanyId);
        }
        // Same status filter: do not add archived/merged to working directory
        if (effectiveStatus === "active") {
          extraQuery = extraQuery.eq("status", "active");
        } else if (effectiveStatus === "inactive" || effectiveStatus === "blocked") {
          extraQuery = extraQuery.eq("status", effectiveStatus);
        } else if (effectiveStatus === "archived") {
          extraQuery = extraQuery.in("status", ["inactive", "archived"]);
        }
        const { data: extraParties } = await extraQuery;
        if (extraParties?.length) {
          parties = [...(parties || []), ...extraParties];
          count = (count || 0) + extraParties.length;
        }
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

    // Fetch related data in parallel - only columns needed for buildDirectoryRecord
    const [personData, companyData, clientData, supplierData, subagentData] = await Promise.all([
      supabaseAdmin
        .from("party_person")
        .select("party_id,title,first_name,last_name,dob,personal_code,citizenship,passport_number,passport_issue_date,passport_expiry_date,passport_issuing_country,passport_full_name,nationality,avatar_url")
        .in("party_id", partyIds),
      supabaseAdmin
        .from("party_company")
        .select("party_id,company_name,reg_number,legal_address,actual_address")
        .in("party_id", partyIds),
      supabaseAdmin
        .from("client_party")
        .select("party_id")
        .in("party_id", partyIds),
      supabaseAdmin
        .from("partner_party")
        .select("party_id")
        .in("party_id", partyIds),
      supabaseAdmin
        .from("subagents")
        .select("party_id,commission_scheme")
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

    // Apply search filter with diacritics, layout, variants (DIR3)
    if (search) {
      const patterns = getSearchPatterns(search);
      filteredParties = filteredParties.filter((p: any) => {
        const matchesDisplayName = matchesSearch(p.display_name, patterns);
        const matchesEmail = matchesSearch(p.email, patterns);
        const matchesPhone = matchesSearch(p.phone, patterns);
        
        const person = personMap.get(p.id);
        const matchesFirstName = matchesSearch(person?.first_name, patterns);
        const matchesLastName = matchesSearch(person?.last_name, patterns);
        
        const company = companyMap.get(p.id);
        const matchesCompanyName = matchesSearch(company?.company_name, patterns);
        
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

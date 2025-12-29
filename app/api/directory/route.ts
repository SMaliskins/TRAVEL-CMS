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
    // Statistics
    total_spent: row.total_spent ? parseFloat(row.total_spent) : undefined,
    last_trip_date: row.last_trip_date || undefined,
    next_trip_date: row.next_trip_date || undefined,
    debt: row.debt ? parseFloat(row.debt) : undefined,
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    // Build base query
    let query = supabaseAdmin
      .from("party")
      .select("*", { count: "exact" });

    // Apply filters
    if (type && (type === "person" || type === "company")) {
      query = query.eq("party_type", type);
    }

    if (status && (status === "active" || status === "inactive" || status === "blocked")) {
      query = query.eq("status", status);
    }

    // Search filter (name, email, phone)
    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    // Order by updated_at desc
    query = query.order("updated_at", { ascending: false });

    const { data: parties, error, count } = await query;

    if (error) {
      console.error("Error fetching directory:", error);
      return NextResponse.json(
        { error: "Failed to fetch directory records" },
        { status: 500 }
      );
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
    const [personData, companyData, clientData, supplierData, subagentData, ordersData] = await Promise.all([
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
      // Orders for statistics
      supabaseAdmin
        .from("orders")
        .select("client_party_id, amount_total, amount_paid, date_from")
        .in("client_party_id", partyIds),
    ]);

    // Build maps for quick lookup
    const personMap = new Map((personData.data || []).map((p: any) => [p.party_id, p]));
    const companyMap = new Map((companyData.data || []).map((c: any) => [c.party_id, c]));
    const clientSet = new Set((clientData.data || []).map((c: any) => c.party_id));
    const supplierMap = new Map((supplierData.data || []).map((s: any) => [s.party_id, s]));
    const subagentMap = new Map((subagentData.data || []).map((s: any) => [s.party_id, s]));

    // Calculate statistics per party
    const statisticsMap: Record<string, any> = {};
    partyIds.forEach((partyId: string) => {
      const partyOrders = ordersData.data?.filter((o: any) => o.client_party_id === partyId) || [];
      const totalSpent = partyOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.amount_total) || 0), 0);
      const totalPaid = partyOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.amount_paid) || 0), 0);
      const debt = totalSpent - totalPaid;

      const dates = partyOrders
        .map((o: any) => o.date_from)
        .filter((d: any) => d)
        .map((d: any) => new Date(d).getTime())
        .sort((a: number, b: number) => a - b);

      const lastTripDate = dates.length > 0 ? new Date(dates[dates.length - 1]).toISOString().split("T")[0] : undefined;
      const futureDates = dates.filter((d: number) => d > Date.now());
      const nextTripDate = futureDates.length > 0 ? new Date(futureDates[0]).toISOString().split("T")[0] : undefined;

      statisticsMap[partyId] = {
        total_spent: totalSpent,
        last_trip_date: lastTripDate,
        next_trip_date: nextTripDate,
        debt: debt > 0 ? debt : undefined,
      };
    });

    // Apply role filter if specified
    let filteredParties = parties;
    if (role === "client") {
      filteredParties = parties.filter((p: any) => clientSet.has(p.id));
    } else if (role === "supplier") {
      filteredParties = parties.filter((p: any) => supplierMap.has(p.id));
    } else if (role === "subagent") {
      filteredParties = parties.filter((p: any) => subagentMap.has(p.id));
    }

    // Build response records
    const records = filteredParties.map((party: any) => {
      const person = personMap.get(party.id);
      const company = companyMap.get(party.id);
      const supplier = supplierMap.get(party.id);
      const subagent = subagentMap.get(party.id);

      const record = buildDirectoryRecord({
        ...party,
        ...person,
        ...company,
        is_client: clientSet.has(party.id),
        is_supplier: !!supplier,
        is_subagent: !!subagent,
        ...supplier,
        ...subagent,
        ...statisticsMap[party.id],
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


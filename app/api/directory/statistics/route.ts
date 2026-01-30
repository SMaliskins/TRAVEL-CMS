import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function getCompanyId(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  return data?.company_id || null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      console.error("[Statistics] Company not found for user:", user.id);
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    console.log("[Statistics] Fetching stats for company_id:", companyId);

    // First, get all party IDs for this company
    const { data: parties, error: partiesError } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("company_id", companyId);

    if (partiesError) {
      console.error("[Statistics] Error fetching parties:", partiesError);
      return NextResponse.json(
        { error: "Failed to fetch parties" },
        { status: 500 }
      );
    }

    const partyIds = (parties || []).map(p => p.id);
    console.log("[Statistics] Found", partyIds.length, "parties for company");

    if (partyIds.length === 0) {
      return NextResponse.json({
        totals: {
          clients: 0,
          suppliers: 0,
          subagents: 0,
          total: 0,
        },
        clientsByNationality: [],
        suppliersByCountry: [],
      });
    }

    // Run all count + list queries in parallel (one round-trip batch)
    const [
      { count: clientsCount, error: clientsError },
      { count: suppliersCount, error: suppliersError },
      { count: subagentsCount, error: subagentsError },
      { data: clientParties },
      { data: supplierParties },
    ] = await Promise.all([
      supabaseAdmin
        .from("client_party")
        .select("id", { count: "exact", head: true })
        .in("party_id", partyIds),
      supabaseAdmin
        .from("partner_party")
        .select("id", { count: "exact", head: true })
        .in("party_id", partyIds)
        .eq("partner_role", "supplier"),
      supabaseAdmin
        .from("subagents")
        .select("id", { count: "exact", head: true })
        .in("party_id", partyIds),
      supabaseAdmin
        .from("client_party")
        .select("party_id")
        .in("party_id", partyIds),
      supabaseAdmin
        .from("partner_party")
        .select("party_id")
        .in("party_id", partyIds)
        .eq("partner_role", "supplier"),
    ]);

    if (clientsError) console.error("[Statistics] Error counting clients:", clientsError);
    if (suppliersError) console.error("[Statistics] Error counting suppliers:", suppliersError);
    if (subagentsError) console.error("[Statistics] Error counting subagents:", subagentsError);
    console.log("[Statistics] Counts:", { clientsCount, suppliersCount, subagentsCount });

    const clientPartyIds = (clientParties || []).map((cp: { party_id: string }) => cp.party_id);
    const supplierPartyIds = (supplierParties || []).map((sp: { party_id: string }) => sp.party_id);

    // Fetch nationality and country aggregates in parallel (second batch)
    const [clientPartyRows, supplierPartyRows] = await Promise.all([
      clientPartyIds.length > 0
        ? supabaseAdmin
            .from("party")
            .select("nationality")
            .in("id", clientPartyIds)
            .not("nationality", "is", null)
            .then(({ data }) => data || [])
        : Promise.resolve([]),
      supplierPartyIds.length > 0
        ? supabaseAdmin
            .from("party")
            .select("country")
            .in("id", supplierPartyIds)
            .not("country", "is", null)
            .then(({ data }) => data || [])
        : Promise.resolve([]),
    ]);

    const nationalityCount: Record<string, number> = {};
    clientPartyRows.forEach((p: { nationality: string | null }) => {
      const nat = p.nationality || "Unknown";
      nationalityCount[nat] = (nationalityCount[nat] || 0) + 1;
    });
    const clientsByNationality = Object.entries(nationalityCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    const countryCount: Record<string, number> = {};
    supplierPartyRows.forEach((p: { country: string | null }) => {
      const country = p.country || "Unknown";
      countryCount[country] = (countryCount[country] || 0) + 1;
    });
    const suppliersByCountry = Object.entries(countryCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totals: {
        clients: clientsCount || 0,
        suppliers: suppliersCount || 0,
        subagents: subagentsCount || 0,
        total: (clientsCount || 0) + (suppliersCount || 0) + (subagentsCount || 0),
      },
      clientsByNationality,
      suppliersByCountry,
    });
  } catch (error) {
    console.error("Directory statistics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}

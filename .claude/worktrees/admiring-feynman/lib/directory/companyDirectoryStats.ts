/**
 * Pre-computed directory statistics per company.
 * Stats are recalculated on create/update/delete of directory records.
 * Dashboard reads from company_directory_stats instead of recalculating.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface CompanyDirectoryStats {
  totals: {
    clients: number;
    suppliers: number;
    subagents: number;
    total: number;
  };
  clientsByNationality: { country: string; count: number }[];
  suppliersByCountry: { country: string; count: number }[];
}

/**
 * Recalculate and upsert company_directory_stats for a company.
 * Call after create/update/delete of party, client_party, partner_party, subagents.
 */
export async function recalculateCompanyDirectoryStats(
  companyId: string
): Promise<CompanyDirectoryStats | null> {
  try {
    const { data: parties, error: partiesError } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "active");

    if (partiesError) {
      console.error("[companyDirectoryStats] Error fetching parties:", partiesError);
      return null;
    }

    const partyIds = (parties || []).map((p) => p.id);

    if (partyIds.length === 0) {
      const emptyStats: CompanyDirectoryStats = {
        totals: { clients: 0, suppliers: 0, subagents: 0, total: 0 },
        clientsByNationality: [],
        suppliersByCountry: [],
      };
      await upsertStats(companyId, emptyStats);
      return emptyStats;
    }

    const [
      { count: clientsCount },
      { count: suppliersCount },
      { count: subagentsCount },
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

    const clientPartyIds = (clientParties || []).map((cp: { party_id: string }) => cp.party_id);
    const supplierPartyIds = (supplierParties || []).map((sp: { party_id: string }) => sp.party_id);

    const [clientNationalityRows, supplierPartyRows] = await Promise.all([
      clientPartyIds.length > 0
        ? supabaseAdmin
            .from("party_person")
            .select("party_id, nationality, citizenship, is_alien_passport, passport_issuing_country")
            .in("party_id", clientPartyIds)
            .then(({ data }) => data || [])
        : Promise.resolve([]),
      supplierPartyIds.length > 0
        ? supabaseAdmin
            .from("party")
            .select("country")
            .in("id", supplierPartyIds)
            .then(({ data }) => data || [])
        : Promise.resolve([]),
    ]);

    const nationalityCount: Record<string, number> = {};
    const clientPartyIdsWithNat = new Set(
      (clientNationalityRows as { party_id: string }[]).map((r) => r.party_id)
    );
    (clientNationalityRows as { party_id: string; nationality: string | null; citizenship?: string | null; is_alien_passport?: boolean; passport_issuing_country?: string | null }[]).forEach((p) => {
      // Alien's passport (LV/EE): count by passport issuing country
      const nat = p.is_alien_passport && p.passport_issuing_country?.trim()
        ? p.passport_issuing_country.trim()
        : (p.nationality?.trim() || p.citizenship?.trim() || "Unknown");
      nationalityCount[nat] = (nationalityCount[nat] || 0) + 1;
    });
    const clientsWithoutNat = clientPartyIds.filter((id) => !clientPartyIdsWithNat.has(id));
    if (clientsWithoutNat.length > 0) {
      nationalityCount["Unknown"] = (nationalityCount["Unknown"] || 0) + clientsWithoutNat.length;
    }
    const clientsByNationality = Object.entries(nationalityCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    const countryCount: Record<string, number> = {};
    (supplierPartyRows as { country: string | null }[]).forEach((p) => {
      const country = p.country || "Unknown";
      countryCount[country] = (countryCount[country] || 0) + 1;
    });
    const suppliersByCountry = Object.entries(countryCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    const stats: CompanyDirectoryStats = {
      totals: {
        clients: clientsCount || 0,
        suppliers: suppliersCount || 0,
        subagents: subagentsCount || 0,
        total: (clientsCount || 0) + (suppliersCount || 0) + (subagentsCount || 0),
      },
      clientsByNationality,
      suppliersByCountry,
    };

    await upsertStats(companyId, stats);
    return stats;
  } catch (err) {
    console.error("[companyDirectoryStats] Recalculate error:", err);
    return null;
  }
}

async function upsertStats(
  companyId: string,
  stats: CompanyDirectoryStats
): Promise<void> {
  const row = {
    company_id: companyId,
    clients_count: stats.totals.clients,
    suppliers_count: stats.totals.suppliers,
    subagents_count: stats.totals.subagents,
    clients_by_nationality: stats.clientsByNationality,
    suppliers_by_country: stats.suppliersByCountry,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("company_directory_stats")
    .upsert(row, {
      onConflict: "company_id",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("[companyDirectoryStats] Upsert error:", error);
  }
}

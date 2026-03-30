import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DirectoryRecord } from "@/lib/types/directory";
import { buildDirectoryRecord, resolveAuditDisplayNamesBatch } from "@/lib/directory/buildDirectoryRecord";

/**
 * Load full DirectoryRecord for many party IDs in a fixed set of batched queries (same merge rules as GET /api/directory/[id]).
 */
export async function loadDirectoryRecordsForPartyIds(
  partyIds: string[],
  companyId: string
): Promise<Map<string, DirectoryRecord>> {
  const out = new Map<string, DirectoryRecord>();
  const uniq = [...new Set(partyIds.filter(Boolean))];
  if (uniq.length === 0) return out;

  const { data: partyRows, error: partyErr } = await supabaseAdmin
    .from("party")
    .select("*")
    .in("id", uniq)
    .eq("company_id", companyId);

  if (partyErr || !partyRows?.length) return out;

  const foundIds = new Set((partyRows as { id: string }[]).map((p) => p.id));
  const ids = uniq.filter((id) => foundIds.has(id));
  if (ids.length === 0) return out;

  const [
    personRes,
    companyRes,
    clientRes,
    supplierRes,
    subagentRes,
    referralRes,
    referralRateRes,
  ] = await Promise.all([
    supabaseAdmin.from("party_person").select("*").in("party_id", ids),
    supabaseAdmin.from("party_company").select("*").in("party_id", ids),
    supabaseAdmin.from("client_party").select("party_id, show_referral_in_app").in("party_id", ids),
    supabaseAdmin.from("partner_party").select("*").in("party_id", ids),
    supabaseAdmin.from("subagents").select("*").in("party_id", ids),
    supabaseAdmin.from("referral_party").select("party_id, default_currency, notes").in("party_id", ids),
    supabaseAdmin.from("referral_party_category_rate").select("party_id, category_id, rate_kind, rate_value").in("party_id", ids),
  ]);

  const personByParty = new Map<string, Record<string, unknown>>();
  for (const r of personRes.data || []) {
    personByParty.set((r as { party_id: string }).party_id, r as Record<string, unknown>);
  }
  const companyByParty = new Map<string, Record<string, unknown>>();
  for (const r of companyRes.data || []) {
    companyByParty.set((r as { party_id: string }).party_id, r as Record<string, unknown>);
  }
  const clientByParty = new Map<string, { show_referral_in_app?: boolean }>();
  for (const r of clientRes.data || []) {
    clientByParty.set((r as { party_id: string }).party_id, r as { show_referral_in_app?: boolean });
  }
  const supplierByParty = new Map<string, Record<string, unknown>>();
  for (const r of supplierRes.data || []) {
    supplierByParty.set((r as { party_id: string }).party_id, r as Record<string, unknown>);
  }
  const subagentByParty = new Map<string, Record<string, unknown>>();
  for (const r of subagentRes.data || []) {
    subagentByParty.set((r as { party_id: string }).party_id, r as Record<string, unknown>);
  }
  const referralByParty = new Map<string, { default_currency?: string; notes?: string | null }>();
  for (const r of referralRes.data || []) {
    referralByParty.set((r as { party_id: string }).party_id, r as { default_currency?: string; notes?: string | null });
  }
  const ratesByParty = new Map<string, { category_id: string; rate_kind: string; rate_value: number | string }[]>();
  for (const r of referralRateRes.data || []) {
    const pid = (r as { party_id: string }).party_id;
    if (!ratesByParty.has(pid)) ratesByParty.set(pid, []);
    const row = r as { category_id: string; rate_kind: string; rate_value: number | string };
    ratesByParty.get(pid)!.push(row);
  }

  const partyById = new Map((partyRows as Record<string, unknown>[]).map((p) => [(p.id as string), p]));

  for (const partyId of ids) {
    const party = partyById.get(partyId);
    if (!party) continue;
    const personData = personByParty.get(partyId);
    const companyData = companyByParty.get(partyId);
    const clientData = clientByParty.get(partyId);
    const supplierData = supplierByParty.get(partyId);
    const subagentData = subagentByParty.get(partyId);
    const referralData = referralByParty.get(partyId);
    const referralRatesData = ratesByParty.get(partyId) || [];

    const merged = {
      ...party,
      ...(personData || {}),
      ...(companyData || {}),
      is_client: !!clientData,
      show_referral_in_app: clientData?.show_referral_in_app,
      is_supplier: !!supplierData,
      is_subagent: !!subagentData,
      is_referral: !!referralData,
      referral_default_currency: referralData?.default_currency,
      referral_notes: referralData?.notes,
      referral_category_rates: referralRatesData,
      ...(supplierData || {}),
      ...(subagentData || {}),
      id: (party as { id: string }).id,
      created_by: (party as { created_by?: string }).created_by,
      updated_by: (party as { updated_by?: string }).updated_by,
      created_at: (party as { created_at?: string }).created_at,
      updated_at: (party as { updated_at?: string }).updated_at,
    };

    out.set(partyId, buildDirectoryRecord(merged));
  }

  await resolveAuditDisplayNamesBatch([...out.values()]);
  return out;
}

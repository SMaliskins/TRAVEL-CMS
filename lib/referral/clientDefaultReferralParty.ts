import type { SupabaseClient } from "@supabase/supabase-js";

/** Years without non-cancelled trip activity before default referral link is cleared */
export const CLIENT_DEFAULT_REFERRAL_IDLE_YEARS = 2;

function parseOrderActivityDate(dateTo: unknown, dateFrom: unknown): Date | null {
  const raw = (dateTo || dateFrom) as string | null | undefined;
  if (!raw || typeof raw !== "string") return null;
  const day = raw.slice(0, 10);
  const d = new Date(`${day}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Latest trip-related date from non-cancelled orders where this party is the lead client.
 */
export async function getClientLastTravelActivityDate(
  db: SupabaseClient,
  companyId: string,
  clientPartyId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("orders")
    .select("date_to, date_from, status")
    .eq("company_id", companyId)
    .eq("client_party_id", clientPartyId)
    .neq("status", "Cancelled");

  if (error || !data?.length) return null;

  let best: Date | null = null;
  for (const row of data) {
    const d = parseOrderActivityDate(row.date_to, row.date_from);
    if (!d) continue;
    if (!best || d > best) best = d;
  }
  return best ? best.toISOString().slice(0, 10) : null;
}

export function isTravelStaleForDefaultReferral(lastActivityIsoDate: string | null): boolean {
  if (!lastActivityIsoDate) return false;
  const last = new Date(`${lastActivityIsoDate.slice(0, 10)}T12:00:00.000Z`);
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - CLIENT_DEFAULT_REFERRAL_IDLE_YEARS);
  return last < cutoff;
}

/**
 * Clears client_party.default_referral_party_id when last non-cancelled trip activity is older than idle window.
 */
export async function maybeClearStaleClientDefaultReferral(
  db: SupabaseClient,
  companyId: string,
  clientPartyId: string
): Promise<{ cleared: boolean; lastTravelDate: string | null }> {
  const { data: cp } = await db
    .from("client_party")
    .select("default_referral_party_id")
    .eq("party_id", clientPartyId)
    .maybeSingle();

  if (!cp?.default_referral_party_id) {
    const lastTravelDate = await getClientLastTravelActivityDate(db, companyId, clientPartyId);
    return { cleared: false, lastTravelDate };
  }

  const lastTravelDate = await getClientLastTravelActivityDate(db, companyId, clientPartyId);
  if (!isTravelStaleForDefaultReferral(lastTravelDate)) {
    return { cleared: false, lastTravelDate };
  }

  await db.from("client_party").update({ default_referral_party_id: null }).eq("party_id", clientPartyId);
  return { cleared: true, lastTravelDate };
}

export async function assertValidDefaultReferralParty(
  db: SupabaseClient,
  companyId: string,
  referralPartyId: string
): Promise<boolean> {
  const { data: p } = await db
    .from("party")
    .select("id")
    .eq("id", referralPartyId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!p) return false;
  const { data: rp } = await db
    .from("referral_party")
    .select("party_id")
    .eq("party_id", referralPartyId)
    .maybeSingle();
  return !!rp;
}

/**
 * Resolves referral party id for a new order / client change: applies idle rule, then reads client_party.
 */
export async function resolveDefaultReferralPartyIdForClient(
  db: SupabaseClient,
  companyId: string,
  clientPartyId: string
): Promise<string | null> {
  await maybeClearStaleClientDefaultReferral(db, companyId, clientPartyId);
  const { data: cp } = await db
    .from("client_party")
    .select("default_referral_party_id")
    .eq("party_id", clientPartyId)
    .maybeSingle();
  const id = (cp?.default_referral_party_id as string | null | undefined) ?? null;
  if (!id) return null;
  const ok = await assertValidDefaultReferralParty(db, companyId, id);
  return ok ? id : null;
}

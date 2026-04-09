import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who may use referral commission APIs (mobile app block + /referral web):
 * - Client with "Show referral section in client app" enabled, or
 * - Referral partner (referral_party row) — they have no client_party row if they are not also a client.
 */
export async function isReferralPortalFeatureAllowed(
  supabase: SupabaseClient,
  partyId: string,
  companyId: string
): Promise<boolean> {
  const [{ data: cp }, { data: ref }] = await Promise.all([
    supabase.from("client_party").select("show_referral_in_app").eq("party_id", partyId).maybeSingle(),
    supabase
      .from("referral_party")
      .select("party_id")
      .eq("party_id", partyId)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);
  return cp?.show_referral_in_app === true || Boolean(ref?.party_id);
}

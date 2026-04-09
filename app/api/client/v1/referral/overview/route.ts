import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedClient, unauthorizedResponse } from "@/lib/client-auth/middleware";
import {
  buildClientReferralOverviewPayload,
  healReferralAccrualsIfStale,
} from "@/lib/referral/buildClientReferralOverviewPayload";
import { isReferralPortalFeatureAllowed } from "@/lib/referral/referralPortalAccess";

/**
 * Referral commission overview for the mobile client app and /referral web portal.
 * Allowed when client_party.show_referral_in_app is on, or the party is a referral partner (referral_party).
 *
 * When CRM never wrote referral_accrual_line rows but orders already have referral_party_id,
 * we run the same sync as the CRM once so the portal is not stuck empty.
 */
export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req);

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("client_profiles")
      .select("crm_client_id")
      .eq("id", client.clientId)
      .single();

    if (profileErr || !profile) {
      return Response.json({ data: null, error: "NOT_FOUND" }, { status: 404 });
    }

    const partyId = profile.crm_client_id as string;

    const { data: party, error: partyErr } = await supabaseAdmin
      .from("party")
      .select("id, company_id")
      .eq("id", partyId)
      .single();

    if (partyErr || !party) {
      return Response.json({ data: null, error: "NOT_FOUND" }, { status: 404 });
    }

    const companyId = party.company_id as string;

    const portalOk = await isReferralPortalFeatureAllowed(supabaseAdmin, partyId, companyId);
    if (!portalOk) {
      return Response.json({ data: null, error: "REFERRAL_APP_DISABLED" }, { status: 403 });
    }

    let payload = await buildClientReferralOverviewPayload(supabaseAdmin, partyId, companyId);

    if (payload.lines.length === 0) {
      await healReferralAccrualsIfStale(supabaseAdmin, partyId, companyId);
      payload = await buildClientReferralOverviewPayload(supabaseAdmin, partyId, companyId);
    }

    return Response.json({
      data: payload,
      error: null,
    });
  } catch {
    return unauthorizedResponse();
  }
}

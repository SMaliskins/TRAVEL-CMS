import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedClient, unauthorizedResponse } from "@/lib/client-auth/middleware";
import { isReferralPortalFeatureAllowed } from "@/lib/referral/referralPortalAccess";

/**
 * Phase B: will return .pkpass (Apple) or redirect to Google Wallet JWT flow.
 * Until PassKit / Google Wallet are configured, returns 501 so the portal can show a friendly message.
 */
export async function GET(req: NextRequest) {
  try {
    const platform = req.nextUrl.searchParams.get("platform");
    if (platform !== "apple" && platform !== "google") {
      return Response.json({ data: null, error: "VALIDATION_ERROR" }, { status: 400 });
    }

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

    const portalOk = await isReferralPortalFeatureAllowed(
      supabaseAdmin,
      partyId,
      party.company_id as string
    );
    if (!portalOk) {
      return Response.json({ data: null, error: "REFERRAL_APP_DISABLED" }, { status: 403 });
    }

    return Response.json(
      {
        data: null,
        error: "WALLET_PASS_NOT_CONFIGURED",
        platform,
      },
      { status: 501 }
    );
  } catch {
    return unauthorizedResponse();
  }
}

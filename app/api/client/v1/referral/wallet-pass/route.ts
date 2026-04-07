import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedClient, unauthorizedResponse } from "@/lib/client-auth/middleware";

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

    const { data: cp } = await supabaseAdmin
      .from("client_party")
      .select("show_referral_in_app")
      .eq("party_id", partyId)
      .maybeSingle();

    if (!cp?.show_referral_in_app) {
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

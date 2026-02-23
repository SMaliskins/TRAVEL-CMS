import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthenticatedClient, unauthorizedResponse } from "@/lib/client-auth/middleware";

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req);
    const { data, error } = await supabaseAdmin
      .from("hotel_offers")
      .select("id, hotel_name, hotel_address, room_name, meal, check_in, check_out, client_amount, currency, status, payment_mode, payment_status, tariff_type, cancellation_policy, created_at")
      .eq("client_party_id", client.crmClientId)
      .in("status", ["sent", "viewed", "confirmed", "payment_pending", "paid", "invoice_pending", "booking_started", "booking_confirmed", "booking_failed"])
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ data: null, error: error.message, message: "Failed to fetch offers" }, { status: 500 });
    }

    // Mark sent offers as viewed when client opens the list.
    const viewedIds = (data ?? []).filter((o) => o.status === "sent").map((o) => o.id);
    if (viewedIds.length > 0) {
      await supabaseAdmin
        .from("hotel_offers")
        .update({ status: "viewed" })
        .in("id", viewedIds);
    }

    return Response.json({ data: data ?? [], error: null, message: "Offers loaded" });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return unauthorizedResponse();
    }
    return Response.json({ data: null, error: "INTERNAL_ERROR", message: "Failed to fetch offers" }, { status: 500 });
  }
}

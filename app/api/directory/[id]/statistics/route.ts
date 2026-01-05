import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify party exists
    const { data: party, error: partyError } = await supabaseAdmin
      .from("party")
      .select("id")
      .eq("id", id)
      .single();

    if (partyError || !party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    // Get client_party_id for this party
    const { data: clientParty } = await supabaseAdmin
      .from("client_party")
      .select("id")
      .eq("party_id", id)
      .maybeSingle();

    if (!clientParty) {
      // Not a client, return empty statistics
      return NextResponse.json({
        total_spent: 0,
        last_trip_date: undefined,
        next_trip_date: undefined,
        debt: 0,
        order_count: 0,
      });
    }

    // Get orders for this party (as client)
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("amount_total, amount_paid, date_from")
      .eq("client_party_id", clientParty.id);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    // Calculate statistics
    const orderList = orders || [];
    const totalSpent = orderList.reduce(
      (sum, o) => sum + (parseFloat(o.amount_total) || 0),
      0
    );
    const totalPaid = orderList.reduce(
      (sum, o) => sum + (parseFloat(o.amount_paid) || 0),
      0
    );
    const debt = totalSpent - totalPaid;

    // Get trip dates
    const dates = orderList
      .map((o) => o.date_from)
      .filter((d) => d)
      .map((d) => new Date(d).getTime())
      .sort((a, b) => a - b);

    const lastTripDate = dates.length > 0
      ? new Date(dates[dates.length - 1]).toISOString().split("T")[0]
      : undefined;

    const futureDates = dates.filter((d) => d > Date.now());
    const nextTripDate = futureDates.length > 0
      ? new Date(futureDates[0]).toISOString().split("T")[0]
      : undefined;

    return NextResponse.json({
      total_spent: totalSpent,
      last_trip_date: lastTripDate,
      next_trip_date: nextTripDate,
      debt: debt > 0 ? debt : 0,
      order_count: orderList.length,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Statistics error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

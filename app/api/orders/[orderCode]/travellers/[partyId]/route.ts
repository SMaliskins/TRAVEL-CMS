import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function getUserAndCompany(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  let user = null;
  
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    }
  }

  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (cookieHeader) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Cookie: cookieHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    }
  }

  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return null;

  return { userId: user.id, companyId: profile.company_id };
}

// PATCH: Update per-traveller itinerary, dates, position or lead flag
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; partyId: string }> }
) {
  try {
    const { orderCode, partyId } = await params;

    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("company_id", auth.companyId)
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await request.json();
    const { itinerary, dateFrom, dateTo, position, isMainClient } = body as {
      itinerary?: unknown;
      dateFrom?: string | null;
      dateTo?: string | null;
      position?: number;
      isMainClient?: boolean;
    };

    const update: Record<string, unknown> = {};
    if (itinerary !== undefined) {
      update.itinerary = itinerary && typeof itinerary === "object" ? itinerary : {};
    }
    if (dateFrom !== undefined) update.date_from = dateFrom || null;
    if (dateTo !== undefined) update.date_to = dateTo || null;
    if (typeof position === "number") update.position = position;
    if (typeof isMainClient === "boolean") update.is_main_client = isMainClient;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // If promoting this traveller to lead, demote others atomically (best-effort).
    if (update.is_main_client === true) {
      await supabaseAdmin
        .from("order_travellers")
        .update({ is_main_client: false })
        .eq("order_id", order.id)
        .eq("company_id", auth.companyId)
        .neq("party_id", partyId);
    }

    const { data: traveller, error: updateError } = await supabaseAdmin
      .from("order_travellers")
      .update(update)
      .eq("order_id", order.id)
      .eq("party_id", partyId)
      .eq("company_id", auth.companyId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating traveller:", updateError);
      return NextResponse.json({ error: "Failed to update traveller" }, { status: 500 });
    }

    return NextResponse.json({ traveller });
  } catch (error) {
    console.error("Traveller PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: Remove a traveller from order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; partyId: string }> }
) {
  try {
    const { orderCode, partyId } = await params;
    
    const auth = await getUserAndCompany(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get order ID
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, client_party_id")
      .eq("company_id", auth.companyId)
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Don't allow removing main client
    if (partyId === order.client_party_id) {
      return NextResponse.json({ error: "Cannot remove main client from order" }, { status: 400 });
    }

    // Check if traveller is assigned to any service in this order
    const { data: serviceAssignments } = await supabaseAdmin
      .from("order_service_travellers")
      .select("id, service_id")
      .eq("traveller_id", partyId)
      .eq("company_id", auth.companyId);

    // Filter to only services in this order
    if (serviceAssignments && serviceAssignments.length > 0) {
      const { data: orderServices } = await supabaseAdmin
        .from("order_services")
        .select("id")
        .eq("order_id", order.id);

      const orderServiceIds = (orderServices || []).map(s => s.id);
      const assignedToOrderServices = serviceAssignments.some(
        sa => orderServiceIds.includes(sa.service_id)
      );

      if (assignedToOrderServices) {
        return NextResponse.json({ 
          error: "Traveller is assigned to services. Remove from services first." 
        }, { status: 400 });
      }
    }

    // Delete from order_travellers
    const { error: deleteError } = await supabaseAdmin
      .from("order_travellers")
      .delete()
      .eq("order_id", order.id)
      .eq("party_id", partyId)
      .eq("company_id", auth.companyId);

    if (deleteError) {
      console.error("Error deleting traveller:", deleteError);
      return NextResponse.json({ error: "Failed to remove traveller" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Traveller DELETE error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

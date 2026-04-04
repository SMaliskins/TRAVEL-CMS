import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToClient } from "@/lib/client-push/sendPush";
import { getApiUser } from "@/lib/auth/getApiUser";
import { syncOrderReferralAccruals } from "@/lib/referral/syncOrderReferralAccruals";
import { buildExpandedOrderAndInvoiceSummary } from "@/lib/orders/orderPageBootstrap";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    // Fetch order by order_code
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("order_code", orderCode)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { order: expanded } = await buildExpandedOrderAndInvoiceSummary(
      supabaseAdmin,
      order as Record<string, unknown>,
      companyId,
      apiUser
    );

    return NextResponse.json({ order: expanded });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order GET error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const body = await request.json();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    // Build update payload - only allow certain fields
    const allowedFields = [
      "status", 
      "client_display_name",
      "client_party_id",
      "countries_cities", 
      "date_from", 
      "date_to",
      "order_type",
      "order_source",
      "referral_party_id",
    ];
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.referral_party_id !== undefined) {
      const rid = body.referral_party_id;
      if (rid === null || rid === "") {
        updateData.referral_party_id = null;
      } else {
        const { data: refOk } = await supabaseAdmin
          .from("referral_party")
          .select("party_id")
          .eq("party_id", rid)
          .eq("company_id", companyId)
          .maybeSingle();
        if (!refOk) {
          return NextResponse.json(
            { error: "Selected party does not have Referral role for this company" },
            { status: 400 }
          );
        }
      }
    }

    if (body.referral_commission_confirmed === true) {
      updateData.referral_commission_confirmed = true;
      updateData.referral_commission_confirmed_at = new Date().toISOString();
      updateData.referral_commission_confirmed_by = apiUser.userId;
    } else if (body.referral_commission_confirmed === false) {
      updateData.referral_commission_confirmed = false;
      updateData.referral_commission_confirmed_at = null;
      updateData.referral_commission_confirmed_by = null;
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ["Draft", "Active", "Cancelled", "Completed", "On hold"];
      if (!validStatuses.includes(updateData.status as string)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
    }

    // Auto-sync client_display_name when client_party_id changes
    if (updateData.client_party_id && !updateData.client_display_name) {
      const { data: partyData } = await supabaseAdmin
        .from("party")
        .select("display_name")
        .eq("id", updateData.client_party_id)
        .single();
      
      if (partyData?.display_name) {
        updateData.client_display_name = partyData.display_name;
        console.log("[Order PATCH] Auto-synced client_display_name:", partyData.display_name);
      }
    }

    // Fetch old order before update (for notification diff)
    const { data: oldOrder } = await supabaseAdmin
      .from("orders")
      .select("id, client_party_id, status, date_from, date_to, countries_cities")
      .eq("company_id", companyId)
      .eq("order_code", orderCode)
      .single();

    // Update order
    console.log("Updating order:", orderCode, "with data:", updateData);
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("company_id", companyId)
      .eq("order_code", orderCode)
      .select()
      .single();

    if (error) {
      console.error("Order update error:", error.message, error.details, error.hint);
      return NextResponse.json({ error: `Failed to update order: ${error.message}` }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const pushFields = ["status", "date_from", "date_to", "countries_cities"];
    const changedFields = pushFields.filter((f) => body[f] !== undefined);

    if (changedFields.length > 0 && order.client_party_id && oldOrder) {
      const fmtD = (d: string | null) => {
        if (!d) return "—";
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
      };

      const dest = order.countries_cities
        ? order.countries_cities.split("|").find((p: string) => !p.startsWith("origin:") && !p.startsWith("return:"))?.split(",")[1]?.trim() || "Your trip"
        : "Your trip";

      const blocks: string[] = [];

      const datesChanged =
        (body.date_from && body.date_from !== oldOrder.date_from) ||
        (body.date_to && body.date_to !== oldOrder.date_to);
      if (datesChanged) {
        const oldFrom = fmtD(oldOrder.date_from);
        const oldTo = fmtD(oldOrder.date_to);
        const newFrom = fmtD(body.date_from ?? oldOrder.date_from);
        const newTo = fmtD(body.date_to ?? oldOrder.date_to);
        blocks.push(`It was: ${oldFrom} — ${oldTo}\nNow: ${newFrom} — ${newTo}`);
      }

      if (body.status && body.status !== oldOrder.status) {
        blocks.push(`It was: ${oldOrder.status || "—"}\nNow: ${body.status}`);
      }

      if (body.countries_cities && body.countries_cities !== oldOrder.countries_cities) {
        blocks.push("Destination has been changed");
      }

      if (blocks.length === 0) blocks.push("Details updated");

      const bodyText = `${dest}\n${blocks.join("\n")}`;

      console.log("[Push] Notification for", orderCode, ":", bodyText);

      sendPushToClient(order.client_party_id, {
        title: "Trip updated",
        body: bodyText,
        type: "order_update",
        refId: order.id,
      }).catch((e: unknown) => console.error("[Push] fire-and-forget error:", e));
    }

    syncOrderReferralAccruals(supabaseAdmin, order.id, companyId).catch((e) =>
      console.warn("[Order PATCH] syncOrderReferralAccruals:", e)
    );

    let referral_party_display_name: string | null = null;
    if (order.referral_party_id) {
      const { data: refParty } = await supabaseAdmin
        .from("party")
        .select("display_name")
        .eq("id", order.referral_party_id)
        .maybeSingle();
      referral_party_display_name = refParty?.display_name ?? null;
    }

    return NextResponse.json({
      order: { ...order, referral_party_display_name },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order PATCH error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}

const DELETE_PASSWORD = "admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const body = await request.json();

    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (apiUser.role !== "supervisor" && apiUser.role !== "director") {
      return NextResponse.json({ error: "Only Supervisor can delete orders" }, { status: 403 });
    }

    if (body.password !== DELETE_PASSWORD) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }

    const { data: order, error: findErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_code")
      .eq("company_id", apiUser.companyId)
      .eq("order_code", orderCode)
      .single();

    if (findErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 1. Delete invoices first (CASCADE removes invoice_items, freeing order_services FK)
    const { error: invErr } = await supabaseAdmin
      .from("invoices")
      .delete()
      .eq("order_id", order.id);

    if (invErr) {
      console.error("Delete invoices error:", invErr);
      return NextResponse.json({ error: `Failed to delete invoices: ${invErr.message}` }, { status: 500 });
    }

    // 2. Delete the order (CASCADE: order_services, order_access, payments, travellers, documents, invoice_reservations)
    const { error: delErr } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("id", order.id);

    if (delErr) {
      console.error("Delete order error:", delErr);
      return NextResponse.json({ error: `Failed to delete order: ${delErr.message}` }, { status: 500 });
    }

    console.log(`[Order DELETE] Order ${orderCode} (${order.id}) deleted by user ${apiUser.userId}`);

    return NextResponse.json({ success: true, orderCode });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Order DELETE error:", errorMsg);
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 });
  }
}

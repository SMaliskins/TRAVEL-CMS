import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { mapOrderServiceRowToListApiItem, type OrderServiceListMapById } from "@/lib/orders/mapOrderServiceRowToListApi";
import { upsertOrderServiceEmbedding } from "@/lib/embeddings/upsert";
import { sendPushToClient } from "@/lib/client-push/sendPush";
import { syncOrderReferralAccruals } from "@/lib/referral/syncOrderReferralAccruals";

async function syncOrderDatesFromServices(orderId: string) {
  try {
    const { data: services } = await supabaseAdmin
      .from("order_services")
      .select("service_date_from, service_date_to")
      .eq("order_id", orderId)
      .neq("res_status", "cancelled");
    if (!services || services.length === 0) return;

    const froms = services.map(s => s.service_date_from).filter(Boolean).sort();
    const tos = services.map(s => s.service_date_to || s.service_date_from).filter(Boolean).sort();
    const minFrom = froms[0] || null;
    const maxTo = tos[tos.length - 1] || null;

    if (minFrom || maxTo) {
      const upd: Record<string, string | null> = {};
      if (minFrom) upd.date_from = minFrom;
      if (maxTo) upd.date_to = maxTo;
      await supabaseAdmin.from("orders").update(upd).eq("id", orderId);
    }
  } catch (e) {
    console.warn("[syncOrderDatesFromServices]", e);
  }
}

/**
 * GET /api/orders/[orderCode]/services/[serviceId]
 * Full row (SELECT *) mapped to the same shape as list GET — for Edit modal (ORDER_PAGE_PERF Step 2b).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const { orderCode, serviceId } = await params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .eq("company_id", companyId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: s, error } = await supabaseAdmin
      .from("order_services")
      .select("*")
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .eq("company_id", companyId)
      .single();

    if (error || !s) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const rowRecord = s as Record<string, unknown>;

    const { data: serviceTravellers } = await supabaseAdmin
      .from("order_service_travellers")
      .select("traveller_id")
      .eq("service_id", serviceId);

    const travellerIds = (serviceTravellers || []).map((st: { traveller_id: string }) => st.traveller_id);

    let categoryMap: Record<string, { type: string; vat_rate: number }> = {};
    const catId = rowRecord.category_id as string | null | undefined;
    if (catId) {
      const { data: cat } = await supabaseAdmin
        .from("travel_service_categories")
        .select("id, type, vat_rate")
        .eq("id", catId)
        .single();
      if (cat) {
        categoryMap[cat.id] = { type: cat.type, vat_rate: cat.vat_rate };
      }
    }

    let contactOverridesMap: Record<number, { address?: string; phone?: string; email?: string }> = {};
    const hotelHid = rowRecord.hotel_hid as number | null | undefined;
    if (hotelHid != null) {
      const { data: ov } = await supabaseAdmin
        .from("hotel_contact_overrides")
        .select("hotel_hid, address, phone, email")
        .eq("company_id", companyId)
        .eq("hotel_hid", hotelHid)
        .maybeSingle();
      if (ov) {
        contactOverridesMap[hotelHid] = {
          address: ov.address?.trim() || undefined,
          phone: ov.phone?.trim() || undefined,
          email: ov.email?.trim() || undefined,
        };
      }
    }

    const byId: OrderServiceListMapById = {
      [String(rowRecord.id)]: {
        supplier_name: rowRecord.supplier_name as string | null,
        supplier_party_id: rowRecord.supplier_party_id as string | null,
        parent_service_id: rowRecord.parent_service_id as string | null,
        service_type: rowRecord.service_type as string | null,
      },
    };
    const parentId = rowRecord.parent_service_id as string | null | undefined;
    if (rowRecord.service_type === "cancellation" && parentId) {
      const { data: parent } = await supabaseAdmin
        .from("order_services")
        .select("id, supplier_name, supplier_party_id, parent_service_id, service_type")
        .eq("id", parentId)
        .eq("order_id", order.id)
        .maybeSingle();
      if (parent) {
        const p = parent as Record<string, unknown>;
        byId[String(p.id)] = {
          supplier_name: p.supplier_name as string | null,
          supplier_party_id: p.supplier_party_id as string | null,
          parent_service_id: p.parent_service_id as string | null,
          service_type: p.service_type as string | null,
        };
      }
    }

    const service = mapOrderServiceRowToListApiItem(rowRecord, {
      travellerIds,
      categoryMap,
      contactOverridesMap,
      byId,
    });

    return NextResponse.json({ service });
  } catch (err) {
    console.error("GET service error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/orders/[orderCode]/services/[serviceId]
 * Update a service
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;
    const body = await request.json();

    // Get order by code
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const { data: existingService } = await supabaseAdmin
      .from("order_services")
      .select("invoice_id")
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .single();

    const isInvoiced = !!existingService?.invoice_id;

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.service_name !== undefined) updates.service_name = body.service_name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.category_id !== undefined) {
      updates.category_id = body.category_id === "" ? null : body.category_id;
    }
    if (body.vat_rate !== undefined) {
      const vr = Number(body.vat_rate);
      updates.vat_rate = Number.isFinite(vr) ? Math.round(vr) : 0;
    }
    if (body.service_price !== undefined) updates.service_price = body.service_price;
    if (body.service_currency !== undefined) updates.service_currency = body.service_currency || "EUR";
    if (body.serviceCurrency !== undefined) updates.service_currency = body.serviceCurrency || "EUR";
    if (body.service_price_foreign !== undefined) updates.service_price_foreign = body.service_price_foreign != null ? parseFloat(String(body.service_price_foreign)) : null;
    if (body.servicePriceForeign !== undefined) updates.service_price_foreign = body.servicePriceForeign != null ? parseFloat(String(body.servicePriceForeign)) : null;
    if (body.exchange_rate !== undefined) updates.exchange_rate = body.exchange_rate != null ? parseFloat(String(body.exchange_rate)) : null;
    if (body.exchangeRate !== undefined) updates.exchange_rate = body.exchangeRate != null ? parseFloat(String(body.exchangeRate)) : null;
    if (body.service_price_foreign != null && body.exchange_rate != null && (body.service_currency || body.serviceCurrency) && (body.service_currency || body.serviceCurrency) !== "EUR") {
      const foreign = parseFloat(String(body.service_price_foreign));
      const rate = parseFloat(String(body.exchange_rate));
      if (Number.isFinite(foreign) && Number.isFinite(rate)) updates.service_price = Math.round(foreign * rate * 100) / 100;
    }
    if (body.servicePriceForeign != null && body.exchangeRate != null && body.serviceCurrency && body.serviceCurrency !== "EUR") {
      const foreign = parseFloat(String(body.servicePriceForeign));
      const rate = parseFloat(String(body.exchangeRate));
      if (Number.isFinite(foreign) && Number.isFinite(rate)) updates.service_price = Math.round(foreign * rate * 100) / 100;
    }
    if (body.actually_paid !== undefined) updates.actually_paid = body.actually_paid != null && body.actually_paid !== "" ? parseFloat(String(body.actually_paid)) : null;
    if (body.actuallyPaid !== undefined) updates.actually_paid = body.actuallyPaid != null && body.actuallyPaid !== "" ? parseFloat(String(body.actuallyPaid)) : null;
    if (body.client_price !== undefined) {
      if (!isInvoiced) {
        updates.client_price = body.client_price;
      }
      // If invoiced, silently skip client_price update (field is locked on frontend)
    }
    if (body.res_status !== undefined) updates.res_status = body.res_status;
    if (body.ref_nr !== undefined) updates.ref_nr = body.ref_nr;
    if (body.ticket_nr !== undefined) updates.ticket_nr = body.ticket_nr;
    if (body.ticket_numbers !== undefined && Array.isArray(body.ticket_numbers)) updates.ticket_numbers = body.ticket_numbers;
    if (body.supplier_party_id !== undefined) updates.supplier_party_id = body.supplier_party_id;
    if (body.supplier_name !== undefined) updates.supplier_name = body.supplier_name;
    if (body.client_party_id !== undefined) updates.client_party_id = body.client_party_id;
    if (body.client_name !== undefined) updates.client_name = body.client_name;
    if (body.payer_party_id !== undefined) updates.payer_party_id = body.payer_party_id;
    if (body.payer_name !== undefined) updates.payer_name = body.payer_name;
    // order_services columns are service_date_from / service_date_to (payload sends these)
    if (body.service_date_from !== undefined) updates.service_date_from = body.service_date_from;
    if (body.service_date_to !== undefined) updates.service_date_to = body.service_date_to;
    if (body.date_from !== undefined) updates.service_date_from = body.date_from;
    if (body.date_to !== undefined) updates.service_date_to = body.date_to;

    // Tour / Hotel / terms (Edit modal sends snake_case)
    if (body.hotel_name !== undefined) updates.hotel_name = body.hotel_name;
    if (body.hotel_hid !== undefined) updates.hotel_hid = body.hotel_hid;
    if (body.hotelHid !== undefined) updates.hotel_hid = body.hotelHid;
    if (body.hotel_star_rating !== undefined) updates.hotel_star_rating = body.hotel_star_rating;
    if (body.hotel_room !== undefined) updates.hotel_room = body.hotel_room;
    if (body.hotel_board !== undefined) updates.hotel_board = body.hotel_board;
    if (body.meal_plan_text !== undefined) updates.meal_plan_text = body.meal_plan_text;
    if (body.transfer_type !== undefined) updates.transfer_type = body.transfer_type;
    if (body.additional_services !== undefined) updates.additional_services = body.additional_services;
    if (body.hotel_address !== undefined) updates.hotel_address = body.hotel_address;
    if (body.hotel_phone !== undefined) updates.hotel_phone = body.hotel_phone;
    if (body.hotel_email !== undefined) updates.hotel_email = body.hotel_email;
    if (body.hotel_bed_type !== undefined) updates.hotel_bed_type = body.hotel_bed_type;
    if (body.hotelBedType !== undefined) updates.hotel_bed_type = body.hotelBedType;
    if (body.hotel_early_check_in !== undefined) updates.hotel_early_check_in = body.hotel_early_check_in;
    if (body.hotel_late_check_in !== undefined) updates.hotel_late_check_in = body.hotel_late_check_in;
    if (body.hotel_early_check_in_time !== undefined) updates.hotel_early_check_in_time = body.hotel_early_check_in_time || null;
    if (body.hotel_late_check_in_time !== undefined) updates.hotel_late_check_in_time = body.hotel_late_check_in_time || null;
    if (body.hotel_room_upgrade !== undefined) updates.hotel_room_upgrade = body.hotel_room_upgrade;
    if (body.hotel_late_check_out !== undefined) updates.hotel_late_check_out = body.hotel_late_check_out;
    if (body.hotel_late_check_out_time !== undefined) updates.hotel_late_check_out_time = body.hotel_late_check_out_time || null;
    if (body.hotel_higher_floor !== undefined) updates.hotel_higher_floor = body.hotel_higher_floor;
    if (body.hotel_king_size_bed !== undefined) updates.hotel_king_size_bed = body.hotel_king_size_bed;
    if (body.hotel_honeymooners !== undefined) updates.hotel_honeymooners = body.hotel_honeymooners;
    if (body.hotel_silent_room !== undefined) updates.hotel_silent_room = body.hotel_silent_room;
    if (body.hotel_repeat_guests !== undefined) updates.hotel_repeat_guests = body.hotel_repeat_guests;
    if (body.hotel_rooms_next_to !== undefined) updates.hotel_rooms_next_to = body.hotel_rooms_next_to;
    if (body.hotel_parking !== undefined) updates.hotel_parking = body.hotel_parking;
    if (body.hotel_preferences_free_text !== undefined) updates.hotel_preferences_free_text = body.hotel_preferences_free_text;
    if (body.hotel_price_per !== undefined) updates.hotel_price_per = body.hotel_price_per === "stay" ? "stay" : (body.hotel_price_per || "night");
    if (body.hotelPricePer !== undefined) updates.hotel_price_per = body.hotelPricePer === "stay" ? "stay" : (body.hotelPricePer || "night");
    if (body.supplier_booking_type !== undefined) updates.supplier_booking_type = body.supplier_booking_type;
    if (body.airline_channel !== undefined) updates.airline_channel = !!body.airline_channel;
    if (body.airline_channel_supplier_id !== undefined) updates.airline_channel_supplier_id = body.airline_channel_supplier_id || null;
    if (body.airline_channel_supplier_name !== undefined) updates.airline_channel_supplier_name = body.airline_channel_supplier_name || null;
    if (body.payment_deadline_deposit !== undefined) updates.payment_deadline_deposit = body.payment_deadline_deposit;
    if (body.payment_deadline_final !== undefined) updates.payment_deadline_final = body.payment_deadline_final;
    if (body.payment_terms !== undefined) updates.payment_terms = body.payment_terms;
    if (body.price_type !== undefined) updates.price_type = body.price_type;
    if (body.refund_policy !== undefined) updates.refund_policy = body.refund_policy;
    if (body.free_cancellation_until !== undefined) updates.free_cancellation_until = body.free_cancellation_until;
    if (body.cancellation_penalty_amount !== undefined) updates.cancellation_penalty_amount = body.cancellation_penalty_amount;
    if (body.cancellation_penalty_percent !== undefined) updates.cancellation_penalty_percent = body.cancellation_penalty_percent;
    if (body.change_fee !== undefined) updates.change_fee = body.change_fee;
    if (body.commission_name !== undefined) updates.commission_name = body.commission_name;
    if (body.commission_rate !== undefined) updates.commission_rate = body.commission_rate;
    if (body.commission_amount !== undefined) updates.commission_amount = body.commission_amount;
    if (body.agent_discount_value !== undefined) updates.agent_discount_value = body.agent_discount_value;
    if (body.agent_discount_type !== undefined) updates.agent_discount_type = body.agent_discount_type;
    if (body.service_price_line_items !== undefined) {
      updates.service_price_line_items = Array.isArray(body.service_price_line_items) ? body.service_price_line_items : [];
      // service_price is sent by client as base + line items total; do not overwrite
    }
    if (body.pickup_location !== undefined) updates.pickup_location = body.pickup_location;
    if (body.dropoff_location !== undefined) updates.dropoff_location = body.dropoff_location;
    if (body.pickup_time !== undefined) updates.pickup_time = body.pickup_time;
    if (body.estimated_duration !== undefined) updates.estimated_duration = body.estimated_duration;
    if (body.linked_flight_id !== undefined) updates.linked_flight_id = body.linked_flight_id;
    if (body.airport_service_flow !== undefined) updates.airport_service_flow = body.airport_service_flow;
    if (body.transfer_routes !== undefined) updates.transfer_routes = Array.isArray(body.transfer_routes) ? body.transfer_routes : null;
    if (body.transfer_mode !== undefined) updates.transfer_mode = body.transfer_mode;
    if (body.vehicle_class !== undefined) updates.vehicle_class = body.vehicle_class;
    if (body.driver_name !== undefined) updates.driver_name = body.driver_name;
    if (body.driver_phone !== undefined) updates.driver_phone = body.driver_phone;
    if (body.driver_notes !== undefined) updates.driver_notes = body.driver_notes;
    if (body.cabin_class !== undefined) updates.cabin_class = body.cabin_class;
    if (body.baggage !== undefined) updates.baggage = body.baggage;
    if (body.flight_segments !== undefined) updates.flight_segments = body.flight_segments;
    if (body.quantity !== undefined) updates.quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    if (body.priceUnits !== undefined) updates.quantity = Math.max(1, Math.floor(Number(body.priceUnits) || 1));
    if (body.pricingPerClient !== undefined && Array.isArray(body.pricingPerClient)) updates.pricing_per_client = body.pricingPerClient;
    // Amendment fields (change/cancellation)
    if (body.parentServiceId !== undefined) updates.parent_service_id = body.parentServiceId || null;
    if (body.serviceType !== undefined) updates.service_type = body.serviceType || "original";
    if (body.ancillaryType !== undefined) updates.ancillary_type = body.ancillaryType || null;
    if (body.cancellationFee !== undefined) updates.cancellation_fee = body.cancellationFee != null ? parseFloat(String(body.cancellationFee)) : null;
    if (body.refundAmount !== undefined) updates.refund_amount = body.refundAmount != null ? parseFloat(String(body.refundAmount)) : null;
    if (body.cancellationRefundType !== undefined) (updates as Record<string, unknown>).cancellation_refund_type = body.cancellationRefundType || null;

    if (body.referral_include_in_commission !== undefined) {
      updates.referral_include_in_commission = !!body.referral_include_in_commission;
    }
    if (body.referralIncludeInCommission !== undefined) {
      updates.referral_include_in_commission = !!body.referralIncludeInCommission;
    }
    if (body.referral_commission_percent_override !== undefined) {
      const v = body.referral_commission_percent_override;
      updates.referral_commission_percent_override =
        v === null || v === "" ? null : parseFloat(String(v));
    }
    if (body.referralCommissionPercentOverride !== undefined) {
      const v = body.referralCommissionPercentOverride;
      updates.referral_commission_percent_override =
        v === null || v === "" ? null : parseFloat(String(v));
    }
    if (updates.referral_commission_percent_override != null && !Number.isFinite(updates.referral_commission_percent_override as number)) {
      return NextResponse.json({ error: "Invalid referral commission percent override" }, { status: 400 });
    }
    if (body.referral_commission_fixed_amount !== undefined) {
      const v = body.referral_commission_fixed_amount;
      updates.referral_commission_fixed_amount =
        v === null || v === "" ? null : parseFloat(String(v));
    }
    if (body.referralCommissionFixedAmount !== undefined) {
      const v = body.referralCommissionFixedAmount;
      updates.referral_commission_fixed_amount =
        v === null || v === "" ? null : parseFloat(String(v));
    }
    if (updates.referral_commission_fixed_amount != null && !Number.isFinite(updates.referral_commission_fixed_amount as number)) {
      return NextResponse.json({ error: "Invalid referral commission fixed amount" }, { status: 400 });
    }

    // Infer service_date_from / service_date_to from flight_segments when dates were cleared in UI but segments still have YYYY-MM-DD
    const rawFlightSegments =
      (Array.isArray(updates.flight_segments) ? updates.flight_segments : null) ||
      (Array.isArray(body.flight_segments) ? body.flight_segments : null);
    if (Array.isArray(rawFlightSegments) && rawFlightSegments.length > 0) {
      type Seg = { departureDate?: string; arrivalDate?: string };
      const segs = rawFlightSegments as Seg[];
      const first = segs[0];
      const last = segs[segs.length - 1];
      const inferFrom =
        typeof first?.departureDate === "string" ? first.departureDate.trim() : "";
      const inferTo =
        (typeof last?.arrivalDate === "string" && last.arrivalDate.trim()) ||
        (typeof last?.departureDate === "string" && last.departureDate.trim()) ||
        inferFrom;
      const strBlank = (v: unknown) =>
        v == null ||
        v === "" ||
        (typeof v === "string" && v.trim() === "");
      if (inferFrom && strBlank(updates.service_date_from)) {
        updates.service_date_from = inferFrom;
      }
      if (inferTo && strBlank(updates.service_date_to)) {
        updates.service_date_to = inferTo;
      }
      if (!strBlank(updates.service_date_from) && strBlank(updates.service_date_to)) {
        updates.service_date_to = updates.service_date_from as string;
      }
    }

    // Fetch old service for notification diff
    const { data: oldSvc } = await supabaseAdmin
      .from("order_services")
      .select("service_name, service_date_from, service_date_to, flight_segments, res_status, category")
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .single();

    updates.updated_at = new Date().toISOString();

    // Update service
    const { data: service, error: updateError } = await supabaseAdmin
      .from("order_services")
      .update(updates)
      .eq("id", serviceId)
      .eq("order_id", order.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update service error:", updateError);
      const pe = updateError as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      const detailLine = [pe.message, pe.details, pe.hint]
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .filter((x, i, a) => a.findIndex((y) => y === x) === i)
        .join(" — ");
      return NextResponse.json(
        {
          error: "Failed to update service",
          details: detailLine || "Unknown database error",
          code: pe.code || undefined,
        },
        { status: 500 }
      );
    }

    upsertOrderServiceEmbedding(serviceId).catch((e) => console.warn("[PATCH service] upsertOrderServiceEmbedding:", e));

    syncOrderDatesFromServices(order.id).catch(() => {});

    const referralSync = await syncOrderReferralAccruals(
      supabaseAdmin,
      order.id,
      order.company_id as string
    );
    if (!referralSync.ok) {
      console.error("[PATCH service] syncOrderReferralAccruals:", referralSync.error);
    }

    const { data: orderForPush } = await supabaseAdmin
      .from("orders")
      .select("client_party_id, countries_cities")
      .eq("id", order.id)
      .single();

    if (orderForPush?.client_party_id && oldSvc) {
      const fmtD = (d: string | null) => {
        if (!d) return "—";
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
      };
      const fmtTime = (t: string | null) => t ? t.substring(0, 5) : "—";

      const blocks: string[] = [];
      const cat = oldSvc.category || service.category || "";
      const name = service.service_name || oldSvc.service_name || "Service";

      // Flight schedule changes
      if (cat.toLowerCase().includes("flight") && body.flight_segments && Array.isArray(oldSvc.flight_segments)) {
        const oldSegs = oldSvc.flight_segments as { departureCity?: string; arrivalCity?: string; departureDate?: string; departureTimeScheduled?: string; arrivalTimeScheduled?: string }[];
        const newSegs = body.flight_segments as typeof oldSegs;
        for (let i = 0; i < Math.max(oldSegs.length, newSegs.length); i++) {
          const o = oldSegs[i];
          const n = newSegs[i];
          if (o && n) {
            const route = `${o.departureCity || "?"}-${o.arrivalCity || "?"}`;
            const oldLine = `${route} ${fmtD(o.departureDate || null)} ${fmtTime(o.departureTimeScheduled || null)}-${fmtTime(o.arrivalTimeScheduled || null)}`;
            const newLine = `${n.departureCity || o.departureCity || "?"}-${n.arrivalCity || o.arrivalCity || "?"} ${fmtD(n.departureDate || o.departureDate || null)} ${fmtTime(n.departureTimeScheduled || o.departureTimeScheduled || null)}-${fmtTime(n.arrivalTimeScheduled || o.arrivalTimeScheduled || null)}`;
            if (oldLine !== newLine) {
              blocks.push(`It was: ${oldLine}\nNow: ${newLine}`);
            }
          }
        }
      }

      // Date changes
      const datesChanged =
        (body.service_date_from && body.service_date_from !== oldSvc.service_date_from) ||
        (body.service_date_to && body.service_date_to !== oldSvc.service_date_to) ||
        (body.date_from && body.date_from !== oldSvc.service_date_from) ||
        (body.date_to && body.date_to !== oldSvc.service_date_to);
      if (datesChanged && blocks.length === 0) {
        const oldFrom = fmtD(oldSvc.service_date_from);
        const oldTo = fmtD(oldSvc.service_date_to);
        const newFrom = fmtD(body.service_date_from ?? body.date_from ?? oldSvc.service_date_from);
        const newTo = fmtD(body.service_date_to ?? body.date_to ?? oldSvc.service_date_to);
        blocks.push(`It was: ${oldFrom} — ${oldTo}\nNow: ${newFrom} — ${newTo}`);
      }

      // Status changes
      if (body.res_status && body.res_status !== oldSvc.res_status) {
        blocks.push(`It was: ${oldSvc.res_status || "—"}\nNow: ${body.res_status}`);
      }

      if (blocks.length === 0) blocks.push("Details updated");

      sendPushToClient(orderForPush.client_party_id, {
        title: "Itinerary updated",
        body: `${name}\n${blocks.join("\n")}`,
        type: "service_update",
        refId: order.id,
      }).catch((e: unknown) => console.error("[Push] fire-and-forget:", e));
    }

    return NextResponse.json({ service, referralSync });
  } catch (err) {
    console.error("PATCH service error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Internal server error", details: msg },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[orderCode]/services/[serviceId]
 * Delete a service (Supervisor only). Removes linked invoice_items first
 * (ON DELETE RESTRICT), then deletes the service. Other FKs use CASCADE/SET NULL.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string; serviceId: string }> }
) {
  try {
    const { orderCode, serviceId } = await params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, company_id")
      .eq("order_code", orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Remove invoice_items referencing this service (FK is ON DELETE RESTRICT)
    const { error: iiError } = await supabaseAdmin
      .from("invoice_items")
      .delete()
      .eq("service_id", serviceId);

    if (iiError) {
      console.error("Delete invoice_items for service error:", iiError);
    }

    // Unlink child services that reference this as parent (ON DELETE SET NULL handled by DB,
    // but explicit clear avoids edge cases)
    await supabaseAdmin
      .from("order_services")
      .update({ parent_service_id: null })
      .eq("parent_service_id", serviceId);

    // Delete the service (order_service_travellers, embeddings = CASCADE; communications = SET NULL)
    const { error: deleteError } = await supabaseAdmin
      .from("order_services")
      .delete()
      .eq("id", serviceId)
      .eq("order_id", order.id);

    if (deleteError) {
      console.error("Delete service error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete service", details: deleteError.message },
        { status: 500 }
      );
    }

    syncOrderDatesFromServices(order.id).catch(() => {});

    const referralSync = await syncOrderReferralAccruals(
      supabaseAdmin,
      order.id,
      order.company_id as string
    );
    if (!referralSync.ok) {
      console.warn("[DELETE service] syncOrderReferralAccruals:", referralSync.error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE service error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

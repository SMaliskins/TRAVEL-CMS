import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/orders/[orderCode]/invoices/reissue
 * Body: { sourceInvoiceId: string }
 * Creates a new invoice from the source (same items, payer, terms), links services to the new invoice,
 * marks the source invoice as status=replaced and replaced_by_invoice_id=newId.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawOrderCode } = await params;
    const orderCode = decodeURIComponent(rawOrderCode);
    const body = await request.json().catch(() => ({}));
    const sourceInvoiceId = body.sourceInvoiceId;

    if (!sourceInvoiceId || typeof sourceInvoiceId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sourceInvoiceId" },
        { status: 400 }
      );
    }

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

    const { data: sourceInvoice, error: sourceError } = await supabaseAdmin
      .from("invoices")
      .select(`
        *,
        invoice_items (
          id,
          service_id,
          service_name,
          service_client,
          service_category,
          service_date_from,
          service_date_to,
          quantity,
          unit_price,
          line_total
        )
      `)
      .eq("id", sourceInvoiceId)
      .eq("order_id", order.id)
      .single();

    if (sourceError || !sourceInvoice) {
      return NextResponse.json(
        { error: "Source invoice not found or does not belong to this order" },
        { status: 404 }
      );
    }

    if (sourceInvoice.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot reissue a cancelled invoice" },
        { status: 400 }
      );
    }

    if (sourceInvoice.status === "replaced") {
      return NextResponse.json(
        { error: "This invoice was already replaced by another" },
        { status: 400 }
      );
    }

    const items = Array.isArray(sourceInvoice.invoice_items) ? sourceInvoice.invoice_items : [];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Source invoice has no items" },
        { status: 400 }
      );
    }

    // Reserve next invoice number (same logic as main route)
    const authHeader = request.headers.get("authorization");
    let userInitials = "XX";
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();
        if (profile) {
          const fn = (profile.first_name || "").trim();
          const ln = (profile.last_name || "").trim();
          if (fn && ln) userInitials = (fn[0] + ln.substring(0, 2)).toUpperCase();
          else if (fn) userInitials = fn.substring(0, 3).toUpperCase().padEnd(3, "X");
        }
      }
    }

    const currentYear = new Date().getFullYear().toString().slice(-2);
    const parts = orderCode.split("-");
    const orderNumRaw = parts[0] ? parseInt(parts[0], 10) : 0;
    const orderNum3 = isNaN(orderNumRaw) ? "001" : String(Math.max(0, orderNumRaw)).padStart(3, "0").slice(-3);
    const prefix = `${orderNum3}${currentYear}`;

    const { data: existingInvs } = await supabaseAdmin
      .from("invoices")
      .select("invoice_number")
      .eq("company_id", order.company_id);

    let maxSeq = 0;
    if (existingInvs) {
      existingInvs.forEach((inv: { invoice_number?: string }) => {
        const m = inv.invoice_number?.match(/^\d{5}-[A-Z]+-(\d{4})$/);
        if (m && inv.invoice_number!.slice(3, 5) === currentYear) {
          const n = parseInt(m[1], 10);
          if (n > maxSeq) maxSeq = n;
        }
        const leg = inv.invoice_number?.match(/^INV-\d{4}-(\d{2})-[A-Z]+-(\d+)$/);
        if (leg && leg[1] === currentYear) {
          const n = parseInt(leg[2], 10);
          if (n > maxSeq) maxSeq = n;
        }
      });
    }

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("reserve_invoice_sequences", {
      p_company_id: order.company_id,
      p_year: currentYear,
      p_count: 1,
      p_min_sequence: maxSeq,
    });

    let start = maxSeq + 1;
    if (!rpcError && rpcData != null) {
      const raw = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const n = typeof raw === "object" && raw !== null && "reserve_invoice_sequences" in raw
        ? (raw as { reserve_invoice_sequences: number }).reserve_invoice_sequences
        : Number(raw);
      if (typeof n === "number" && Number.isInteger(n) && n >= 1) start = n;
    }

    const nextInvoiceNumber = `${prefix}-${userInitials}-${String(start).padStart(4, "0")}`;
    const today = new Date().toISOString().split("T")[0];

    const invoiceData: Record<string, unknown> = {
      invoice_number: nextInvoiceNumber,
      order_id: order.id,
      company_id: order.company_id,
      invoice_date: today,
      due_date: sourceInvoice.due_date ?? null,
      client_name: sourceInvoice.client_name ?? "",
      client_address: sourceInvoice.client_address ?? "",
      client_email: sourceInvoice.client_email ?? "",
      subtotal: sourceInvoice.subtotal ?? 0,
      tax_rate: sourceInvoice.tax_rate ?? 0,
      tax_amount: sourceInvoice.tax_amount ?? 0,
      total: sourceInvoice.total ?? 0,
      notes: sourceInvoice.notes ?? "",
      status: "issued",
      is_credit: sourceInvoice.is_credit ?? false,
      language: sourceInvoice.language ?? "en",
      payer_name: sourceInvoice.payer_name ?? sourceInvoice.client_name ?? "",
      payer_party_id: sourceInvoice.payer_party_id ?? null,
      payer_type: sourceInvoice.payer_type ?? "company",
      payer_address: sourceInvoice.payer_address ?? "",
      payer_email: sourceInvoice.payer_email ?? "",
      payer_phone: sourceInvoice.payer_phone ?? null,
      payer_reg_nr: sourceInvoice.payer_reg_nr ?? null,
      payer_vat_nr: sourceInvoice.payer_vat_nr ?? null,
      payer_personal_code: sourceInvoice.payer_personal_code ?? null,
      payer_bank_name: sourceInvoice.payer_bank_name ?? null,
      payer_bank_account: sourceInvoice.payer_bank_account ?? null,
      payer_bank_swift: sourceInvoice.payer_bank_swift ?? null,
    };

    if (sourceInvoice.deposit_amount != null) invoiceData.deposit_amount = sourceInvoice.deposit_amount;
    if (sourceInvoice.deposit_date != null) invoiceData.deposit_date = sourceInvoice.deposit_date;
    if (sourceInvoice.final_payment_amount != null) invoiceData.final_payment_amount = sourceInvoice.final_payment_amount;
    if (sourceInvoice.final_payment_date != null) invoiceData.final_payment_date = sourceInvoice.final_payment_date;

    const { data: newInvoice, error: insertInvError } = await supabaseAdmin
      .from("invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (insertInvError || !newInvoice) {
      console.error("Reissue: insert invoice error", insertInvError);
      return NextResponse.json(
        { error: "Failed to create new invoice" },
        { status: 500 }
      );
    }

    const newItems = items.map((item: any) => ({
      invoice_id: newInvoice.id,
      service_id: item.service_id ?? null,
      service_name: item.service_name ?? "",
      service_client: item.service_client ?? "",
      service_category: item.service_category ?? "",
      service_date_from: item.service_date_from ?? null,
      service_date_to: item.service_date_to ?? null,
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price ?? 0,
      line_total: item.line_total ?? (item.unit_price ?? 0) * (item.quantity ?? 1),
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from("invoice_items")
      .insert(newItems);

    if (itemsErr) {
      console.error("Reissue: insert items error", itemsErr);
      await supabaseAdmin.from("invoices").delete().eq("id", newInvoice.id);
      return NextResponse.json(
        { error: "Failed to create invoice items" },
        { status: 500 }
      );
    }

    const orderServiceIds = items.map((i: any) => i.service_id).filter(Boolean);
    if (orderServiceIds.length > 0) {
      const { error: unlinkOld } = await supabaseAdmin
        .from("order_services")
        .update({ invoice_id: null })
        .eq("invoice_id", sourceInvoiceId);
      if (unlinkOld) console.error("Reissue: unlink old services", unlinkOld);

      const { error: linkNew } = await supabaseAdmin
        .from("order_services")
        .update({ invoice_id: newInvoice.id })
        .in("id", orderServiceIds);
      if (linkNew) console.error("Reissue: link new services", linkNew);
    }

    const { error: updateOldErr } = await supabaseAdmin
      .from("invoices")
      .update({
        status: "replaced",
        replaced_by_invoice_id: newInvoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceInvoiceId);

    if (updateOldErr) {
      console.error("Reissue: mark source replaced", updateOldErr);
      return NextResponse.json(
        { error: "New invoice created but failed to mark source as replaced" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: { ...newInvoice, invoice_items: newItems },
      previousInvoiceId: sourceInvoiceId,
    });
  } catch (error) {
    console.error("Reissue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

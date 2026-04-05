import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchOrderIdentityByRouteParam } from "@/lib/orders/orderFromRouteParam";

/** Payments linked to active invoices + totals (used for list rows and paymentSummary). */
async function buildInvoicePaymentAggregates(orderId: string): Promise<
  | { ok: true; paidByInvoice: Record<string, number>; paymentSummary: { totalPaid: number; linkedToInvoices: number; deposit: number } }
  | { ok: false; message: string }
> {
  const { data: statusRows, error: statusErr } = await supabaseAdmin
    .from("invoices")
    .select("id, status")
    .eq("order_id", orderId);

  if (statusErr) {
    return { ok: false, message: statusErr.message };
  }

  const activeInvoiceIds = (statusRows || [])
    .filter((inv: { status?: string }) => inv.status !== "cancelled" && inv.status !== "replaced")
    .map((inv: { id: string }) => inv.id);

  const { data: allOrderPayments } = await supabaseAdmin
    .from("payments")
    .select("invoice_id, amount, status")
    .eq("order_id", orderId);

  const paidByInvoice: Record<string, number> = {};
  let linkedTotal = 0;
  let unlinkedTotal = 0;
  let totalOrderPayments = 0;

  if (allOrderPayments) {
    for (const p of allOrderPayments) {
      if ((p as { status?: string }).status === "cancelled") continue;
      const amt = Number(p.amount) || 0;
      totalOrderPayments += amt;
      if (p.invoice_id && activeInvoiceIds.includes(p.invoice_id)) {
        paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + amt;
        linkedTotal += amt;
      } else if (!p.invoice_id) {
        unlinkedTotal += amt;
      }
    }
  }

  return {
    ok: true,
    paidByInvoice,
    paymentSummary: {
      totalPaid: Math.round(totalOrderPayments * 100) / 100,
      linkedToInvoices: Math.round(linkedTotal * 100) / 100,
      deposit: Math.round(unlinkedTotal * 100) / 100,
    },
  };
}

// GET /api/orders/[orderCode]/invoices - List all invoices for an order
// Also supports ?nextNumber=true to get next invoice number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawOrderCode } = await params;

    if (!rawOrderCode?.trim()) {
      return NextResponse.json({ error: "Order code is required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const getNextNumber = searchParams.get('nextNumber') === 'true';
    const countParam = searchParams.get('count');
    const count = countParam ? Math.min(Math.max(1, parseInt(countParam, 10)), 100) : 1;

    let order: { id: string; company_id: string } | null = null;
    let orderCode = "";
    try {
      const identity = await fetchOrderIdentityByRouteParam(supabaseAdmin, rawOrderCode);
      if (!identity) {
        console.error("[Invoices API] Order not found for param:", rawOrderCode);
        return NextResponse.json({ error: "Order not found", orderCode: rawOrderCode }, { status: 404 });
      }
      order = { id: identity.id, company_id: identity.company_id };
      orderCode = identity.order_code;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Invoices API] Supabase connection error:", msg);
      return NextResponse.json(
        { error: "Database connection failed. Please check Supabase configuration and network.", orderCode: rawOrderCode },
        { status: 503 }
      );
    }

    // Reserve next invoice number(s) for this order. Same number returned on every visit until save or release.
    // Cancelled invoice numbers are not in the pool — only issued + reserved count for next sequence.
    if (getNextNumber) {
      const authHeader = request.headers.get("authorization");
      let userInitials = "XX";

      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (!userError && user) {
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();

          if (profile) {
            const firstName = (profile.first_name || "").trim();
            const lastName = (profile.last_name || "").trim();
            if (firstName && lastName) {
              userInitials = (firstName[0] + lastName.substring(0, 2)).toUpperCase();
            } else if (firstName) {
              userInitials = firstName.substring(0, 3).toUpperCase().padEnd(3, "X");
            }
          }
        }
      }

      const currentYear = new Date().getFullYear().toString().slice(-2);
      const seqPart = orderCode.includes("/") ? orderCode.split("/")[0]! : orderCode.split("-")[0]!;
      const orderNumRaw = seqPart ? parseInt(seqPart, 10) : 0;
      const orderNum3 = isNaN(orderNumRaw) ? "001" : String(Math.max(0, orderNumRaw)).padStart(3, "0").slice(-3);
      const prefix = `${orderNum3}${currentYear}`;

      // 1) Existing reserved numbers for this order — return same numbers on every visit
      const { data: existingReserved } = await supabaseAdmin
        .from("invoice_reservations")
        .select("invoice_number")
        .eq("order_id", order.id)
        .eq("status", "reserved")
        .order("invoice_number", { ascending: true });

      const existingNumbers = (existingReserved || []).map((r: { invoice_number: string }) => r.invoice_number);
      if (existingNumbers.length >= count) {
        const out = existingNumbers.slice(0, count);
        if (count <= 1) return NextResponse.json({ nextInvoiceNumber: out[0] });
        return NextResponse.json({ nextInvoiceNumbers: out });
      }

      // 2) Need more: always allocate from sequence (ascending order). Do NOT reuse released numbers —
      //    reusing causes "jumping" (e.g. 0199 then 0050) and perceived missing numbers.
      const needCount = count - existingNumbers.length;

      // Max sequence to avoid collisions: issued/replaced invoices + reserved/used (cancelled excluded)
      const { data: issuedInvoices } = await supabaseAdmin
        .from("invoices")
        .select("invoice_number")
        .eq("company_id", order.company_id)
        .in("status", ["issued", "replaced"]);

      let minSeq = 0;
      if (issuedInvoices) {
        issuedInvoices.forEach((inv: { invoice_number?: string }) => {
          const m = inv.invoice_number?.match(/^\d{5}-[A-Z]+-(\d{4})$/);
          if (m && inv.invoice_number!.slice(3, 5) === currentYear) {
            const n = parseInt(m[1], 10);
            if (n > minSeq) minSeq = n;
          }
        });
      }

      const { data: reservedOrUsed } = await supabaseAdmin
        .from("invoice_reservations")
        .select("invoice_number")
        .eq("company_id", order.company_id)
        .in("status", ["reserved", "used"]);

      if (reservedOrUsed) {
        reservedOrUsed.forEach((r: { invoice_number: string }) => {
          const m = r.invoice_number?.match(/-(\d{4})$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > minSeq) minSeq = n;
          }
        });
      }

      const newNumbers: string[] = [];

      const { data: seqResult, error: rpcErr } = await supabaseAdmin.rpc("reserve_invoice_sequences", {
        p_company_id: order.company_id,
        p_year: currentYear,
        p_count: needCount,
        p_min_sequence: minSeq,
      });
      if (rpcErr) {
        console.error("[Invoices API] reserve_invoice_sequences error:", rpcErr);
        return NextResponse.json({ error: "Failed to reserve invoice number" }, { status: 500 });
      }
      const firstSeq = typeof seqResult === "number" ? seqResult : (seqResult as number[])?.[0] ?? 0;
      for (let i = 0; i < needCount; i++) {
        const num = `${prefix}-${userInitials}-${String(firstSeq + i).padStart(4, "0")}`;
        await supabaseAdmin.from("invoice_reservations").insert({
          company_id: order.company_id,
          order_id: order.id,
          invoice_number: num,
          status: "reserved",
        });
        newNumbers.push(num);
      }

      const allNumbers = [...existingNumbers, ...newNumbers];
      if (allNumbers.length < count) {
        return NextResponse.json({ error: "Failed to reserve enough invoice numbers" }, { status: 500 });
      }

      if (count <= 1) return NextResponse.json({ nextInvoiceNumber: allNumbers[0] });
      return NextResponse.json({ nextInvoiceNumbers: allNumbers.slice(0, count) });
    }

    /** Lightweight: paymentSummary only (Invoices&Payments tab — avoid loading all invoice rows + items). */
    if (searchParams.get("summaryOnly") === "1") {
      const agg = await buildInvoicePaymentAggregates(order.id);
      if (!agg.ok) {
        console.error("[Invoices API] summaryOnly aggregates error:", agg.message);
        return NextResponse.json(
          { error: "Failed to fetch payment summary", details: agg.message, orderId: order.id },
          { status: 500 }
        );
      }
      return NextResponse.json({
        invoices: [],
        orderId: order.id,
        orderCode,
        paymentSummary: agg.paymentSummary,
      });
    }

    const invoiceSelect = `
        *,
        invoice_items (
          id,
          service_id,
          service_name,
          service_client,
          service_category,
          service_date_from,
          service_date_to,
          service_dates_text,
          quantity,
          unit_price,
          line_total
        )
      `;

    const listPageParam = searchParams.get("page");
    let invoices: Array<{
      id: string;
      status?: string;
      total?: string | number;
      [key: string]: unknown;
    }>;
    let paginatedMeta: { page: number; pageSize: number; total: number } | undefined;
    let paidByInvoice: Record<string, number> = {};
    let paymentSummary: { totalPaid: number; linkedToInvoices: number; deposit: number } = {
      totalPaid: 0,
      linkedToInvoices: 0,
      deposit: 0,
    };

    const aggregatesPromise = buildInvoicePaymentAggregates(order.id);

    if (listPageParam !== null) {
      const p = parseInt(listPageParam, 10);
      const pageNum = Number.isFinite(p) && p > 0 ? p : 1;
      const psRaw = parseInt(searchParams.get("pageSize") || "30", 10);
      const pageSize = Number.isFinite(psRaw) ? Math.min(100, Math.max(1, psRaw)) : 30;
      const offset = (pageNum - 1) * pageSize;

      const [invResult, aggResult] = await Promise.all([
        supabaseAdmin
          .from("invoices")
          .select(invoiceSelect, { count: "exact" })
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1),
        aggregatesPromise,
      ]);

      const { data: inv, error: invoicesError, count } = invResult;

      if (invoicesError) {
        console.error("[Invoices API] Error fetching invoices:", invoicesError);
        console.error("[Invoices API] Order ID:", order.id);
        return NextResponse.json(
          { error: "Failed to fetch invoices", details: invoicesError.message, orderId: order.id },
          { status: 500 }
        );
      }
      if (!aggResult.ok) {
        console.error("[Invoices API] Aggregates error:", aggResult.message);
        return NextResponse.json(
          { error: "Failed to fetch invoices", details: aggResult.message, orderId: order.id },
          { status: 500 }
        );
      }
      invoices = inv || [];
      const total = typeof count === "number" ? count : invoices.length;
      paginatedMeta = { page: pageNum, pageSize, total };
      paidByInvoice = aggResult.paidByInvoice;
      paymentSummary = aggResult.paymentSummary;
    } else {
      const [invResult, aggResult] = await Promise.all([
        supabaseAdmin
          .from("invoices")
          .select(invoiceSelect)
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
        aggregatesPromise,
      ]);

      const { data: inv, error: invoicesError } = invResult;

      if (invoicesError) {
        console.error("[Invoices API] Error fetching invoices:", invoicesError);
        console.error("[Invoices API] Order ID:", order.id);
        return NextResponse.json(
          { error: "Failed to fetch invoices", details: invoicesError.message, orderId: order.id },
          { status: 500 }
        );
      }
      if (!aggResult.ok) {
        console.error("[Invoices API] Aggregates error:", aggResult.message);
        return NextResponse.json(
          { error: "Failed to fetch invoices", details: aggResult.message, orderId: order.id },
          { status: 500 }
        );
      }
      invoices = inv || [];
      paidByInvoice = aggResult.paidByInvoice;
      paymentSummary = aggResult.paymentSummary;
    }

    const invoicesWithPaid = (invoices || []).map((inv: { id: string; total?: string | number }) => {
      const paid = paidByInvoice[inv.id] || 0;
      const total = Number(inv.total) || 0;
      return {
        ...inv,
        paid_amount: paid,
        remaining: Math.round((total - paid) * 100) / 100,
      };
    });

    return NextResponse.json({
      invoices: invoicesWithPaid,
      orderId: order.id,
      orderCode: orderCode,
      paymentSummary,
      ...(paginatedMeta ? { pagination: paginatedMeta } : {}),
    });
  } catch (error) {
    console.error("Error in GET /api/orders/[orderCode]/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/orders/[orderCode]/invoices - Create a new invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode: rawOrderCode } = await params;
    const body = await request.json();

    const {
      invoice_number,
      invoice_date,
      due_date,
      // Payer fields (Bill To)
      payer_name,
      payer_party_id,
      payer_type,
      payer_address,
      payer_email,
      payer_phone,
      payer_reg_nr,
      payer_vat_nr,
      payer_personal_code,
      payer_bank_name,
      payer_bank_account,
      payer_bank_swift,
      // Payment terms
      deposit_amount,
      deposit_date,
      final_payment_amount,
      final_payment_date,
      // Legacy client fields (for backward compatibility)
      client_name,
      client_address,
      client_email,
      items, // Array of { service_id, service_name, service_client, service_category, quantity, unit_price }
      linked_service_ids, // Optional: all service IDs to mark as invoiced (when user consolidates lines, items may omit service_id)
      subtotal,
      tax_rate,
      tax_amount,
      total,
      notes,
    } = body;
    const { language, original_invoice_id } = body;
    const isCredit = body.is_credit === true;

    // Validation
    if (!invoice_number || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: invoice_number, items" },
        { status: 400 }
      );
    }

    const identity = await fetchOrderIdentityByRouteParam(supabaseAdmin, rawOrderCode);
    if (!identity) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const order = { id: identity.id, company_id: identity.company_id };

    // Service IDs to link: linked_service_ids (all originally selected) when provided, else derive from items
    const fromItems = items.filter((s: any) => s.service_id != null && s.service_id !== "").map((s: any) => s.service_id);
    const linkedIds = Array.isArray(linked_service_ids)
      ? linked_service_ids.filter((id: unknown) => id != null && String(id).trim() !== "")
      : [];
    const serviceIds = linkedIds.length > 0 ? linkedIds : fromItems;
    if (serviceIds.length > 0) {
      const { data: existingServices, error: checkError } = await supabaseAdmin
        .from("order_services")
        .select("id, invoice_id")
        .in("id", serviceIds);

      if (checkError) {
        console.error("Error checking services:", checkError);
        return NextResponse.json(
          { error: "Failed to check services" },
          { status: 500 }
        );
      }

      const invoicedServices = existingServices?.filter((s: any) => s.invoice_id !== null) || [];

      // Cancelled services (res_status='cancelled') are allowed: e.g. original flight + cancellation (negative) on same invoice
      if (invoicedServices.length > 0) {
        return NextResponse.json(
          { error: "Some services are already invoiced" },
          { status: 400 }
        );
      }
    }

    // For credit invoices: use original invoice number + "-C" when we can resolve the original
    let effectiveInvoiceNumber = String(invoice_number).trim();
    if (isCredit) {
      let sourceInvoiceId: string | null = null;
      if (original_invoice_id && typeof original_invoice_id === "string" && original_invoice_id.trim()) {
        sourceInvoiceId = original_invoice_id.trim();
      } else if (serviceIds.length > 0) {
        const { data: svcRows } = await supabaseAdmin
          .from("order_services")
          .select("id, invoice_id, parent_service_id")
          .in("id", serviceIds);
        const invIds = new Set<string>();
        const parentIds = (svcRows || [])
          .filter((s: any) => !s.invoice_id && s.parent_service_id)
          .map((s: any) => s.parent_service_id);
        for (const s of svcRows || []) {
          if (s.invoice_id) invIds.add(s.invoice_id);
        }
        if (parentIds.length > 0) {
          const { data: parents } = await supabaseAdmin
            .from("order_services")
            .select("id, invoice_id")
            .in("id", parentIds);
          for (const p of parents || []) {
            if (p.invoice_id) invIds.add(p.invoice_id);
          }
        }
        if (invIds.size === 1) sourceInvoiceId = [...invIds][0];
      }
      if (sourceInvoiceId) {
        const { data: srcInv } = await supabaseAdmin
          .from("invoices")
          .select("invoice_number")
          .eq("id", sourceInvoiceId)
          .eq("company_id", order.company_id)
          .maybeSingle();
        if (srcInv?.invoice_number) {
          const origNum = String(srcInv.invoice_number).trim();
          effectiveInvoiceNumber = origNum.endsWith("-C") ? origNum : `${origNum}-C`;
        }
      }
    }

    // Check if invoice number is already in use
    const { data: existingWithNumber } = await supabaseAdmin
      .from("invoices")
      .select("id, status")
      .eq("company_id", order.company_id)
      .eq("invoice_number", effectiveInvoiceNumber)
      .maybeSingle();

    if (existingWithNumber) {
      if (existingWithNumber.status === "cancelled" || existingWithNumber.status === "replaced") {
        // Remove old cancelled/replaced invoice + its items so the number can be reused
        await supabaseAdmin.from("invoice_items").delete().eq("invoice_id", existingWithNumber.id);
        await supabaseAdmin.from("invoices").delete().eq("id", existingWithNumber.id);
      } else {
        return NextResponse.json(
          { error: "Invoice number already in use" },
          { status: 400 }
        );
      }
    }

    // Create invoice - build insert object dynamically to handle missing columns
    // Helper function to convert empty strings to null for date fields
    const normalizeDate = (date: any): string | null => {
      if (!date || date === '' || date === 'null' || date === 'undefined' || (typeof date === 'string' && date.trim() === '')) {
        return null;
      }
      // Ensure it's a valid date string format (YYYY-MM-DD)
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
      }
      return null;
    };

    const invoiceData: any = {
      invoice_number: effectiveInvoiceNumber,
      order_id: order.id,
      company_id: order.company_id,
      invoice_date: invoice_date || new Date().toISOString().split("T")[0],
      due_date: normalizeDate(due_date) || (() => {
        // If due_date is explicitly empty/null, set to null, otherwise default to +14 days
        if (due_date === '' || due_date === null || due_date === undefined) {
          return null;
        }
        return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      })(),
      // Legacy client fields (for backward compatibility)
      client_name: payer_name || client_name || "",
      client_address: payer_address || client_address || "",
      client_email: payer_email || client_email || "",
      subtotal: subtotal || 0,
      tax_rate: tax_rate || 0,
      tax_amount: tax_amount || 0,
      total: total || 0,
      notes: notes || "",
      status: "issued",
      is_credit: body.is_credit || false,
    };

    // Add payer fields if they exist in schema (from add_invoice_payer_fields migration)
    // We'll try to add them, and if they don't exist, Supabase will ignore them
    if (payer_party_id !== undefined) invoiceData.payer_party_id = payer_party_id || null;
    if (payer_name !== undefined) invoiceData.payer_name = payer_name || client_name || "";
    if (payer_type !== undefined) invoiceData.payer_type = payer_type || 'company';
    if (payer_address !== undefined) invoiceData.payer_address = payer_address || client_address || "";
    if (payer_email !== undefined) invoiceData.payer_email = payer_email || client_email || "";
    if (payer_phone !== undefined) invoiceData.payer_phone = payer_phone || null;
    if (payer_reg_nr !== undefined) invoiceData.payer_reg_nr = payer_reg_nr || null;
    if (payer_vat_nr !== undefined) invoiceData.payer_vat_nr = payer_vat_nr || null;
    if (payer_personal_code !== undefined) invoiceData.payer_personal_code = payer_personal_code || null;
    if (payer_bank_name !== undefined) invoiceData.payer_bank_name = payer_bank_name || null;
    if (payer_bank_account !== undefined) invoiceData.payer_bank_account = payer_bank_account || null;
    if (payer_bank_swift !== undefined) invoiceData.payer_bank_swift = payer_bank_swift || null;
    
    // Add payment terms fields if they exist in schema (from add_invoice_payer_fields migration)
    // Only add if values are provided to avoid errors if columns don't exist
    // Note: These fields may not exist in the database yet - if migration hasn't been run
    // In that case, the insert will fail with a column not found error
    // To fix: Run migrations/add_invoice_payment_terms.sql in Supabase SQL Editor
    try {
      // Only add deposit_amount if it has a valid value
      if (deposit_amount !== undefined && deposit_amount !== null && deposit_amount !== '' && !isNaN(Number(deposit_amount))) {
        invoiceData.deposit_amount = Number(deposit_amount);
      }
      // Only add deposit_date if it's a valid date string
      const normalizedDepositDate = normalizeDate(deposit_date);
      if (normalizedDepositDate !== null) {
        invoiceData.deposit_date = normalizedDepositDate;
      }
      // Only add final_payment_amount if it has a valid value
      if (final_payment_amount !== undefined && final_payment_amount !== null && final_payment_amount !== '' && !isNaN(Number(final_payment_amount))) {
        invoiceData.final_payment_amount = Number(final_payment_amount);
      }
      // Only add final_payment_date if it's a valid date string
      const normalizedFinalPaymentDate = normalizeDate(final_payment_date);
      if (normalizedFinalPaymentDate !== null) {
        invoiceData.final_payment_date = normalizedFinalPaymentDate;
      }
    } catch (e) {
      // If columns don't exist, we'll catch the error below
      console.warn('Payment terms fields may not exist in database schema', e);
    }

    if (language !== undefined && language !== null && String(language).trim() !== "") {
      invoiceData.language = String(language).trim();
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error("Error creating invoice:", invoiceError);
      console.error("Invoice data attempted:", {
        invoice_number,
        order_id: order.id,
        company_id: order.company_id,
        invoice_date: invoice_date || new Date().toISOString().split("T")[0],
        due_date: due_date || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      // Check if error is about missing columns
      const errorMessage = invoiceError?.message || "Unknown error";
      if (errorMessage.includes("deposit_amount") || errorMessage.includes("column") && errorMessage.includes("not found")) {
        return NextResponse.json(
          {
            error: `Database schema error: Missing payment terms columns. Please run migration: migrations/add_invoice_payment_terms.sql in Supabase SQL Editor`,
            details: errorMessage
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: `Failed to create invoice: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Mark reservation as used so the number is not returned to the pool
    await supabaseAdmin
      .from("invoice_reservations")
      .update({ status: "used" })
      .eq("order_id", order.id)
      .eq("invoice_number", String(invoice_number).trim())
      .eq("status", "reserved");

    // Create invoice items (service_id null for manual lines)
    const invoiceItems = items.map((item: any) => ({
      invoice_id: invoice.id,
      service_id: item.service_id != null && item.service_id !== "" ? item.service_id : null,
      service_name: item.service_name || "",
      service_client: item.service_client || "",
      service_category: item.service_category || "",
      service_date_from: item.service_date_from || null,
      service_date_to: item.service_date_to || null,
      service_dates_text: item.service_dates_text != null && String(item.service_dates_text).trim() ? String(item.service_dates_text).trim() : null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      line_total: (item.quantity || 1) * (item.unit_price || 0),
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("invoice_items")
      .insert(invoiceItems);

    if (itemsError) {
      console.error("Error creating invoice items:", itemsError);
      console.error("Invoice items attempted:", invoiceItems);
      // Rollback: delete the invoice
      await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json(
        { error: `Failed to create invoice items: ${itemsError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Update order_services to link them to this invoice (only items with service_id)
    if (serviceIds.length > 0) {
      const { error: updateServicesError } = await supabaseAdmin
        .from("order_services")
        .update({ invoice_id: invoice.id })
        .in("id", serviceIds);

      if (updateServicesError) {
        console.error("Error updating services:", updateServicesError);
        console.error("Service IDs attempted:", serviceIds);
        await supabaseAdmin.from("invoice_items").delete().eq("invoice_id", invoice.id);
        await supabaseAdmin.from("invoices").delete().eq("id", invoice.id);
        return NextResponse.json(
          { error: `Failed to update services: ${updateServicesError?.message || "Unknown error"}` },
          { status: 500 }
        );
      }
    }

    // Sync order.client_payment_due_date from invoice (для колонки DUE в списке заказов)
    const orderDueDate = (invoice as any).final_payment_date ?? (invoice as any).due_date ?? null;
    if (orderDueDate) {
      await supabaseAdmin
        .from("orders")
        .update({ client_payment_due_date: orderDueDate })
        .eq("id", order.id);
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        invoice_items: invoiceItems,
      },
    });
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR in POST /api/orders/[orderCode]/invoices:");
    console.error("Error message:", error?.message);
    console.error("Error code:", error?.code);
    console.error("Error details:", error?.details);
    console.error("Full error:", error);
    return NextResponse.json(
      { 
        error: `Internal server error: ${error?.message || "Unknown error"}`,
        code: error?.code || "UNKNOWN",
        details: error?.details || null
      },
      { status: 500 }
    );
  }
}

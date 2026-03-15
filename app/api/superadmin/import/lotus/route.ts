import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseLotusExport, LotusOrder } from "@/lib/import/lotusParser";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const companyId = formData.get("companyId") as string | null;
    const dryRun = formData.get("dryRun") === "true";
    const limitStr = formData.get("limit") as string | null;
    const limit = limitStr ? parseInt(limitStr) : 0;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const text = await file.text();
    let orders = parseLotusExport(text);

    if (limit > 0) {
      orders = orders.slice(0, limit);
    }

    if (orders.length === 0) {
      return NextResponse.json({ error: "No valid records found in file" }, { status: 400 });
    }

    if (dryRun) {
      const orderCodes = orders.map((o) => o.tourNumber).filter(Boolean);
      const { data: existingOrders } = await supabaseAdmin
        .from("orders")
        .select("order_code")
        .eq("company_id", companyId)
        .in("order_code", orderCodes.slice(0, 1000));

      let existingSet = new Set((existingOrders || []).map((o) => o.order_code));

      if (orderCodes.length > 1000) {
        const { data: more } = await supabaseAdmin
          .from("orders")
          .select("order_code")
          .eq("company_id", companyId)
          .in("order_code", orderCodes.slice(1000));
        (more || []).forEach((o) => existingSet.add(o.order_code));
      }

      const newOrders = orders.filter((o) => !existingSet.has(o.tourNumber));
      const existingCount = orders.length - newOrders.length;

      return NextResponse.json({
        dryRun: true,
        totalRecords: orders.length,
        newRecords: newOrders.length,
        existingRecords: existingCount,
        preview: newOrders.slice(0, 5).map(summarizeOrder),
        clients: getUniqueClients(newOrders),
        travellers: getUniqueTravellers(newOrders),
        fieldMapping: buildFieldMapping(orders[0]),
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        try {
          send({ type: "start", total: orders.length });

          const result = await importOrders(orders, companyId, (processed, current) => {
            send({
              type: "progress",
              processed,
              total: orders.length,
              percent: Math.round((processed / orders.length) * 100),
              current,
            });
          });

          send({ type: "done", ...result });
        } catch (err) {
          console.error("[Lotus Import] Stream error:", err);
          send({ type: "error", error: err instanceof Error ? err.message : "Import failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[Lotus Import] Error:", err);
    return NextResponse.json({ error: "Import failed: " + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

function summarizeOrder(o: LotusOrder) {
  return {
    number: o.number,
    tourNumber: o.tourNumber,
    client: o.client.name,
    destination: [o.tourCountry, o.tourCity].filter(Boolean).join(", "),
    dates: `${o.tourFrom || "?"} — ${o.tourTo || "?"}`,
    price: o.finance.clientPrice,
    paid: o.finance.clientPaid,
    debt: o.finance.clientDebt,
    currency: o.currency,
    travellers: o.travellers.map((t) => t.name),
    invoices: o.invoices.length,
    status: o.status,
  };
}

function getUniqueClients(orders: LotusOrder[]) {
  const map = new Map<string, { name: string; personalCode: string; phone: string; email: string }>();
  for (const o of orders) {
    const key = o.client.personalCode || o.client.name;
    if (key && !map.has(key)) {
      map.set(key, {
        name: o.client.name,
        personalCode: o.client.personalCode,
        phone: o.client.phone,
        email: o.client.email,
      });
    }
  }
  return Array.from(map.values());
}

function getUniqueTravellers(orders: LotusOrder[]) {
  const map = new Map<string, { name: string; personalCode: string }>();
  for (const o of orders) {
    for (const t of o.travellers) {
      const key = t.personalCode || t.name;
      if (key && !map.has(key)) map.set(key, t);
    }
  }
  return Array.from(map.values());
}

function buildFieldMapping(sample: LotusOrder) {
  const val = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number") return String(v);
    return String(v).slice(0, 60);
  };

  return [
    { group: "Order", lotusField: "TourNumber", dbTable: "orders", dbColumn: "order_code", sample: val(sample.tourNumber) },
    { group: "Order", lotusField: "TourNumber → parsed", dbTable: "orders", dbColumn: "order_no, order_year", sample: `${parseTourNumber(sample.tourNumber).orderNo}, ${parseTourNumber(sample.tourNumber).orderYear}` },
    { group: "Order", lotusField: "Status", dbTable: "orders", dbColumn: "status", sample: `${sample.status} → ${mapStatus(sample.status, sample.raw)}` },
    { group: "Order", lotusField: "TourCountry + TourCity", dbTable: "orders", dbColumn: "countries_cities", sample: val([sample.tourCity, sample.tourCountry].filter(Boolean).join(", ")) },
    { group: "Order", lotusField: "TourFrom", dbTable: "orders", dbColumn: "date_from", sample: val(sample.tourFrom) },
    { group: "Order", lotusField: "TourTo", dbTable: "orders", dbColumn: "date_to", sample: val(sample.tourTo) },
    { group: "Order", lotusField: "TimeCreated", dbTable: "orders", dbColumn: "created_at", sample: val(sample.createdAt) },
    { group: "Order", lotusField: "TimeModified", dbTable: "orders", dbColumn: "updated_at", sample: val(sample.modifiedAt) },
    { group: "Order", lotusField: "(auto)", dbTable: "orders", dbColumn: "order_source", sample: "TA" },
    { group: "Order", lotusField: "(company user)", dbTable: "orders", dbColumn: "manager_user_id", sample: "first user in company" },
    { group: "Finance", lotusField: "ClientPrice", dbTable: "orders", dbColumn: "amount_total", sample: val(sample.finance.clientPrice) },
    { group: "Finance", lotusField: "ClientPaid", dbTable: "orders", dbColumn: "amount_paid", sample: val(sample.finance.clientPaid) },
    { group: "Finance", lotusField: "ClientDebt", dbTable: "orders", dbColumn: "amount_debt", sample: val(sample.finance.clientDebt) },
    { group: "Finance", lotusField: "RealProfit", dbTable: "orders", dbColumn: "profit_estimated", sample: val(sample.finance.realProfit) },
    { group: "Client", lotusField: "Client", dbTable: "party", dbColumn: "display_name", sample: val(sample.client.name) },
    { group: "Client", lotusField: "CLIENTTYPE", dbTable: "party", dbColumn: "party_type", sample: `${sample.client.type} → ${sample.client.type === "company" ? "company" : "person"}` },
    { group: "Client", lotusField: "ClientPhone", dbTable: "party", dbColumn: "phone", sample: val(sample.client.phone) },
    { group: "Client", lotusField: "ClientMail", dbTable: "party", dbColumn: "email", sample: val(sample.client.email) },
    { group: "Client", lotusField: "Client → parsed", dbTable: "party_person", dbColumn: "first_name, last_name", sample: val(sample.client.name) },
    { group: "Client", lotusField: "ClientID", dbTable: "party_person", dbColumn: "personal_code", sample: val(sample.client.personalCode) },
    { group: "Client", lotusField: "(auto)", dbTable: "client_party", dbColumn: "party_id, client_type", sample: "role: client" },
    { group: "Service", lotusField: "TourCountry — TourCity", dbTable: "order_services", dbColumn: "service_name", sample: val([sample.tourCountry, sample.tourCity].filter(Boolean).join(" — ")) },
    { group: "Service", lotusField: "ClientPrice", dbTable: "order_services", dbColumn: "client_price", sample: val(sample.finance.clientPrice) },
    { group: "Service", lotusField: "Netto", dbTable: "order_services", dbColumn: "service_price", sample: val(sample.finance.netto) },
    { group: "Service", lotusField: "(auto)", dbTable: "order_services", dbColumn: "category", sample: "package" },
    { group: "Travellers", lotusField: "SERVICECLIENT", dbTable: "party + party_person", dbColumn: "display_name, personal_code", sample: val(sample.travellers.map(t => t.name).join(", ")) },
    { group: "Travellers", lotusField: "(link)", dbTable: "order_travellers", dbColumn: "order_id, party_id", sample: `${sample.travellers.length} traveller(s)` },
    { group: "Invoice", lotusField: "INVOICENUMBERS", dbTable: "invoices", dbColumn: "invoice_number", sample: val(sample.invoices[0]?.number) },
    { group: "Invoice", lotusField: "INVOICEDATALIST → payer", dbTable: "invoices", dbColumn: "payer_name", sample: val(sample.invoices[0]?.payer) },
    { group: "Invoice", lotusField: "INVOICEDATALIST → sum", dbTable: "invoices", dbColumn: "total", sample: val(sample.invoices[0]?.sum) },
    { group: "Invoice", lotusField: "INVOICESTATUSESWORD", dbTable: "invoices", dbColumn: "status", sample: val(sample.invoices[0]?.status) },
    { group: "Skipped", lotusField: "Curr / BaseCurr", dbTable: "—", dbColumn: "—", sample: val(sample.currency) },
    { group: "Skipped", lotusField: "TourOperator", dbTable: "—", dbColumn: "—", sample: val(sample.tourOperator) },
    { group: "Skipped", lotusField: "Transport", dbTable: "—", dbColumn: "—", sample: val(sample.transport) },
    { group: "Skipped", lotusField: "TourCategory", dbTable: "—", dbColumn: "—", sample: val(sample.tourCategory) },
    { group: "Skipped", lotusField: "VAT / Netto / Discount", dbTable: "—", dbColumn: "—", sample: `VAT:${sample.finance.vat} Netto:${sample.finance.netto} Disc:${sample.finance.clientDiscount}` },
  ];
}

function parseTourNumber(tourNumber: string): { orderNo: number; orderYear: number } {
  // "0105/26-JF" → orderNo=105, orderYear=2026
  const match = tourNumber.match(/^(\d+)\/(\d{2})/);
  if (match) {
    return {
      orderNo: parseInt(match[1]) || 0,
      orderYear: 2000 + parseInt(match[2]),
    };
  }
  return { orderNo: 0, orderYear: new Date().getFullYear() };
}

function mapStatus(lotusStatus: number, raw: Record<string, string>): string {
  if (lotusStatus === 0 || raw["DateCanceled"]) return "Cancelled";
  if (lotusStatus === 3) return "Completed";
  return "Active";
}

async function getCompanyManagerId(companyId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function importOrders(
  orders: LotusOrder[],
  companyId: string,
  onProgress?: (processed: number, currentTour: string) => void
) {
  const stats = {
    ordersCreated: 0,
    ordersSkipped: 0,
    clientsCreated: 0,
    clientsExisting: 0,
    servicesCreated: 0,
    travellersCreated: 0,
    invoicesCreated: 0,
    errors: [] as string[],
  };

  const partyCache = new Map<string, string>();
  let processed = 0;

  const managerId = await getCompanyManagerId(companyId);
  if (!managerId) {
    stats.errors.push("No user found in company — cannot assign manager_user_id");
    return stats;
  }

  for (const order of orders) {
    try {
      const clientPartyId = await findOrCreateParty(
        companyId,
        managerId,
        {
          displayName: order.client.name,
          personalCode: order.client.personalCode,
          phone: order.client.phone,
          email: order.client.email,
          partyType: order.client.type === "company" ? "company" : "person",
        },
        partyCache,
        stats
      );

      if (!clientPartyId) {
        stats.errors.push(`Order ${order.tourNumber}: failed to create client ${order.client.name}`);
        stats.ordersSkipped++;
        processed++;
        if (onProgress && (processed % 10 === 0 || processed === orders.length)) {
          onProgress(processed, order.tourNumber);
        }
        continue;
      }

      // Check duplicate by order_code
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("company_id", companyId)
        .eq("order_code", order.tourNumber)
        .maybeSingle();

      if (existing) {
        stats.ordersSkipped++;
        processed++;
        if (onProgress && (processed % 10 === 0 || processed === orders.length)) {
          onProgress(processed, order.tourNumber);
        }
        continue;
      }

      const { orderNo, orderYear } = parseTourNumber(order.tourNumber);
      const status = mapStatus(order.status, order.raw);
      const destination = [order.tourCity, order.tourCountry].filter(Boolean).join(", ");

      const orderPayload: Record<string, unknown> = {
        company_id: companyId,
        manager_user_id: managerId,
        order_no: orderNo,
        order_year: orderYear,
        order_code: order.tourNumber,
        order_source: "TA",
        status,
        client_party_id: clientPartyId,
        client_display_name: order.client.name,
        countries_cities: destination,
        date_from: order.tourFrom,
        date_to: order.tourTo,
        amount_total: order.finance.clientPrice,
        amount_paid: order.finance.clientPaid,
        amount_debt: order.finance.clientDebt,
        profit_estimated: order.finance.realProfit,
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: order.modifiedAt || new Date().toISOString(),
      };

      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert(orderPayload)
        .select("id")
        .single();

      if (orderError || !newOrder) {
        const msg = orderError?.message || "insert failed";
        stats.errors.push(`Order ${order.tourNumber}: ${msg}`);
        stats.ordersSkipped++;
        processed++;
        if (onProgress && (processed % 10 === 0 || processed === orders.length)) {
          onProgress(processed, order.tourNumber);
        }
        continue;
      }

      stats.ordersCreated++;

      // Create service (package/tour based on aggregated Lotus data)
      const serviceName = [order.tourCountry, order.tourCity].filter(Boolean).join(" — ") || "Imported tour";
      const { error: svcErr } = await supabaseAdmin.from("order_services").insert({
        company_id: companyId,
        order_id: newOrder.id,
        category: "package",
        service_name: serviceName,
        service_date_from: order.tourFrom,
        service_date_to: order.tourTo,
        client_price: order.finance.clientPrice,
        service_price: order.finance.netto,
        client_party_id: clientPartyId,
        client_name: order.client.name,
        payer_party_id: clientPartyId,
        payer_name: order.client.name,
        res_status: status === "Cancelled" ? "cancelled" : "confirmed",
      });
      if (svcErr) {
        stats.errors.push(`Order ${order.tourNumber}: service failed — ${svcErr.message}`);
      } else {
        stats.servicesCreated++;
      }

      // Create travellers
      for (const traveller of order.travellers) {
        const travellerPartyId = await findOrCreateParty(
          companyId,
          managerId,
          {
            displayName: traveller.name,
            personalCode: traveller.personalCode,
            partyType: "person",
          },
          partyCache,
          stats
        );

        if (travellerPartyId) {
          const { error: tErr } = await supabaseAdmin.from("order_travellers").insert({
            company_id: companyId,
            order_id: newOrder.id,
            party_id: travellerPartyId,
            is_main_client: traveller.name === order.client.name,
          });
          if (!tErr) stats.travellersCreated++;
        }
      }

      // Create invoices
      for (const inv of order.invoices) {
        let invStatus = "issued";
        const statusLower = inv.status.toLowerCase();
        if (statusLower.includes("paid") && inv.debt <= 0) invStatus = "paid";
        else if (statusLower.includes("partial")) invStatus = "issued";
        else if (statusLower.includes("cancel")) invStatus = "cancelled";

        const { error: invError } = await supabaseAdmin
          .from("invoices")
          .insert({
            company_id: companyId,
            order_id: newOrder.id,
            invoice_number: inv.number,
            payer_name: inv.payer,
            total: inv.sum,
            status: invStatus,
          });

        if (!invError) stats.invoicesCreated++;
      }
    } catch (e) {
      stats.errors.push(`Order ${order.tourNumber}: ${e instanceof Error ? e.message : String(e)}`);
      stats.ordersSkipped++;
    }

    processed++;
    if (onProgress && (processed % 10 === 0 || processed === orders.length)) {
      onProgress(processed, order.tourNumber);
    }
  }

  return stats;
}

async function findOrCreateParty(
  companyId: string,
  managerId: string,
  data: {
    displayName: string;
    personalCode?: string;
    phone?: string;
    email?: string;
    partyType?: string;
  },
  cache: Map<string, string>,
  stats: { clientsCreated: number; clientsExisting: number; errors: string[] }
): Promise<string | null> {
  if (!data.displayName || !data.displayName.trim()) return null;

  const cacheKey = data.personalCode || data.displayName;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Search by personal_code in party_person
  if (data.personalCode) {
    const { data: personMatch } = await supabaseAdmin
      .from("party_person")
      .select("party_id")
      .eq("personal_code", data.personalCode)
      .limit(1)
      .maybeSingle();

    if (personMatch) {
      const { data: partyCheck } = await supabaseAdmin
        .from("party")
        .select("id")
        .eq("id", personMatch.party_id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (partyCheck) {
        cache.set(cacheKey, partyCheck.id);
        stats.clientsExisting++;
        return partyCheck.id;
      }
    }
  }

  // Search by display_name
  const { data: byName } = await supabaseAdmin
    .from("party")
    .select("id")
    .eq("company_id", companyId)
    .eq("display_name", data.displayName)
    .eq("status", "active")
    .maybeSingle();

  if (byName) {
    cache.set(cacheKey, byName.id);
    stats.clientsExisting++;
    return byName.id;
  }

  // Create new party
  const nameParts = data.displayName.split(" ");
  const lastName = nameParts[0] || "";
  const firstName = nameParts.slice(1).join(" ") || "";
  const partyType = data.partyType === "company" ? "company" : "person";

  const { data: newParty, error: partyErr } = await supabaseAdmin
    .from("party")
    .insert({
      company_id: companyId,
      display_name: data.displayName,
      party_type: partyType,
      status: "active",
      email: data.email || null,
      phone: data.phone || null,
      created_by: managerId,
    })
    .select("id")
    .single();

  if (partyErr || !newParty) {
    stats.errors.push(`Client "${data.displayName}": ${partyErr?.message || "party insert failed"}`);
    return null;
  }

  // Create party_person record
  if (partyType === "person") {
    const { error: personErr } = await supabaseAdmin.from("party_person").insert({
      party_id: newParty.id,
      first_name: firstName,
      last_name: lastName,
      personal_code: data.personalCode || null,
    });
    if (personErr) {
      stats.errors.push(`Client "${data.displayName}": party_person failed — ${personErr.message}`);
    }
  }

  // Create client_party role
  const { error: clientErr } = await supabaseAdmin.from("client_party").insert({
    party_id: newParty.id,
    client_type: partyType === "company" ? "company" : "person",
  });
  if (clientErr) {
    stats.errors.push(`Client "${data.displayName}": client_party failed — ${clientErr.message}`);
  }

  cache.set(cacheKey, newParty.id);
  stats.clientsCreated++;
  return newParty.id;
}

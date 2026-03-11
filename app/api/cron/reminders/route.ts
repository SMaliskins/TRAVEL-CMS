import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCheckinUrl, getAirlineCheckinInfo } from "@/lib/flights/airlineCheckin";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  buildCheckinEmail,
  buildPassportExpiryEmail,
  buildOverduePaymentEmail,
} from "@/lib/notifications/reminderEmails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { checkin: 0, passport: 0, overdue: 0, errors: [] as string[] };

  try {
    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("id, invoice_email_from, resend_api_key, name, trading_name, legal_name, currency");

    for (const company of companies || []) {
      const agencyEmail = company.invoice_email_from;
      if (!agencyEmail) continue;

      try {
        const c1 = await processCheckins(company);
        const c2 = await processPassports(company);
        const c3 = await processOverdue(company);
        results.checkin += c1;
        results.passport += c2;
        results.overdue += c3;
      } catch (err) {
        results.errors.push(`Company ${company.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    results.errors.push(`Global: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json({ ok: true, ...results });
}

// ─── Check-in Reminders ─────────────────────────────────────────────

async function processCheckins(company: CompanyRow): Promise<number> {
  const now = new Date();
  const maxLookahead = new Date(now.getTime() + 80 * 60 * 60 * 1000); // 80h covers widest check-in window + 1h early reminder

  const { data: services } = await supabaseAdmin
    .from("order_services")
    .select(`
      id, ref_nr, flight_segments, ticket_numbers, client_name,
      orders!inner(order_code, client_display_name, company_id)
    `)
    .eq("orders.company_id", company.id)
    .in("category", ["Flight", "flight"])
    .in("res_status", ["confirmed", "booked"])
    .gte("service_date_from", now.toISOString().slice(0, 10))
    .lte("service_date_from", maxLookahead.toISOString().slice(0, 10));

  let count = 0;

  for (const svc of services || []) {
    const segments = svc.flight_segments as FlightSegment[] | null;
    if (!segments?.length) continue;

    const orderArr = svc.orders as unknown;
    const order = Array.isArray(orderArr) ? orderArr[0] : orderArr as OrderRef | null;
    if (!order) continue;

    const clientName = svc.client_name || order.client_display_name || "—";

    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      if (!seg.flightNumber || !seg.departureDate) continue;

      const depTimeStr = seg.departureTimeScheduled || "00:00";
      const depDateTime = new Date(`${seg.departureDate}T${depTimeStr}`);
      if (isNaN(depDateTime.getTime())) continue;

      const airlineCode = seg.flightNumber.match(/^([A-Z]{2})/i)?.[1]?.toUpperCase();
      if (!airlineCode) continue;

      const info = getAirlineCheckinInfo(airlineCode);
      const checkinHours = info?.checkinHoursBefore ?? 24;
      const checkinOpensAt = new Date(depDateTime.getTime() - checkinHours * 3600000);
      const msUntilOpen = checkinOpensAt.getTime() - now.getTime();

      const bookingRef = svc.ref_nr || svc.ticket_numbers?.[0] || "—";
      const checkinUrl = getCheckinUrl(seg.flightNumber) || "";

      // 1h-before reminder: -60..0 min before check-in opens
      if (msUntilOpen > -1 * 60000 && msUntilOpen <= 60 * 60000) {
        const refId = `checkin_reminder:${svc.id}:${idx}`;
        const inserted = await insertNotification(company.id, {
          type: "checkin_reminder",
          title: `Check-in opens soon: ${seg.flightNumber}`,
          message: `${clientName} — PNR ${bookingRef}. Departure ${depTimeStr}`,
          link: `/orders/${order.order_code}`,
          ref_id: refId,
        });
        if (inserted) {
          const email = buildCheckinEmail({
            flightNumber: seg.flightNumber,
            clientName,
            bookingRef,
            departureTime: depDateTime.toISOString(),
            checkinUrl,
            type: "reminder",
          });
          await sendEmail(company.invoice_email_from!, email.subject, email.html, email.text, undefined, { companyId: company.id });
          count++;
        }
      }

      // Check-in open: 0..15 min after check-in opens
      if (msUntilOpen <= 0 && msUntilOpen > -15 * 60000) {
        const refId = `checkin_open:${svc.id}:${idx}`;
        const inserted = await insertNotification(company.id, {
          type: "checkin_open",
          title: `Check-in NOW OPEN: ${seg.flightNumber}`,
          message: `${clientName} — PNR ${bookingRef}. Check-in: ${checkinUrl}`,
          link: `/orders/${order.order_code}`,
          ref_id: refId,
        });
        if (inserted) {
          const email = buildCheckinEmail({
            flightNumber: seg.flightNumber,
            clientName,
            bookingRef,
            departureTime: depDateTime.toISOString(),
            checkinUrl,
            type: "open",
          });
          await sendEmail(company.invoice_email_from!, email.subject, email.html, email.text, undefined, { companyId: company.id });
          count++;
        }
      }
    }
  }

  return count;
}

// ─── Passport Expiry ─────────────────────────────────────────────────

async function processPassports(company: CompanyRow): Promise<number> {
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  const sixMonthsStr = sixMonthsFromNow.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  // Get party_person records with expiring passports
  const { data: persons } = await supabaseAdmin
    .from("party_person")
    .select(`
      id, first_name, last_name, passport_expiry_date,
      party:party_id (id, company_id, display_name)
    `)
    .not("passport_expiry_date", "is", null)
    .lte("passport_expiry_date", sixMonthsStr)
    .gte("passport_expiry_date", todayStr);

  let count = 0;

  for (const person of persons || []) {
    const partyRaw = person.party as unknown;
    const party = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw as { id: string; company_id: string; display_name: string } | null;
    if (!party || party.company_id !== company.id) continue;

    // Find upcoming orders this person is a traveller on
    const { data: travellers } = await supabaseAdmin
      .from("order_travellers")
      .select("order_id, orders!inner(order_code, date_from, company_id)")
      .eq("party_id", party.id)
      .eq("orders.company_id", company.id)
      .gte("orders.date_from", todayStr);

    for (const t of travellers || []) {
      const orderRaw = t.orders as unknown;
      const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw as { order_code: string; date_from: string } | null;
      if (!order) continue;

      const clientName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || party.display_name || "—";
      const refId = `passport:${person.id}:${order.order_code}`;

      const inserted = await insertNotification(company.id, {
        type: "passport_expiry",
        title: `Passport expiry: ${clientName}`,
        message: `Passport expires ${person.passport_expiry_date} — trip ${order.date_from} (${order.order_code})`,
        link: `/orders/${order.order_code}`,
        ref_id: refId,
      });

      if (inserted) {
        const email = buildPassportExpiryEmail({
          clientName,
          expiryDate: person.passport_expiry_date!,
          tripDate: order.date_from,
          orderCode: order.order_code,
        });
        await sendEmail(company.invoice_email_from!, email.subject, email.html, email.text, undefined, { companyId: company.id });
        count++;
      }
    }
  }

  return count;
}

// ─── Overdue Payments ────────────────────────────────────────────────

async function processOverdue(company: CompanyRow): Promise<number> {
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, total, final_payment_date, due_date, order_id, payer_name, orders(order_code)")
    .eq("company_id", company.id)
    .in("status", ["issued", "sent", "partially_paid"])
    .or(`final_payment_date.lt.${todayStr},due_date.lt.${todayStr}`);

  if (!invoices?.length) return 0;

  const invoiceIds = invoices.map((inv) => inv.id);
  const { data: payments } = await supabaseAdmin
    .from("payments")
    .select("invoice_id, amount")
    .in("invoice_id", invoiceIds)
    .eq("status", "completed");

  const paidByInvoice: Record<string, number> = {};
  for (const p of payments || []) {
    paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + parseFloat(p.amount?.toString() || "0");
  }

  let count = 0;

  for (const inv of invoices) {
    const dueDate = inv.final_payment_date || inv.due_date;
    if (!dueDate || dueDate >= todayStr) continue;

    const total = parseFloat(inv.total?.toString() || "0");
    const paid = paidByInvoice[inv.id] || 0;
    const debt = total - paid;
    if (debt <= 0) continue;

    const orderRaw = inv.orders as unknown;
    const order = Array.isArray(orderRaw) ? orderRaw[0] : orderRaw as { order_code: string } | null;
    const orderCode = order?.order_code || "—";

    const refId = `overdue:${inv.id}`;
    const inserted = await insertNotification(company.id, {
      type: "payment_overdue",
      title: `Overdue: ${inv.invoice_number || inv.id}`,
      message: `${inv.payer_name || "—"} owes €${debt.toFixed(2)} (${orderCode})`,
      link: `/finances/invoices`,
      ref_id: refId,
    });

    if (inserted) {
      const email = buildOverduePaymentEmail({
        invoiceNumber: inv.invoice_number || inv.id,
        amount: debt,
        currency: company.currency || "EUR",
        dueDate,
        orderCode,
        clientName: inv.payer_name || "—",
      });
      await sendEmail(company.invoice_email_from!, email.subject, email.html, email.text, undefined, { companyId: company.id });
      count++;
    }
  }

  return count;
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function insertNotification(
  companyId: string,
  data: { type: string; title: string; message: string; link: string; ref_id: string }
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("staff_notifications")
    .upsert(
      { company_id: companyId, ...data, read: false },
      { onConflict: "company_id,ref_id", ignoreDuplicates: true }
    );
  if (error) {
    if (error.code === "23505") return false; // duplicate
    console.error("Insert notification error:", error);
    return false;
  }
  return true;
}

// ─── Types ───────────────────────────────────────────────────────────

interface CompanyRow {
  id: string;
  invoice_email_from: string | null;
  resend_api_key: string | null;
  name: string | null;
  trading_name: string | null;
  legal_name: string | null;
  currency: string | null;
}

interface FlightSegment {
  flightNumber: string;
  departureDate: string;
  departureTimeScheduled?: string;
}

interface OrderRef {
  order_code: string;
  client_display_name?: string;
  company_id?: string;
}

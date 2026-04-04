/**
 * ORDER_PAGE_PERF Step 3: shared data for order page header + travellers + invoice summary.
 * One parallel batch after the order row is loaded.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiUser } from "@/lib/auth/getApiUser";

export type OrderPageInvoiceSummary = {
  count: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  linkedToInvoices: number;
};

function computeTravellerTitle(gender: string | null | undefined, dob: string | null | undefined): string {
  let ageYears: number | null = null;
  if (dob) {
    const birth = new Date(dob);
    const today = new Date();
    ageYears = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      ageYears--;
    }
  }
  if (ageYears !== null && ageYears < 2) return "Inf";
  if (ageYears !== null && ageYears < 12) return "Chd";
  const g = (gender || "").toLowerCase();
  if (g === "female" || g === "f") {
    if (ageYears !== null && ageYears < 18) return "Ms";
    return "Mrs";
  }
  return "Mr";
}

export async function loadFormattedTravellersForOrder(
  admin: SupabaseClient,
  companyId: string,
  orderCode: string
): Promise<unknown[]> {
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, client_party_id")
    .eq("company_id", companyId)
    .eq("order_code", orderCode)
    .single();

  if (orderError || !order) return [];

  if (order.client_party_id) {
    const { data: existingRecords } = await admin
      .from("order_travellers")
      .select("id")
      .eq("order_id", order.id)
      .eq("party_id", order.client_party_id);

    if (!existingRecords || existingRecords.length === 0) {
      await admin.from("order_travellers").insert({
        company_id: companyId,
        order_id: order.id,
        party_id: order.client_party_id,
        is_main_client: true,
      });
    }
  }

  const { data: travellers, error } = await admin
    .from("order_travellers")
    .select(
      `
        id,
        party_id,
        is_main_client,
        created_at,
        party:party_id (
          id,
          display_name,
          phone,
          email,
          status,
          party_person (
            first_name,
            last_name,
            title,
            dob,
            personal_code,
            avatar_url,
            gender
          )
        )
      `
    )
    .eq("order_id", order.id)
    .eq("company_id", companyId);

  if (error) return [];

  return (travellers || [])
    .filter((t) => {
      const partyRaw = t.party as unknown;
      const party = Array.isArray(partyRaw) ? partyRaw[0] : (partyRaw as { status?: string } | null);
      const status = party?.status ?? "active";
      return status === "active";
    })
    .map((t) => {
      const partyRaw = t.party as unknown;
      const party = Array.isArray(partyRaw)
        ? partyRaw[0]
        : (partyRaw as {
            id: string;
            display_name: string;
            phone: string;
            email: string;
            party_person:
              | {
                  first_name: string;
                  last_name: string;
                  title: string;
                  dob: string;
                  personal_code: string;
                  avatar_url: string;
                  gender: string | null;
                }
              | {
                  first_name: string;
                  last_name: string;
                  title: string;
                  dob: string;
                  personal_code: string;
                  avatar_url: string;
                  gender: string | null;
                }[]
              | null;
          } | null);
      const personRaw = party?.party_person;
      const person = Array.isArray(personRaw) ? personRaw[0] : personRaw;
      const computedTitle = computeTravellerTitle(person?.gender, person?.dob);
      return {
        id: t.party_id,
        firstName: person?.first_name || party?.display_name?.split(" ")[0] || "",
        lastName: person?.last_name || party?.display_name?.split(" ").slice(1).join(" ") || "",
        title: computedTitle,
        dob: person?.dob || null,
        personalCode: person?.personal_code || null,
        contactNumber: party?.phone || null,
        isMainClient: t.is_main_client || t.party_id === order.client_party_id,
        avatarUrl: person?.avatar_url || null,
      };
    });
}

export async function buildExpandedOrderAndInvoiceSummary(
  admin: SupabaseClient,
  order: Record<string, unknown>,
  companyId: string,
  apiUser: ApiUser
): Promise<{ order: Record<string, unknown>; invoiceSummary: OrderPageInvoiceSummary }> {
  const orderId = order.id as string;

  const needDateFill = !order.date_from || !order.date_to;
  const referralId = order.referral_party_id as string | null | undefined;

  const [servicesRes, paymentsRes, invoicesRes, dateServicesRes, refPartyRes] = await Promise.all([
    admin.from("order_services").select("res_status, client_price").eq("order_id", orderId).eq("company_id", companyId),
    admin.from("payments").select("amount, status, invoice_id").eq("order_id", orderId),
    admin
      .from("invoices")
      .select("id, status, total, deposit_date, final_payment_date")
      .eq("order_id", orderId)
      .eq("company_id", companyId)
      .neq("status", "cancelled"),
    needDateFill
      ? admin
          .from("order_services")
          .select("service_date_from, service_date_to")
          .eq("order_id", orderId)
          .eq("company_id", companyId)
          .neq("res_status", "cancelled")
      : Promise.resolve({ data: [] as { service_date_from?: string | null; service_date_to?: string | null }[] }),
    referralId
      ? admin.from("party").select("display_name").eq("id", referralId).maybeSingle()
      : Promise.resolve({ data: null as { display_name?: string | null } | null }),
  ]);

  const services = servicesRes.data || [];
  const activeServices = services.filter((s: { res_status?: string }) => s.res_status !== "cancelled");
  const amountTotalFromServices = activeServices.reduce(
    (sum: number, s: { client_price?: string | number }) => sum + (Number(s.client_price) || 0),
    0
  );

  const orderPayments = paymentsRes.data || [];
  const amountPaid = orderPayments.reduce(
    (sum: number, p: { amount: number; status?: string }) =>
      p.status === "cancelled" ? sum : sum + Number(p.amount),
    0
  );
  const amountDebt = Math.max(0, amountTotalFromServices - amountPaid);

  const storedPaid = Number(order.amount_paid) || 0;
  if (Math.abs(storedPaid - amountPaid) > 0.01) {
    await admin.from("orders").update({ amount_paid: amountPaid, amount_debt: amountDebt }).eq("id", orderId);
  }

  const invoices = (invoicesRes.data || []) as {
    id: string;
    status?: string;
    total?: string | number | null;
    deposit_date?: string | null;
    final_payment_date?: string | null;
  }[];

  const paymentDates: { type: string; date: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  invoices.forEach((inv) => {
    if (inv.deposit_date) paymentDates.push({ type: "deposit", date: inv.deposit_date });
    if (inv.final_payment_date) paymentDates.push({ type: "final", date: inv.final_payment_date });
  });

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status !== "paid" && inv.status !== "processed"
  );
  const dueDatesToCheck: string[] = [];
  unpaidInvoices.forEach((inv) => {
    if (inv.deposit_date) dueDatesToCheck.push(inv.deposit_date);
    if (inv.final_payment_date) dueDatesToCheck.push(inv.final_payment_date);
  });
  let overdueDays: number | null = null;
  dueDatesToCheck.forEach((dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (d < today) {
      const days = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (overdueDays === null || days > overdueDays) overdueDays = days;
    }
  });

  const activeInvoiceIds = invoices
    .filter((inv) => inv.status !== "cancelled" && inv.status !== "replaced")
    .map((inv) => inv.id);

  const paidByInvoice: Record<string, number> = {};
  let linkedTotal = 0;
  let totalOrderPayments = 0;
  for (const p of orderPayments) {
    if ((p as { status?: string }).status === "cancelled") continue;
    const amt = Number((p as { amount: number }).amount) || 0;
    totalOrderPayments += amt;
    const invId = (p as { invoice_id?: string | null }).invoice_id;
    if (invId && activeInvoiceIds.includes(invId)) {
      paidByInvoice[invId] = (paidByInvoice[invId] || 0) + amt;
      linkedTotal += amt;
    }
  }

  const activeForTotals = invoices.filter((inv) => inv.status !== "cancelled" && inv.status !== "replaced");
  const count = activeForTotals.length;
  const totalAmount = activeForTotals.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
  let outstandingAmount = 0;
  for (const inv of activeForTotals) {
    const total = Number(inv.total) || 0;
    const paid = paidByInvoice[inv.id] || 0;
    outstandingAmount += Math.max(0, total - paid);
  }

  const invoiceSummary: OrderPageInvoiceSummary = {
    count,
    totalAmount: Math.round(totalAmount * 100) / 100,
    paidAmount: Math.round(totalOrderPayments * 100) / 100,
    outstandingAmount: Math.round(outstandingAmount * 100) / 100,
    linkedToInvoices: Math.round(linkedTotal * 100) / 100,
  };

  let effectiveDateFrom = order.date_from as string | null | undefined;
  let effectiveDateTo = order.date_to as string | null | undefined;
  if (!effectiveDateFrom || !effectiveDateTo) {
    const dateServices = dateServicesRes.data || [];
    const withDates = dateServices.filter(
      (s: { service_date_from?: string | null; service_date_to?: string | null }) =>
        s.service_date_from != null || s.service_date_to != null
    );
    if (withDates.length > 0) {
      const froms = withDates
        .map((s: { service_date_from?: string | null }) => s.service_date_from)
        .filter(Boolean) as string[];
      const tos = withDates
        .map((s: { service_date_to?: string | null }) => s.service_date_to)
        .filter(Boolean) as string[];
      if (froms.length > 0 && !effectiveDateFrom) effectiveDateFrom = froms.sort()[0];
      if (tos.length > 0 && !effectiveDateTo) effectiveDateTo = tos.sort().reverse()[0];
    }
  }

  let ownerName: string | null = null;
  const ownerUserId = order.owner_user_id as string | null | undefined;
  if (ownerUserId) {
    const { data: profile } = await admin.from("user_profiles").select("first_name, last_name").eq("id", ownerUserId).single();
    if (profile) {
      ownerName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null;
    }
    if (!ownerName) {
      const { data: oldProfile } = await admin
        .from("profiles")
        .select("display_name, initials")
        .eq("user_id", ownerUserId)
        .single();
      if (oldProfile) ownerName = oldProfile.display_name || null;
    }
  }
  if (!ownerName && order.manager_user_id) {
    const { data: managerProfile } = await admin
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", order.manager_user_id as string)
      .single();
    if (managerProfile) {
      ownerName = [managerProfile.first_name, managerProfile.last_name].filter(Boolean).join(" ") || null;
    }
  }
  if (!ownerName && order.created_by) {
    const createdBy = order.created_by as string;
    const { data: creatorProfile } = await admin
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", createdBy)
      .single();
    if (creatorProfile) {
      ownerName = [creatorProfile.first_name, creatorProfile.last_name].filter(Boolean).join(" ") || null;
    }
    if (!ownerName) {
      const { data: creatorOldProfile } = await admin
        .from("profiles")
        .select("display_name, initials")
        .eq("user_id", createdBy)
        .single();
      if (creatorOldProfile) ownerName = creatorOldProfile.display_name || null;
    }
  }
  if (!ownerName && order.created_by) {
    const { data: authUser } = await admin.auth.admin.getUserById(order.created_by as string);
    if (authUser?.user) {
      const meta = authUser.user.user_metadata;
      ownerName =
        meta?.full_name ||
        meta?.name ||
        [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") ||
        authUser.user.email?.split("@")[0] ||
        null;
    }
  }
  if (!ownerName) {
    const { data: currentProfile } = await admin
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", apiUser.userId)
      .single();
    if (currentProfile) {
      ownerName = [currentProfile.first_name, currentProfile.last_name].filter(Boolean).join(" ") || null;
    }
  }

  const referral_party_display_name = refPartyRes.data?.display_name ?? null;

  const expandedOrder: Record<string, unknown> = {
    ...order,
    date_from: effectiveDateFrom ?? order.date_from,
    date_to: effectiveDateTo ?? order.date_to,
    owner_name: ownerName,
    amount_total: amountTotalFromServices,
    amount_paid: amountPaid,
    amount_debt: amountDebt,
    payment_dates: paymentDates,
    overdue_days: overdueDays,
    referral_party_display_name,
  };

  return { order: expandedOrder, invoiceSummary };
}

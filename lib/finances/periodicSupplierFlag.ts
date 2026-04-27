import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers around the `party.is_periodic_supplier` flag introduced for the
 * SUPINV-PERIODIC feature. When a supplier is flagged as periodic, the
 * system:
 *   1. Defaults `order_services.supplier_invoice_requirement` to `'periodic'`
 *      whenever a new service is created with that supplier.
 *   2. On flag flip false → true, backfills all currently-required services
 *      that have NO supplier-invoice document linked, scoped to the company
 *      and to active orders only.
 *
 * "Active orders" excludes Cancelled and Completed orders. Draft, On hold,
 * and Active orders all qualify because their accounting is not closed.
 */

const ACTIVE_ORDER_STATUSES = ["Active", "Draft", "On hold"] as const;

/**
 * Returns true if the given party is a periodic supplier within the user's
 * company. Defensive against missing rows / cross-tenant ids.
 */
export async function isPartyPeriodicSupplier(
  supabase: SupabaseClient,
  companyId: string,
  partyId: string | null | undefined
): Promise<boolean> {
  if (!partyId || !companyId) return false;
  const { data, error } = await supabase
    .from("party")
    .select("id, is_periodic_supplier")
    .eq("id", partyId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) {
    // Fail closed: never auto-flip to periodic if the lookup errored.
    console.warn("[periodicSupplierFlag] lookup failed:", error.message);
    return false;
  }
  return (data as { is_periodic_supplier?: boolean } | null)?.is_periodic_supplier === true;
}

export interface PeriodicBackfillResult {
  servicesUpdated: number;
  ordersAffected: number;
}

/**
 * Sets `supplier_invoice_requirement = 'periodic'` for all required services
 * of the given supplier that:
 *   - belong to an active order in the same company,
 *   - have no active (non-deleted) supplier-invoice document linked.
 *
 * Idempotent: if there are no candidates, returns zero counts.
 */
export async function applyPeriodicSupplierBackfill(
  supabase: SupabaseClient,
  companyId: string,
  partyId: string
): Promise<PeriodicBackfillResult> {
  if (!partyId || !companyId) return { servicesUpdated: 0, ordersAffected: 0 };

  // 1) Candidate services: required, supplier matches, in active orders.
  const { data: candidates, error: candidateError } = await supabase
    .from("order_services")
    .select("id, order_id, orders!inner(status)")
    .eq("company_id", companyId)
    .eq("supplier_party_id", partyId)
    .eq("supplier_invoice_requirement", "required")
    .in("orders.status", ACTIVE_ORDER_STATUSES as unknown as string[]);

  if (candidateError) {
    console.warn("[periodicSupplierFlag] backfill candidates failed:", candidateError.message);
    return { servicesUpdated: 0, ordersAffected: 0 };
  }

  const rows = (candidates || []) as { id: string; order_id: string }[];
  if (rows.length === 0) {
    return { servicesUpdated: 0, ordersAffected: 0 };
  }

  // 2) Exclude services that already have a non-deleted supplier-invoice
  //    document linked. We keep manually-matched invoices intact: those
  //    services are already accounted for and don't need to switch to
  //    periodic billing.
  const candidateIds = rows.map((r) => r.id);
  const { data: linkedDocs, error: linkError } = await supabase
    .from("order_document_service_links")
    .select("service_id, order_documents!inner(document_state)")
    .in("service_id", candidateIds)
    .eq("company_id", companyId);

  if (linkError) {
    console.warn("[periodicSupplierFlag] backfill links lookup failed:", linkError.message);
    return { servicesUpdated: 0, ordersAffected: 0 };
  }

  const linkedServiceIds = new Set<string>();
  for (const link of (linkedDocs || []) as Array<{
    service_id: string;
    order_documents: { document_state?: string | null } | null;
  }>) {
    const state = link.order_documents?.document_state || "active";
    if (state !== "deleted") {
      linkedServiceIds.add(link.service_id);
    }
  }

  const targets = rows.filter((r) => !linkedServiceIds.has(r.id));
  if (targets.length === 0) {
    return { servicesUpdated: 0, ordersAffected: 0 };
  }

  // 3) Bulk update.
  const targetIds = targets.map((r) => r.id);
  const { error: updateError } = await supabase
    .from("order_services")
    .update({ supplier_invoice_requirement: "periodic" })
    .in("id", targetIds)
    .eq("company_id", companyId);

  if (updateError) {
    console.warn("[periodicSupplierFlag] backfill update failed:", updateError.message);
    return { servicesUpdated: 0, ordersAffected: 0 };
  }

  const ordersAffected = new Set(targets.map((r) => r.order_id)).size;
  return { servicesUpdated: targets.length, ordersAffected };
}

/**
 * Client (sale) price on order_services may still be edited while the linked
 * invoice is not finalized — draft or cancelled. Other statuses lock the field.
 */
const CLIENT_PRICE_EDITABLE_INVOICE_STATUSES = new Set(["draft", "cancelled"]);

export function isClientPriceLockedForInvoiceStatus(status: string | null | undefined): boolean {
  if (status == null || status === "") return true;
  return !CLIENT_PRICE_EDITABLE_INVOICE_STATUSES.has(status);
}

/**
 * @param invoiceStatusById map from invoice UUID to status; omit key if invoice row missing
 */
export function clientPriceLockedFromInvoiceLink(
  invoiceId: string | null | undefined,
  invoiceStatusById: Record<string, string | null> | undefined
): boolean {
  if (!invoiceId) return false;
  if (!invoiceStatusById) return true;
  if (!Object.prototype.hasOwnProperty.call(invoiceStatusById, invoiceId)) return true;
  return isClientPriceLockedForInvoiceStatus(invoiceStatusById[invoiceId]);
}

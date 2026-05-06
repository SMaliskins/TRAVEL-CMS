/**
 * Edit / delete payment records (API + UI).
 * Any staff role may change payments; each change is logged on the order (Log tab).
 */
export function canModifyFinancePayments(role: string | null | undefined): boolean {
  return Boolean(String(role || "").trim());
}

export function canManageCashJournal(role: string | null | undefined): boolean {
  const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "supervisor" || normalized === "finance" || normalized === "manager";
}

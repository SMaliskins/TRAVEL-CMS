/** Edit / delete / cancel payment records (API + UI). */
export function canModifyFinancePayments(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "finance" || r === "supervisor";
}

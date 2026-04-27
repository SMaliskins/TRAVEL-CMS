export interface OverdueInvoiceInput {
  id: string;
  invoice_number?: string | null;
  total?: number | string | null;
  due_date?: string | null;
  final_payment_date?: string | null;
  is_credit?: boolean | null;
}

export interface OverduePaymentInput {
  amount?: number | string | null;
  status?: string | null;
}

export interface OverdueDebtSummary {
  overdueAmount: number;
  overdueInPeriodAmount: number;
  overdueCount: number;
  overdueInPeriodCount: number;
}

export function getEffectiveDueDate(invoice: OverdueInvoiceInput): string | null {
  return invoice.final_payment_date || invoice.due_date || null;
}

export function isAppliedPayment(payment: OverduePaymentInput): boolean {
  return payment.status !== "cancelled";
}

export function getAppliedPaymentTotal(payments: OverduePaymentInput[] = []): number {
  return payments.reduce((sum, payment) => {
    if (!isAppliedPayment(payment)) return sum;
    return sum + Number(payment.amount || 0);
  }, 0);
}

export function getInvoiceOutstandingDebt(
  invoice: OverdueInvoiceInput,
  payments: OverduePaymentInput[] = []
): number {
  const total = Number(invoice.total || 0);
  const isCredit = !!invoice.is_credit || String(invoice.invoice_number || "").endsWith("-C");
  const signedTotal = isCredit ? -Math.abs(total) : total;
  const debt = Math.max(0, signedTotal - getAppliedPaymentTotal(payments));
  return Math.round(debt * 100) / 100;
}

export function summarizeOverdueDebt({
  invoices,
  paymentsByInvoice,
  today,
  periodStart,
  periodEnd,
}: {
  invoices: OverdueInvoiceInput[];
  paymentsByInvoice: Record<string, OverduePaymentInput[]>;
  today: string;
  periodStart: string;
  periodEnd: string;
}): OverdueDebtSummary {
  const uniqueInvoices = new Map<string, OverdueInvoiceInput>();
  for (const invoice of invoices) {
    uniqueInvoices.set(invoice.id, invoice);
  }

  let overdueAmount = 0;
  let overdueInPeriodAmount = 0;
  let overdueCount = 0;
  let overdueInPeriodCount = 0;

  for (const invoice of uniqueInvoices.values()) {
    const dueDate = getEffectiveDueDate(invoice);
    if (!dueDate || dueDate >= today) continue;

    const debt = getInvoiceOutstandingDebt(invoice, paymentsByInvoice[invoice.id] || []);
    if (debt <= 0) continue;

    overdueAmount += debt;
    overdueCount += 1;

    if (dueDate >= periodStart && dueDate <= periodEnd) {
      overdueInPeriodAmount += debt;
      overdueInPeriodCount += 1;
    }
  }

  return {
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    overdueInPeriodAmount: Math.round(overdueInPeriodAmount * 100) / 100,
    overdueCount,
    overdueInPeriodCount,
  };
}

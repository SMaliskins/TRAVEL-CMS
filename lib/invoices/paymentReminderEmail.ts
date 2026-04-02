export type PaymentReminderContext = {
  payerName: string;
  invoiceNumber: string;
  orderCode: string;
  outstandingFormatted: string;
  dueDateFormatted: string | null;
  /** When deposit schedule exists and is relevant */
  depositDateFormatted: string | null;
  /** Final payment due date from invoice (optional, for {{final_due_date}}) */
  finalPaymentDateFormatted?: string | null;
  companyDisplayName: string;
};

/** Variables for Settings → Email templates (category payment_reminder), lowercase keys */
export function buildPaymentReminderTemplateVars(
  ctx: PaymentReminderContext,
  invoiceTotalFormatted: string
): Record<string, string> {
  return {
    client_name: ctx.payerName.trim() || "Sir/Madam",
    order_code: ctx.orderCode,
    invoice_number: ctx.invoiceNumber,
    total_amount: ctx.outstandingFormatted,
    outstanding_amount: ctx.outstandingFormatted,
    invoice_total: invoiceTotalFormatted,
    due_date: ctx.depositDateFormatted || ctx.dueDateFormatted || "",
    deposit_due_date: ctx.depositDateFormatted || "",
    invoice_due_date: ctx.dueDateFormatted || "",
    final_due_date: ctx.finalPaymentDateFormatted || "",
    company_name: ctx.companyDisplayName.trim() || "",
    agent_name: "",
    service_name: "",
    dates: "",
    hotel_name: "",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function defaultPaymentReminderSubject(ctx: PaymentReminderContext): string {
  return `Payment reminder: Invoice ${ctx.invoiceNumber} (${ctx.orderCode})`;
}

/** Respectful default copy (English); editable before send in the UI. */
export function defaultPaymentReminderPlainText(ctx: PaymentReminderContext): string {
  const payer = ctx.payerName.trim() || "Sir/Madam";
  const duePart = ctx.depositDateFormatted
    ? `The deposit for this invoice was due on ${ctx.depositDateFormatted}.`
    : ctx.dueDateFormatted
      ? `Payment for this invoice was due on ${ctx.dueDateFormatted}.`
      : "We would be grateful if you could arrange payment at your earliest convenience.";

  return `Dear ${payer},

I hope this message finds you well.

This is a polite reminder regarding invoice ${ctx.invoiceNumber} for booking ${ctx.orderCode}. The outstanding balance is ${ctx.outstandingFormatted}.

${duePart}

If you have already settled this amount, please disregard this message — and thank you. If you need another copy of the invoice or would like to discuss payment, please reply to this email; we will be happy to assist.`;
}

/** Closing (agency name from server when sending). */
export function paymentReminderSignatureHtml(companyDisplayName: string): string {
  const name = companyDisplayName.trim() || "Our team";
  return `<p style="margin-top:16px">Kind regards,<br><strong>${escapeHtml(name)}</strong></p>`;
}

export function plainTextToReminderHtml(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return "<p></p>";
  if (trimmed.includes("<") && trimmed.includes(">")) return trimmed;
  return `<p>${escapeHtml(trimmed).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
}

export function defaultPaymentReminderHtml(ctx: PaymentReminderContext): string {
  return (
    plainTextToReminderHtml(defaultPaymentReminderPlainText(ctx)) + paymentReminderSignatureHtml(ctx.companyDisplayName)
  );
}

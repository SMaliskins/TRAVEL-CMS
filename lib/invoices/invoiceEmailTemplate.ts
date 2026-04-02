import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import {
  substituteEmailTemplatePlaceholders,
  type EmailTemplateRow,
} from "@/lib/email/emailTemplateUtils";
import {
  plainTextToReminderHtml,
  summarizeInvoiceItemsForReminder,
  type InvoiceLineForReminder,
} from "@/lib/invoices/paymentReminderEmail";

function roughHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function formatInvoiceMoneyEur(amount: number): string {
  const n = Number(amount);
  const sign = n < 0 ? "-" : "";
  return `${sign}€${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Placeholders for Settings → Email templates (category `invoice`); keys lowercase for substitution. */
export function buildInvoiceEmailTemplateVars(params: {
  payerName: string;
  orderCode: string;
  invoiceNumber: string;
  invoiceTotalFormatted: string;
  outstandingFormatted: string;
  dueDateFormatted: string | null;
  depositDateFormatted: string | null;
  finalPaymentDateFormatted: string | null;
  companyDisplayName: string;
  items: InvoiceLineForReminder[] | null | undefined;
}): Record<string, string> {
  const hints = summarizeInvoiceItemsForReminder(params.items);
  return {
    client_name: params.payerName.trim() || "Sir/Madam",
    order_code: params.orderCode,
    invoice_number: params.invoiceNumber,
    total_amount: params.invoiceTotalFormatted,
    invoice_total: params.invoiceTotalFormatted,
    outstanding_amount: params.outstandingFormatted,
    amount_due: params.outstandingFormatted,
    due_date: params.depositDateFormatted || params.dueDateFormatted || "",
    deposit_due_date: params.depositDateFormatted || "",
    invoice_due_date: params.dueDateFormatted || "",
    final_due_date: params.finalPaymentDateFormatted || "",
    company_name: params.companyDisplayName.trim() || "",
    agent_name: "",
    service_name: hints.service_name,
    dates: hints.dates,
    hotel_name: "",
  };
}

export function defaultInvoiceEmailSubject(invoiceNumber: string): string {
  return `Invoice ${invoiceNumber}`;
}

export function defaultInvoiceEmailBodyPlain(invoiceNumber: string): string {
  return `Please find attached invoice ${invoiceNumber}.`;
}

/** Appended after signature in invoice emails (HTML). */
export const INVOICE_EMAIL_PDF_FOOTER_HTML =
  '<p style="margin-top:12px;color:#6b7280">Invoice is attached as a PDF file.</p>';

/** HTML body from template or plain default (no PDF footer — added in route). */
export function ensureInvoiceEmailBodyHtml(body: string): string {
  const t = body.trim();
  if (!t) return "<p></p>";
  if (t.includes("<") && t.includes(">")) return t;
  return plainTextToReminderHtml(t);
}

export function formatInvoiceDueParts(invoice: {
  due_date?: string | null;
  deposit_date?: string | null;
  final_payment_date?: string | null;
}): {
  dueDateFormatted: string | null;
  depositDateFormatted: string | null;
  finalPaymentDateFormatted: string | null;
} {
  return {
    dueDateFormatted: invoice.due_date ? formatDateDDMMYYYY(String(invoice.due_date)) : null,
    depositDateFormatted: invoice.deposit_date
      ? formatDateDDMMYYYY(String(invoice.deposit_date))
      : null,
    finalPaymentDateFormatted: invoice.final_payment_date
      ? formatDateDDMMYYYY(String(invoice.final_payment_date))
      : null,
  };
}

export function invoiceOutstandingFormatted(invoice: {
  total: number | string | null;
  paid_amount?: number | null;
  remaining?: number | null;
}): string {
  const totalNum = Number(invoice.total) || 0;
  const paid = Number(invoice.paid_amount) || 0;
  const remaining =
    typeof invoice.remaining === "number"
      ? Math.max(0, invoice.remaining)
      : Math.max(0, totalNum - paid);
  return formatInvoiceMoneyEur(remaining);
}

/**
 * Subject/body for Send Invoice modal and POST. Empty client subject/message → DB template (category invoice) or English default.
 */
export function resolveInvoiceEmailLetter(params: {
  invoiceNumber: string;
  subjectFromClient: string | null | undefined;
  messageFromClient: string | null | undefined;
  template: EmailTemplateRow | null;
  vars: Record<string, string>;
}): { subject: string; bodyHtml: string; bodyForLog: string } {
  const subj =
    params.subjectFromClient?.trim() ||
    (params.template?.subject.trim()
      ? substituteEmailTemplatePlaceholders(params.template.subject, params.vars)
      : "") ||
    defaultInvoiceEmailSubject(params.invoiceNumber);

  const msg = params.messageFromClient?.trim();
  let bodyHtml: string;
  let bodyForLog: string;

  if (msg) {
    if (msg.includes("<") && msg.includes(">")) {
      bodyHtml = msg;
      bodyForLog = roughHtmlToPlain(msg);
    } else {
      bodyHtml = `<p>${msg.replace(/\n/g, "<br>")}</p>`;
      bodyForLog = msg;
    }
  } else if (params.template?.body.trim()) {
    const raw = substituteEmailTemplatePlaceholders(params.template.body, params.vars);
    bodyHtml = ensureInvoiceEmailBodyHtml(raw);
    bodyForLog = roughHtmlToPlain(bodyHtml);
  } else {
    const plain = defaultInvoiceEmailBodyPlain(params.invoiceNumber);
    bodyHtml = ensureInvoiceEmailBodyHtml(plain);
    bodyForLog = plain;
  }

  return { subject: subj, bodyHtml, bodyForLog };
}

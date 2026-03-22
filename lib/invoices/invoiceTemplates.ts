import type { InvoiceCompanyInfo } from "./generateInvoiceHTML";
import { numberToWords, getInvoiceLabels, translateServiceDescriptionForInvoice } from "./generateInvoiceHTML";

export type InvoiceTemplateId =
  | "classic"
  | "modern-clean"
  | "ultra-modern"
  | "corporate"
  | "elegant"
  | "compact-pro"
  | "bold-header"
  | "two-column"
  | "sidebar-accent"
  | "table-focus";

export interface InvoiceTemplateConfig {
  id: InvoiceTemplateId;
  name: string;
  description: string;
  previewLayout: string;
}

export const INVOICE_TEMPLATES: InvoiceTemplateConfig[] = [
  { id: "classic", name: "Classic Business", description: "Traditional layout with bordered info boxes", previewLayout: "header-boxes-table" },
  { id: "modern-clean", name: "Modern Clean", description: "Clean design with accent border lines", previewLayout: "accent-bar-header" },
  { id: "ultra-modern", name: "Ultra Modern", description: "Minimalist with thin borders only", previewLayout: "minimal-grid" },
  { id: "corporate", name: "Corporate", description: "Full-width header and footer bands", previewLayout: "band-header-footer" },
  { id: "elegant", name: "Elegant", description: "Centered layout with rounded boxes", previewLayout: "centered-elegant" },
  { id: "compact-pro", name: "Compact Pro", description: "Dense layout for many service rows", previewLayout: "compact-dense" },
  { id: "bold-header", name: "Bold Header", description: "Large tinted header block", previewLayout: "bold-tinted-header" },
  { id: "two-column", name: "Two Column", description: "Sidebar with main content area", previewLayout: "two-col-sidebar" },
  { id: "sidebar-accent", name: "Sidebar Accent", description: "Left accent strip with clean content", previewLayout: "left-strip" },
  { id: "table-focus", name: "Table Focus", description: "Items table dominates the page", previewLayout: "table-dominant" },
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

function formatCurrency(amount: number, isCredit = false): string {
  const abs = Math.abs(amount);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isCredit ? `−€${str}` : `€${str}`;
}

function formatCurrencyWithCode(amount: number, code = "EUR", isCredit = false): string {
  const sym = code === "EUR" ? "€" : code;
  const abs = Math.abs(amount);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isCredit ? `−${str} ${sym}` : `${str} ${sym}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function isIsoDate(s: string | null): boolean {
  return !!(s && /^\d{4}-\d{2}-\d{2}$/.test(String(s).trim()));
}

function formatDatesCell(from: string | null, to: string | null): string {
  if (!from) return "-";
  if (isIsoDate(from)) {
    const fromFmt = formatDate(from);
    const toFmt = to && to !== from && isIsoDate(to) ? " - " + formatDate(to) : "";
    return fromFmt + toFmt;
  }
  return from;
}

interface BankAccount {
  account_name?: string;
  bank_name?: string;
  iban?: string;
  swift?: string;
  currency?: string;
}

function buildBankAccounts(invoice: any, company: InvoiceCompanyInfo | null): BankAccount[] {
  const bankName = company?.bankName ?? invoice.bank_name;
  const bankAccount = company?.bankAccount ?? invoice.bank_account;
  const bankSwift = company?.bankSwift ?? invoice.bank_swift;
  return company?.bankAccounts && company.bankAccounts.length > 0
    ? company.bankAccounts
    : (bankName || bankAccount || bankSwift)
      ? [{ bank_name: bankName, iban: bankAccount, swift: bankSwift }]
      : [];
}

function bankRowsHTML(bankAccounts: BankAccount[]): string {
  return bankAccounts.map((acc) => {
    const curr = (acc.currency === "MULTI" || acc.currency === "Multi-currency") ? "Multi" : (acc.currency === "EUR" || !acc.currency ? "€" : (acc.currency || ""));
    return `<tr><td>${acc.bank_name || ""}</td><td style="word-break:break-all">${acc.iban || ""}</td><td>${acc.swift || ""}</td><td>${curr}</td></tr>`;
  }).join("");
}

function buildBeneficiaryInfo(invoice: any, company: InvoiceCompanyInfo | null, t: Record<string, string>) {
  const name = company ? (company.name || "Company Name") : (invoice.client_name || "Company Name");
  const reg = company ? (company.regNr ?? null) : (invoice.payer_reg_nr ?? null);
  const vat = company ? (company.vatNr ?? null) : (invoice.payer_vat_nr ?? null);
  const address = company ? (company.address ?? null) : (invoice.client_address ?? null);
  const regVatLine = (reg ? `${t.regNr}: ${reg}<br>` : "") + (vat ? `${t.pvn}: ${vat}<br>` : "");
  return { name, regVatLine, address };
}

function buildPayerInfo(invoice: any, t: Record<string, string>): string {
  const lines: string[] = [];
  if (invoice.payer_reg_nr) lines.push(`${t.regNr}: ${invoice.payer_reg_nr}`);
  if (invoice.payer_vat_nr) lines.push(`${t.pvn}: ${invoice.payer_vat_nr}`);
  if (invoice.payer_personal_code) lines.push(`${t.personalCode}: ${invoice.payer_personal_code}`);
  if (invoice.payer_address) lines.push(invoice.payer_address);
  return lines.join("<br>");
}

interface ItemRow {
  dates: string;
  serviceText: string;
  client: string;
  amount: string;
}

function buildItemsRows(invoice: any, lang: string): ItemRow[] {
  if (!invoice.invoice_items?.length) return [];
  const invoiceLang = (lang && String(lang).trim().toLowerCase()) || "en";
  const isCredit = !!invoice?.is_credit;
  return invoice.invoice_items.map((item: any) => {
    const serviceText = translateServiceDescriptionForInvoice(item.service_name?.trim() || "", invoiceLang) || "-";
    const dates = (item.service_dates_text && String(item.service_dates_text).trim())
      ? String(item.service_dates_text).trim()
      : formatDatesCell(item.service_date_from, item.service_date_to);
    return { dates, serviceText, client: (item.service_client || "-").replace(/\s*,\s*/g, "<br>"), amount: formatCurrency(item.line_total, isCredit) };
  });
}

function buildLatviaBlock(invoice: any, lang: string, t: Record<string, string>): string {
  const subtotal = invoice.subtotal ?? 0;
  const taxRate = invoice.tax_rate ?? 0;
  const taxAmount = invoice.tax_amount ?? 0;
  const total = invoice.total ?? 0;
  const nonTaxable = 0;
  const taxable0 = taxRate === 0 ? subtotal : 0;
  const taxable21 = taxRate === 21 ? subtotal : 0;
  const vat21Amount = taxRate === 21 ? taxAmount : 0;
  const curr = "EUR";
  const isCredit = !!invoice?.is_credit;
  return `
    <tr><td>${t.summa}</td><td class="num">${formatCurrencyWithCode(subtotal, curr, isCredit)}</td></tr>
    <tr><td>${t.nonTaxableAmount}</td><td class="num">${formatCurrencyWithCode(nonTaxable, curr, isCredit)}</td></tr>
    <tr><td>${t.taxable0}</td><td class="num">${formatCurrencyWithCode(taxable0, curr, isCredit)}</td></tr>
    <tr><td>${t.taxable21}</td><td class="num">${formatCurrencyWithCode(taxable21, curr, isCredit)}</td></tr>
    <tr><td>${t.vat21}</td><td class="num">${formatCurrencyWithCode(vat21Amount, curr, isCredit)}</td></tr>
    <tr class="total-row"><td>${t.summaApmaksai}</td><td class="num">${formatCurrencyWithCode(total, curr, isCredit)}</td></tr>
    <tr><td colspan="2" style="font-style:italic;border:none;padding-top:4px">${t.summaVardiem}: ${numberToWords(total, lang)}</td></tr>
    <tr><td colspan="2" style="font-size:10px;color:#666;border:none;padding-top:6px">${t.legalNote0}</td></tr>
    <tr><td colspan="2" style="font-size:10px;color:#666;border:none">${t.legalNote21}</td></tr>
  `;
}

function buildNonLatviaTotals(invoice: any, t: Record<string, string>): string {
  const isCredit = !!invoice?.is_credit;
  return `
    <tr><td>${t.subtotal}:</td><td class="num">${formatCurrency(invoice.subtotal || 0, isCredit)}</td></tr>
    <tr><td>${t.vat} (${invoice.tax_rate || 0}%):</td><td class="num">${formatCurrency(invoice.tax_amount || 0, isCredit)}</td></tr>
    <tr class="total-row"><td>${t.total}:</td><td class="num">${formatCurrency(invoice.total || 0, isCredit)}</td></tr>
  `;
}

function buildPaymentTermsContent(invoice: any, bankAccounts: BankAccount[], beneficiaryName: string, t: Record<string, string>): string {
  const lines: string[] = [];
  const isCredit = !!invoice?.is_credit;
  if (invoice.deposit_amount && invoice.deposit_date) {
    lines.push(`${t.deposit}: ${formatCurrency(invoice.deposit_amount, isCredit)} ${t.by || "by"} ${formatDate(invoice.deposit_date)}`);
  }
  if (invoice.final_payment_amount && invoice.final_payment_date) {
    lines.push(`${t.finalPayment}: ${formatCurrency(invoice.final_payment_amount, isCredit)} ${t.by || "by"} ${formatDate(invoice.final_payment_date)}`);
  }
  if (!lines.length && invoice.due_date) {
    lines.push(`${t.dueDate}: ${formatDate(invoice.due_date)}`);
  }
  return lines.join("<br>");
}

function buildBankingTable(bankAccounts: BankAccount[], beneficiaryName: string, t: Record<string, string>): string {
  if (!bankAccounts.length) return "";
  return `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px">
      <tr><th colspan="4" style="text-align:left;padding:4px 8px;background:#f5f5f5;border:1px solid #ddd">${t.bankingDetails}</th></tr>
      <tr><td colspan="4" style="padding:4px 8px;border:1px solid #ddd"><strong>${t.beneficiaryName}:</strong> ${beneficiaryName}</td></tr>
      <tr>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">${t.bank}</th>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">${t.account}</th>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">SWIFT</th>
        <th style="padding:4px 8px;border:1px solid #ddd;background:#f5f5f5"></th>
      </tr>
      ${bankRowsHTML(bankAccounts).replace(/padding:4px/g, "padding:4px").replace(/<td>/g, '<td style="padding:4px 8px;border:1px solid #ddd">')}
    </table>
  `;
}

// ─── Template 1: Classic ───────────────────────────────────────────────────────

function templateClassic(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);

  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.12)` : "#e8f0fe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 5mm; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:12px; box-sizing:border-box; }
  body { margin:5mm; }
  * { box-sizing:border-box; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
  .inv-title { font-size:30px; font-weight:bold; color:#111; letter-spacing:0.02em; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:12px; }
  .sec { border:1px solid #ddd; background:#f9fafb; padding:10px 14px; border-radius:4px; font-size:11.5px; }
  .sec-title { font-size:10.5px; text-transform:uppercase; color:#666; margin-bottom:6px; font-weight:600; }
  .sec-name { font-size:12.5px; font-weight:bold; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0 12px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:7px 10px; background:${accentTint}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:11px; }
  .items-table td { padding:7px 10px; border:1px solid #e5e7eb; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .items-table tbody tr:nth-child(even) td { background:#fafafa; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 12px 0; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:280px; }
  .totals-table td { padding:5px 10px; border:1px solid #e5e7eb; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; }
  .payment-terms { background:#fff3cd; border:1px solid #f3e3a3; padding:10px 14px; border-radius:4px; margin:10px 0; font-size:11.5px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  .bank-tbl th,.bank-tbl td { padding:5px 8px; text-align:left; border:1px solid #ddd; }
  .bank-tbl th { background:#f5f5f5; font-weight:600; }
  .disclaimer { margin-top:14px; font-size:10.5px; color:#666; font-style:italic; }
  .thank-you { margin-top:20px; text-align:center; color:#666; font-size:12px; }
</style>
</head>
<body>
<div class="hdr">
  <div style="flex-shrink:0">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:80px;max-width:200px;object-fit:contain">` : `<div style="height:80px;width:80px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:11px;border:1px dashed #ddd;border-radius:4px">Logo</div>`}
  </div>
  <div style="text-align:right">
    <div class="inv-title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
    ${invoice.is_credit ? `<div style="color:green;font-size:11px">${t.refundCredit}</div>` : ""}
    <div style="margin-top:6px;font-size:13px;font-weight:bold">${invoice.invoice_number || ""}</div>
    <div style="margin-top:3px;font-size:11.5px"><strong>${t.date}:</strong> ${formatDate(invoice.invoice_date)}</div>
  </div>
</div>

<div class="sections">
  <div class="sec">
    <div class="sec-title">${t.beneficiary}</div>
    <div class="sec-name">${beneficiaryName}</div>
    ${regVatLine ? `<div style="font-size:11px;color:#555;margin-top:4px">${regVatLine}</div>` : ""}
    ${beneficiaryAddress ? `<div style="font-size:11px;color:#555">${beneficiaryAddress}</div>` : ""}
  </div>
  <div class="sec">
    <div class="sec-title">${t.payer}</div>
    <div class="sec-name">${invoice.payer_name || "-"}</div>
    ${payerExtra ? `<div style="font-size:11px;color:#555;margin-top:4px">${payerExtra}</div>` : ""}
  </div>
</div>

<table class="items-table">
  <thead>
    <tr>
      <th>${t.dates}</th>
      <th>${t.service}</th>
      <th>${t.client}</th>
      <th style="text-align:right">${t.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
  </tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
  </table>
</div>

${hasPaymentTerms ? `
<div class="payment-terms">
  <strong>${t.paymentTerms}</strong><br>
  ${paymentTermsText}
  ${bankAccounts.length > 0 ? `
  <table class="bank-tbl" style="margin-top:8px">
    <tr><th colspan="4">${t.bankingDetails}</th></tr>
    <tr><td colspan="4"><strong>${t.beneficiaryName}:</strong> ${beneficiaryName}</td></tr>
    <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
    ${bankRowsHTML(bankAccounts)}
  </table>
  ` : ""}
</div>
` : ""}

<p class="disclaimer">${t.electronicDisclaimer}</p>
<div class="thank-you">${t.thankYou}</div>
</body>
</html>`;
}

// ─── Template 2: Modern Clean ─────────────────────────────────────────────────

function templateModernClean(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.1)` : "#e8f0fe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 5mm; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:12px; }
  body { margin:5mm; }
  * { box-sizing:border-box; }
  .top-bar { height:3px; background:${accentColor}; margin-bottom:20px; margin:-5mm -5mm 20px -5mm; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .inv-title { font-size:32px; font-weight:bold; color:${accentColor}; letter-spacing:0.02em; }
  .info-sec { border-left:3px solid ${accentColor}; padding-left:12px; margin-bottom:14px; }
  .info-sec-title { font-size:10.5px; text-transform:uppercase; color:#888; margin-bottom:4px; font-weight:600; }
  .info-sec-name { font-size:13px; font-weight:bold; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:14px; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0 12px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:7px 10px; background:${accentTint}; border-bottom:2px solid ${accentColor}; font-weight:600; text-transform:uppercase; color:#444; font-size:11px; }
  .items-table td { padding:7px 10px; border-bottom:1px solid #f0f0f0; }
  .items-table tbody tr:nth-child(even) td { background:#f9fafb; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 12px 0; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:280px; border:1px solid #e5e7eb; border-top:3px solid ${accentColor}; }
  .totals-table td { padding:5px 10px; border-bottom:1px solid #f0f0f0; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; background:${accentTint}; }
  .payment-terms { border-left:3px solid ${accentColor}; border:1px solid #e5e7eb; border-left-width:3px; padding:10px 14px; border-radius:2px; margin:10px 0; font-size:11.5px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  .bank-tbl th,.bank-tbl td { padding:5px 8px; text-align:left; border:1px solid #eee; }
  .bank-tbl th { background:#f9f9f9; font-weight:600; }
  .disclaimer { margin-top:14px; font-size:10.5px; color:#888; font-style:italic; }
  .thank-you { margin-top:18px; text-align:center; color:#888; font-size:12px; }
</style>
</head>
<body>
<div class="top-bar"></div>

<div class="hdr">
  <div>
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:70px;max-width:180px;object-fit:contain">` : `<div style="height:70px;width:70px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:10px;border:1px dashed #ddd">Logo</div>`}
  </div>
  <div style="text-align:right">
    <div class="inv-title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
    ${invoice.is_credit ? `<div style="color:green;font-size:11px">${t.refundCredit}</div>` : ""}
    <div style="font-size:13px;font-weight:600;margin-top:4px">${invoice.invoice_number || ""}</div>
    <div style="font-size:11.5px;color:#666;margin-top:2px">${t.date}: ${formatDate(invoice.invoice_date)}</div>
  </div>
</div>

<div class="sections">
  <div class="info-sec">
    <div class="info-sec-title">${t.beneficiary}</div>
    <div class="info-sec-name">${beneficiaryName}</div>
    ${regVatLine ? `<div style="font-size:11px;color:#666;margin-top:3px">${regVatLine}</div>` : ""}
    ${beneficiaryAddress ? `<div style="font-size:11px;color:#666">${beneficiaryAddress}</div>` : ""}
  </div>
  <div class="info-sec">
    <div class="info-sec-title">${t.payer}</div>
    <div class="info-sec-name">${invoice.payer_name || "-"}</div>
    ${payerExtra ? `<div style="font-size:11px;color:#666;margin-top:3px">${payerExtra}</div>` : ""}
  </div>
</div>

<table class="items-table">
  <thead>
    <tr>
      <th>${t.dates}</th>
      <th>${t.service}</th>
      <th>${t.client}</th>
      <th style="text-align:right">${t.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
  </tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
  </table>
</div>

${hasPaymentTerms ? `
<div class="payment-terms">
  <strong>${t.paymentTerms}</strong><br>
  ${paymentTermsText}
  ${bankAccounts.length > 0 ? `
  <table class="bank-tbl" style="margin-top:8px">
    <tr><th colspan="4">${t.bankingDetails}</th></tr>
    <tr><td colspan="4"><strong>${t.beneficiaryName}:</strong> ${beneficiaryName}</td></tr>
    <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
    ${bankRowsHTML(bankAccounts)}
  </table>
  ` : ""}
</div>
` : ""}

<p class="disclaimer">${t.electronicDisclaimer}</p>
<div class="thank-you">${t.thankYou}</div>
</body>
</html>`;
}

// ─── Template 3: Ultra Modern ─────────────────────────────────────────────────

function templateUltraModern(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 5mm; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#222; font-size:12px; }
  body { margin:5mm; }
  * { box-sizing:border-box; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; border-bottom:1px solid #e0e0e0; padding-bottom:12px; }
  .company-center { text-align:center; padding:10px 0; border-bottom:1px solid #e0e0e0; margin-bottom:14px; }
  .company-big { font-size:18px; font-weight:bold; color:${accentColor}; }
  .inv-meta { font-size:11px; color:#888; margin-top:3px; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:14px; }
  .sec-lbl { font-size:10px; text-transform:uppercase; color:#aaa; font-weight:600; margin-bottom:4px; }
  .sec-val { font-size:12px; color:#222; }
  .sec-sub { font-size:10.5px; color:#666; margin-top:2px; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0 12px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:6px 8px; color:${accentColor}; font-weight:600; text-transform:uppercase; font-size:10.5px; border-bottom:2px solid #e0e0e0; background:none; }
  .items-table td { padding:6px 8px; border-bottom:1px solid #f0f0f0; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 12px 0; }
  .totals-table { font-size:11.5px; width:260px; }
  .totals-table td { padding:4px 8px; border:none; }
  .totals-table td:first-child { color:#666; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; color:${accentColor}; border-top:1px solid #e0e0e0; padding-top:6px; }
  .payment-box { border:1px solid #e0e0e0; padding:10px 12px; margin:10px 0; font-size:11.5px; border-radius:2px; }
  .payment-lbl { font-size:10px; text-transform:uppercase; color:#aaa; font-weight:600; margin-bottom:4px; }
  .bank-minimal { font-size:11px; color:#555; margin-top:8px; }
  .disclaimer { margin-top:14px; font-size:10px; color:#aaa; font-style:italic; }
  .thank-you { margin-top:16px; text-align:center; color:#aaa; font-size:11px; }
</style>
</head>
<body>
<div class="hdr">
  <div>
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:60px;max-width:150px;object-fit:contain">` : `<div style="height:60px;width:60px;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:10px">Logo</div>`}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#888">${t.invoiceNo} <span style="font-size:13px;font-weight:600;color:#222">${invoice.invoice_number || ""}</span></div>
    <div style="font-size:11px;color:#888;margin-top:3px">${t.date}: <span style="color:#222">${formatDate(invoice.invoice_date)}</span></div>
  </div>
</div>

<div class="company-center">
  <div class="company-big">${beneficiaryName}</div>
  <div class="inv-meta">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}${invoice.is_credit ? ` — ${t.refundCredit}` : ""}</div>
</div>

<div class="sections">
  <div>
    <div class="sec-lbl">${t.beneficiary}</div>
    <div class="sec-val">${beneficiaryName}</div>
    ${regVatLine ? `<div class="sec-sub">${regVatLine}</div>` : ""}
    ${beneficiaryAddress ? `<div class="sec-sub">${beneficiaryAddress}</div>` : ""}
  </div>
  <div>
    <div class="sec-lbl">${t.payer}</div>
    <div class="sec-val">${invoice.payer_name || "-"}</div>
    ${payerExtra ? `<div class="sec-sub">${payerExtra}</div>` : ""}
  </div>
</div>

<table class="items-table">
  <thead>
    <tr>
      <th>${t.dates}</th>
      <th>${t.service}</th>
      <th>${t.client}</th>
      <th style="text-align:right">${t.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
  </tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
  </table>
</div>

${hasPaymentTerms ? `
<div class="payment-box">
  <div class="payment-lbl">${t.paymentTerms}</div>
  <div>${paymentTermsText}</div>
  ${bankAccounts.length > 0 ? `
  <div class="bank-minimal">
    <div style="font-weight:600;margin-bottom:4px">${t.bankingDetails}</div>
    <div>${t.beneficiaryName}: ${beneficiaryName}</div>
    ${bankAccounts.map((acc) => `<div>${acc.bank_name || ""} · IBAN: ${acc.iban || ""} · SWIFT: ${acc.swift || ""}</div>`).join("")}
  </div>
  ` : ""}
</div>
` : ""}

<p class="disclaimer">${t.electronicDisclaimer}</p>
<div class="thank-you">${t.thankYou}</div>
</body>
</html>`;
}

// ─── Template 4: Corporate ────────────────────────────────────────────────────

function templateCorporate(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.08)` : "#e8f0fe";
  const accentTint2 = accentRgb ? `rgba(${accentRgb},0.12)` : "#dbeafe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 0; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:12px; }
  * { box-sizing:border-box; }
  .corp-header { background:${accentTint}; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; }
  .corp-company { font-size:16px; font-weight:bold; color:#111; text-align:center; flex:1; }
  .corp-inv-nr { font-size:13px; font-weight:600; color:#333; }
  .sub-strip { background:#f3f4f6; padding:8px 20px; display:flex; gap:30px; font-size:11.5px; border-bottom:1px solid #e5e7eb; }
  .body-content { padding:14px 20px; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:12px; }
  .sec { font-size:11.5px; }
  .sec-title { font-size:10.5px; text-transform:uppercase; color:#888; margin-bottom:4px; font-weight:600; }
  .sec-name { font-size:12.5px; font-weight:bold; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0 12px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:7px 10px; background:${accentTint2}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:11px; }
  .items-table td { padding:7px 10px; border:1px solid #e5e7eb; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 14px 0; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:280px; }
  .totals-table td { padding:5px 10px; border:1px solid #e5e7eb; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; }
  .corp-footer { background:${accentTint}; padding:12px 20px; margin-top:14px; font-size:11px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  .bank-tbl th,.bank-tbl td { padding:5px 8px; text-align:left; border:1px solid #ddd; }
  .bank-tbl th { background:#f5f5f5; font-weight:600; }
  .disclaimer { margin-top:10px; font-size:10.5px; color:#666; font-style:italic; padding:0 20px; }
</style>
</head>
<body>
<div class="corp-header">
  <div style="flex-shrink:0;width:140px">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:60px;max-width:130px;object-fit:contain">` : `<div style="height:60px;width:60px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:10px;border:1px dashed #ccc">Logo</div>`}
  </div>
  <div class="corp-company">${beneficiaryName}</div>
  <div style="text-align:right;width:140px">
    <div class="corp-inv-nr">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
    <div style="font-size:12px;font-weight:bold;margin-top:2px">${invoice.invoice_number || ""}</div>
  </div>
</div>

<div class="sub-strip">
  <div><strong>${t.date}:</strong> ${formatDate(invoice.invoice_date)}</div>
  <div><strong>${t.payer}:</strong> ${invoice.payer_name || "-"}</div>
  ${invoice.payer_address ? `<div style="color:#666">${invoice.payer_address}</div>` : ""}
</div>

<div class="body-content">
  <div class="sections">
    <div class="sec">
      <div class="sec-title">${t.beneficiary}</div>
      <div class="sec-name">${beneficiaryName}</div>
      ${regVatLine ? `<div style="font-size:11px;color:#555;margin-top:3px">${regVatLine}</div>` : ""}
      ${beneficiaryAddress ? `<div style="font-size:11px;color:#555">${beneficiaryAddress}</div>` : ""}
    </div>
    <div class="sec">
      <div class="sec-title">${t.payer}</div>
      <div class="sec-name">${invoice.payer_name || "-"}</div>
      ${payerExtra ? `<div style="font-size:11px;color:#555;margin-top:3px">${payerExtra}</div>` : ""}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>${t.dates}</th>
        <th>${t.service}</th>
        <th>${t.client}</th>
        <th style="text-align:right">${t.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
    </table>
  </div>
</div>

<div class="corp-footer">
  ${hasPaymentTerms ? `<div style="margin-bottom:6px"><strong>${t.paymentTerms}:</strong> ${paymentTermsText}</div>` : ""}
  ${bankAccounts.length > 0 ? `
  <table class="bank-tbl">
    <tr><th colspan="4">${t.bankingDetails} — ${t.beneficiaryName}: ${beneficiaryName}</th></tr>
    <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
    ${bankRowsHTML(bankAccounts)}
  </table>
  ` : ""}
</div>

<p class="disclaimer">${t.electronicDisclaimer}</p>
</body>
</html>`;
}

// ─── Template 5: Elegant ──────────────────────────────────────────────────────

function templateElegant(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 5mm; }
  html,body { font-family: Georgia,'Times New Roman',serif; margin:0; padding:0; color:#333; font-size:12px; }
  body { margin:5mm; }
  * { box-sizing:border-box; }
  .elegant-header { text-align:center; margin-bottom:18px; padding-bottom:12px; border-bottom:2px solid #e5e7eb; }
  .elegant-logo { display:block; margin:0 auto 8px auto; height:60px; max-width:160px; object-fit:contain; }
  .elegant-company { font-size:17px; font-weight:bold; color:${accentColor}; margin-bottom:4px; }
  .decorative-line { width:60px; height:2px; background:${accentColor}; margin:6px auto; opacity:0.4; }
  .inv-title { font-size:26px; font-style:italic; color:#333; margin:10px 0 4px 0; }
  .inv-meta { font-size:12px; color:#666; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:14px; }
  .sec { border:1px solid #e5e7eb; border-radius:4px; padding:10px 14px; font-size:11.5px; }
  .sec-title { font-size:10.5px; text-transform:uppercase; color:#888; margin-bottom:5px; font-weight:600; letter-spacing:0.05em; }
  .sec-name { font-size:13px; font-weight:bold; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0 12px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:7px 10px; color:${accentColor}; font-weight:600; text-transform:uppercase; font-size:10.5px; border-bottom:2px solid #e5e7eb; background:none; font-family:Arial,sans-serif; }
  .items-table td { padding:7px 10px; border-bottom:1px solid #f0f0f0; font-family:Arial,sans-serif; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .totals-wrap { display:flex; justify-content:center; margin:0 0 14px 0; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:300px; border:1px solid #e5e7eb; border-radius:4px; }
  .totals-table td { padding:6px 12px; border-bottom:1px solid #f0f0f0; font-family:Arial,sans-serif; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; }
  .payment-elegant { text-align:center; border:1px solid #e5e7eb; border-radius:4px; padding:10px 14px; margin:10px 0; font-size:11.5px; }
  .payment-elegant strong { display:block; margin-bottom:4px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:8px; font-family:Arial,sans-serif; }
  .bank-tbl th,.bank-tbl td { padding:5px 8px; text-align:left; border:1px solid #eee; }
  .bank-tbl th { background:#f5f5f5; font-weight:600; }
  .disclaimer { margin-top:14px; font-size:10.5px; color:#888; font-style:italic; text-align:center; }
  .thank-you { margin-top:16px; text-align:center; color:#888; font-size:12px; font-style:italic; }
</style>
</head>
<body>
<div class="elegant-header">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="elegant-logo">` : `<div style="height:60px;width:60px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:10px;border:1px dashed #ddd;margin:0 auto 8px auto">Logo</div>`}
  <div class="elegant-company">${beneficiaryName}</div>
  <div class="decorative-line"></div>
  <div class="inv-title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
  <div class="inv-meta">${invoice.invoice_number || ""} &nbsp;·&nbsp; ${t.date}: ${formatDate(invoice.invoice_date)}</div>
  ${invoice.is_credit ? `<div style="color:green;font-size:11px;margin-top:3px">${t.refundCredit}</div>` : ""}
</div>

<div class="sections">
  <div class="sec">
    <div class="sec-title">${t.beneficiary}</div>
    <div class="sec-name">${beneficiaryName}</div>
    ${regVatLine ? `<div style="font-size:11px;color:#555;margin-top:3px;font-family:Arial,sans-serif">${regVatLine}</div>` : ""}
    ${beneficiaryAddress ? `<div style="font-size:11px;color:#555;font-family:Arial,sans-serif">${beneficiaryAddress}</div>` : ""}
  </div>
  <div class="sec">
    <div class="sec-title">${t.payer}</div>
    <div class="sec-name">${invoice.payer_name || "-"}</div>
    ${payerExtra ? `<div style="font-size:11px;color:#555;margin-top:3px;font-family:Arial,sans-serif">${payerExtra}</div>` : ""}
  </div>
</div>

<table class="items-table">
  <thead>
    <tr>
      <th>${t.dates}</th>
      <th>${t.service}</th>
      <th>${t.client}</th>
      <th style="text-align:right">${t.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
  </tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
  </table>
</div>

${hasPaymentTerms ? `
<div class="payment-elegant">
  <strong>${t.paymentTerms}</strong>
  <div>${paymentTermsText}</div>
  ${bankAccounts.length > 0 ? `
  <table class="bank-tbl" style="margin-top:8px">
    <tr><th colspan="4">${t.bankingDetails} — ${t.beneficiaryName}: ${beneficiaryName}</th></tr>
    <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
    ${bankRowsHTML(bankAccounts)}
  </table>
  ` : ""}
</div>
` : ""}

<p class="disclaimer">${t.electronicDisclaimer}</p>
<div class="thank-you">${t.thankYou}</div>
</body>
</html>`;
}

// ─── Template 6: Compact Pro ──────────────────────────────────────────────────

function templateCompactPro(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.1)` : "#e8f0fe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 4mm; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:10px; }
  body { margin:4mm; }
  * { box-sizing:border-box; }
  .hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #e0e0e0; padding-bottom:6px; }
  .inv-meta { text-align:right; font-size:10px; }
  .inv-meta .title { font-size:16px; font-weight:bold; color:${accentColor}; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:6px; font-size:9.5px; }
  .sec-lbl { text-transform:uppercase; color:#888; font-size:9px; font-weight:600; }
  .sec-name { font-weight:bold; font-size:10px; }
  .items-table { width:100%; border-collapse:collapse; margin:4px 0 6px 0; font-size:10px; }
  .items-table th { text-align:left; padding:4px 6px; background:${accentTint}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:9px; }
  .items-table td { padding:4px 6px; border:1px solid #eee; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:80px; }
  .items-table tbody tr:nth-child(even) td { background:#fafafa; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 6px 0; }
  .totals-table { border-collapse:collapse; font-size:10px; width:240px; }
  .totals-table td { padding:3px 8px; border:1px solid #eee; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; }
  .payment-terms { background:#fff3cd; padding:5px 8px; border-radius:2px; margin:4px 0; font-size:9.5px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:9.5px; margin-top:4px; }
  .bank-tbl th,.bank-tbl td { padding:3px 6px; text-align:left; border:1px solid #ddd; }
  .bank-tbl th { background:#f5f5f5; font-weight:600; }
  .disclaimer { margin-top:6px; font-size:9px; color:#999; font-style:italic; }
</style>
</head>
<body>
<div class="hdr">
  <div style="display:flex;align-items:center;gap:8px">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:40px;max-width:100px;object-fit:contain">` : `<div style="height:40px;width:40px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:8px;border:1px dashed #ddd">Logo</div>`}
    <div style="font-size:11px;font-weight:bold">${beneficiaryName}</div>
  </div>
  <div class="inv-meta">
    <div class="title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
    <div>${invoice.invoice_number || ""} · ${formatDate(invoice.invoice_date)}</div>
  </div>
</div>

<div class="sections">
  <div>
    <div class="sec-lbl">${t.beneficiary}</div>
    <div class="sec-name">${beneficiaryName}</div>
    ${regVatLine ? `<div style="color:#555">${regVatLine}</div>` : ""}
    ${beneficiaryAddress ? `<div style="color:#555">${beneficiaryAddress}</div>` : ""}
  </div>
  <div>
    <div class="sec-lbl">${t.payer}</div>
    <div class="sec-name">${invoice.payer_name || "-"}</div>
    ${payerExtra ? `<div style="color:#555">${payerExtra}</div>` : ""}
  </div>
</div>

<table class="items-table">
  <thead>
    <tr>
      <th>${t.dates}</th>
      <th>${t.service}</th>
      <th>${t.client}</th>
      <th style="text-align:right">${t.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
  </tbody>
</table>

<div class="totals-wrap">
  <table class="totals-table">
    ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
  </table>
</div>

${hasPaymentTerms ? `
<div class="payment-terms">
  <strong>${t.paymentTerms}:</strong> ${paymentTermsText}
  ${bankAccounts.length > 0 ? `
  <table class="bank-tbl" style="margin-top:4px">
    <tr><th colspan="4">${t.bankingDetails} — ${t.beneficiaryName}: ${beneficiaryName}</th></tr>
    <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
    ${bankRowsHTML(bankAccounts)}
  </table>
  ` : ""}
</div>
` : ""}

<p class="disclaimer">${t.electronicDisclaimer}</p>
</body>
</html>`;
}

// ─── Template 7: Bold Header ──────────────────────────────────────────────────

function templateBoldHeader(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.1)` : "#e8f0fe";
  const accentTint2 = accentRgb ? `rgba(${accentRgb},0.14)` : "#dbeafe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 0; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:12px; }
  * { box-sizing:border-box; }
  .bold-header { background:${accentTint}; padding:16px 20px 16px 20px; display:flex; justify-content:space-between; align-items:center; min-height:100px; }
  .bold-title { font-size:40px; font-weight:bold; color:${accentColor}; line-height:1; }
  .bold-inv-nr { font-size:14px; color:#555; margin-top:4px; font-weight:600; }
  .bold-date { font-size:12px; color:${accentColor}; font-weight:600; margin-top:3px; }
  .body-content { padding:14px 20px; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:14px; }
  .sec-lbl { font-size:10.5px; text-transform:uppercase; color:#888; font-weight:600; margin-bottom:4px; }
  .sec-name { font-size:13px; font-weight:bold; }
  .sec-sub { font-size:11px; color:#555; margin-top:2px; }
  .items-table { width:100%; border-collapse:collapse; margin:8px 0 12px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:7px 10px; background:${accentTint2}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:11px; }
  .items-table td { padding:7px 10px; border:1px solid #e5e7eb; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 14px 0; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:280px; border:1px solid #ddd; }
  .totals-table td { padding:5px 10px; border:1px solid #e5e7eb; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; background:${accentTint}; }
  .payment-box { background:#fff3cd; border:1px solid #f3e3a3; padding:10px 14px; border-radius:3px; margin:10px 0; font-size:11.5px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  .bank-tbl th,.bank-tbl td { padding:5px 8px; text-align:left; border:1px solid #ddd; }
  .bank-tbl th { background:#f5f5f5; font-weight:600; }
  .disclaimer { margin-top:10px; font-size:10.5px; color:#666; font-style:italic; padding:0 20px 14px 20px; }
</style>
</head>
<body>
<div class="bold-header">
  <div>
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:70px;max-width:180px;object-fit:contain">` : `<div style="height:70px;width:70px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:10px;border:1px dashed #ddd;border-radius:3px">Logo</div>`}
  </div>
  <div style="text-align:right">
    <div class="bold-title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
    <div class="bold-inv-nr">${invoice.invoice_number || ""}</div>
    <div class="bold-date">${formatDate(invoice.invoice_date)}</div>
    ${invoice.is_credit ? `<div style="color:green;font-size:11px">${t.refundCredit}</div>` : ""}
  </div>
</div>

<div class="body-content">
  <div class="sections">
    <div>
      <div class="sec-lbl">${t.beneficiary}</div>
      <div class="sec-name">${beneficiaryName}</div>
      ${regVatLine ? `<div class="sec-sub">${regVatLine}</div>` : ""}
      ${beneficiaryAddress ? `<div class="sec-sub">${beneficiaryAddress}</div>` : ""}
    </div>
    <div>
      <div class="sec-lbl">${t.payer}</div>
      <div class="sec-name">${invoice.payer_name || "-"}</div>
      ${payerExtra ? `<div class="sec-sub">${payerExtra}</div>` : ""}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>${t.dates}</th>
        <th>${t.service}</th>
        <th>${t.client}</th>
        <th style="text-align:right">${t.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
    </table>
  </div>

  ${hasPaymentTerms ? `
  <div class="payment-box">
    <strong>${t.paymentTerms}</strong><br>
    ${paymentTermsText}
    ${bankAccounts.length > 0 ? `
    <table class="bank-tbl" style="margin-top:8px">
      <tr><th colspan="4">${t.bankingDetails} — ${t.beneficiaryName}: ${beneficiaryName}</th></tr>
      <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
      ${bankRowsHTML(bankAccounts)}
    </table>
    ` : ""}
  </div>
  ` : ""}
</div>

<p class="disclaimer">${t.electronicDisclaimer}</p>
</body>
</html>`;
}

// ─── Template 8: Two Column ───────────────────────────────────────────────────

function templateTwoColumn(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.1)` : "#e8f0fe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 0; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:11.5px; }
  * { box-sizing:border-box; }
  .layout { display:flex; min-height:100vh; }
  .sidebar { width:35%; background:#f8f9fa; border-right:1px solid #e5e7eb; padding:16px 14px; }
  .main { flex:1; padding:16px 16px; }
  .sidebar-section { border-left:3px solid ${accentColor}; padding-left:10px; margin-bottom:14px; }
  .sidebar-section-title { font-size:10px; text-transform:uppercase; color:#888; font-weight:600; margin-bottom:4px; }
  .sidebar-name { font-size:12px; font-weight:bold; margin-bottom:2px; }
  .sidebar-sub { font-size:10px; color:#666; }
  .sidebar-bank-tbl { width:100%; border-collapse:collapse; font-size:10px; margin-top:4px; }
  .sidebar-bank-tbl td { padding:3px 4px; border-bottom:1px solid #e5e7eb; word-break:break-all; }
  .sidebar-bank-tbl td:first-child { color:#888; font-size:9px; white-space:nowrap; width:40px; }
  .main-title-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:2px solid #e5e7eb; padding-bottom:10px; }
  .main-inv-title { font-size:28px; font-weight:bold; color:${accentColor}; }
  .main-meta { text-align:right; font-size:11px; color:#666; }
  .items-table { width:100%; border-collapse:collapse; margin:6px 0 10px 0; font-size:11px; }
  .items-table th { text-align:left; padding:6px 8px; background:${accentTint}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:10px; }
  .items-table td { padding:6px 8px; border:1px solid #eee; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:90px; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 10px 0; }
  .totals-table { border-collapse:collapse; font-size:11px; width:260px; }
  .totals-table td { padding:4px 8px; border:1px solid #eee; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; }
  .disclaimer { font-size:9.5px; color:#999; font-style:italic; margin-top:8px; }
</style>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:60px;max-width:140px;object-fit:contain;margin-bottom:14px;display:block">` : `<div style="height:60px;width:60px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:9px;border:1px dashed #ddd;margin-bottom:14px">Logo</div>`}

    <div class="sidebar-section">
      <div class="sidebar-section-title">${t.beneficiary}</div>
      <div class="sidebar-name">${beneficiaryName}</div>
      ${regVatLine ? `<div class="sidebar-sub">${regVatLine}</div>` : ""}
      ${beneficiaryAddress ? `<div class="sidebar-sub">${beneficiaryAddress}</div>` : ""}
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">${t.payer}</div>
      <div class="sidebar-name">${invoice.payer_name || "-"}</div>
      ${payerExtra ? `<div class="sidebar-sub">${payerExtra}</div>` : ""}
    </div>

    ${hasPaymentTerms ? `
    <div class="sidebar-section">
      <div class="sidebar-section-title">${t.paymentTerms}</div>
      <div class="sidebar-sub" style="color:#333">${paymentTermsText}</div>
    </div>
    ` : ""}

    ${bankAccounts.length > 0 ? `
    <div class="sidebar-section">
      <div class="sidebar-section-title">${t.bankingDetails}</div>
      <div class="sidebar-sub" style="margin-bottom:4px">${beneficiaryName}</div>
      <table class="sidebar-bank-tbl">
        ${bankAccounts.map((acc) => {
          const curr = (acc.currency === "MULTI" || acc.currency === "Multi-currency") ? "Multi" : (acc.currency || "EUR");
          return `<tr><td>${t.bank}</td><td>${acc.bank_name || ""}</td></tr>
<tr><td>IBAN</td><td>${acc.iban || ""}</td></tr>
<tr><td>SWIFT</td><td>${acc.swift || ""}</td></tr>
${curr ? `<tr><td></td><td>${curr}</td></tr>` : ""}`;
        }).join("")}
      </table>
    </div>
    ` : ""}

    <p class="disclaimer">${t.electronicDisclaimer}</p>
  </div>

  <div class="main">
    <div class="main-title-row">
      <div class="main-inv-title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
      <div class="main-meta">
        <div style="font-size:13px;font-weight:bold">${invoice.invoice_number || ""}</div>
        <div>${t.date}: ${formatDate(invoice.invoice_date)}</div>
        ${invoice.is_credit ? `<div style="color:green;font-size:10px">${t.refundCredit}</div>` : ""}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>${t.dates}</th>
          <th>${t.service}</th>
          <th>${t.client}</th>
          <th style="text-align:right">${t.amount}</th>
        </tr>
      </thead>
      <tbody>
        ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
      </tbody>
    </table>

    <div class="totals-wrap">
      <table class="totals-table">
        ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
      </table>
    </div>

    <div style="text-align:center;color:#888;font-size:11px;margin-top:16px">${t.thankYou}</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Template 9: Sidebar Accent ───────────────────────────────────────────────

function templateSidebarAccent(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.1)` : "#e8f0fe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 0; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:12px; }
  * { box-sizing:border-box; }
  .accent-strip { position:fixed; top:0; left:0; bottom:0; width:8px; background:${accentColor}; }
  .content { margin-left:20px; padding:14px 14px 14px 0; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
  .inv-title { font-size:28px; font-weight:bold; color:#111; }
  .inv-meta { text-align:right; font-size:11.5px; }
  .sections { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:14px; }
  .sec { font-size:11.5px; }
  .sec-lbl { font-size:10px; text-transform:uppercase; color:#999; font-weight:600; margin-bottom:3px; }
  .sec-name { font-size:13px; font-weight:bold; }
  .sec-sub { font-size:11px; color:#666; margin-top:2px; }
  .items-table { width:100%; border-collapse:collapse; margin:6px 0 10px 0; font-size:11.5px; }
  .items-table th { text-align:left; padding:6px 10px; background:${accentTint}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:10.5px; }
  .items-table td { padding:6px 10px; border:1px solid #eee; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .items-table tbody tr:nth-child(even) td { background:#fafafa; }
  .totals-wrap { display:flex; justify-content:flex-end; margin:0 0 10px 0; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:280px; border:1px solid ${accentColor}; }
  .totals-table td { padding:5px 10px; border-bottom:1px solid #eee; }
  .totals-table td:first-child { background:#f9fafb; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; background:${accentTint}; }
  .payment-box { border:1px solid #e5e7eb; padding:10px 12px; border-radius:2px; margin:8px 0; font-size:11.5px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  .bank-tbl th,.bank-tbl td { padding:4px 8px; text-align:left; border:1px solid #eee; }
  .bank-tbl th { background:#f9f9f9; font-weight:600; }
  .disclaimer { margin-top:12px; font-size:10.5px; color:#888; font-style:italic; }
  .thank-you { margin-top:14px; text-align:center; color:#888; font-size:12px; }
</style>
</head>
<body>
<div class="accent-strip"></div>
<div class="content">
  <div class="hdr">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:70px;max-width:180px;object-fit:contain">` : `<div style="height:70px;width:70px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:10px;border:1px dashed #ddd">Logo</div>`}
      <div style="font-size:18px;font-weight:bold;color:${accentColor};margin-top:6px">${beneficiaryName}</div>
    </div>
    <div class="inv-meta">
      <div class="inv-title">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice}</div>
      <div style="font-size:13px;font-weight:600;margin-top:4px">${invoice.invoice_number || ""}</div>
      <div style="color:#666;margin-top:2px">${t.date}: ${formatDate(invoice.invoice_date)}</div>
      ${invoice.is_credit ? `<div style="color:green;font-size:11px">${t.refundCredit}</div>` : ""}
    </div>
  </div>

  <div class="sections">
    <div class="sec">
      <div class="sec-lbl">${t.beneficiary}</div>
      <div class="sec-name">${beneficiaryName}</div>
      ${regVatLine ? `<div class="sec-sub">${regVatLine}</div>` : ""}
      ${beneficiaryAddress ? `<div class="sec-sub">${beneficiaryAddress}</div>` : ""}
    </div>
    <div class="sec">
      <div class="sec-lbl">${t.payer}</div>
      <div class="sec-name">${invoice.payer_name || "-"}</div>
      ${payerExtra ? `<div class="sec-sub">${payerExtra}</div>` : ""}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>${t.dates}</th>
        <th>${t.service}</th>
        <th>${t.client}</th>
        <th style="text-align:right">${t.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
    </table>
  </div>

  ${hasPaymentTerms ? `
  <div class="payment-box">
    <strong>${t.paymentTerms}:</strong> ${paymentTermsText}
    ${bankAccounts.length > 0 ? `
    <table class="bank-tbl" style="margin-top:8px">
      <tr><th colspan="4">${t.bankingDetails} — ${t.beneficiaryName}: ${beneficiaryName}</th></tr>
      <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
      ${bankRowsHTML(bankAccounts)}
    </table>
    ` : ""}
  </div>
  ` : ""}

  <p class="disclaimer">${t.electronicDisclaimer}</p>
  <div class="thank-you">${t.thankYou}</div>
</div>
</body>
</html>`;
}

// ─── Template 10: Table Focus ─────────────────────────────────────────────────

function templateTableFocus(invoice: any, logoUrl: string | null, company: InvoiceCompanyInfo | null, accentColor: string): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = getInvoiceLabels(lang);
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatvia = /latvia|latvija|lettland/i.test(companyCountry);
  const bankAccounts = buildBankAccounts(invoice, company);
  const { name: beneficiaryName, regVatLine, address: beneficiaryAddress } = buildBeneficiaryInfo(invoice, company, t);
  const payerExtra = buildPayerInfo(invoice, t);
  const items = buildItemsRows(invoice, lang);
  const paymentTermsText = buildPaymentTermsContent(invoice, bankAccounts, beneficiaryName, t);
  const hasPaymentTerms = !!(invoice.deposit_amount || invoice.final_payment_amount || invoice.due_date);
  const accentRgb = hexToRgb(accentColor);
  const accentTint = accentRgb ? `rgba(${accentRgb},0.12)` : "#e8f0fe";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: ${accentColor}; }
  @page { size: A4; margin: 5mm; }
  html,body { font-family: Arial,sans-serif; margin:0; padding:0; color:#333; font-size:12px; }
  body { margin:5mm; }
  * { box-sizing:border-box; }
  .top-hdr { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; }
  .inv-nr-big { font-size:20px; font-weight:bold; color:#111; }
  .inv-date { font-size:12px; color:#666; }
  .info-line { display:flex; gap:24px; font-size:11px; color:#555; margin-bottom:10px; border-bottom:1px solid #e5e7eb; padding-bottom:8px; }
  .info-lbl { font-weight:600; color:#999; font-size:10px; text-transform:uppercase; display:block; }
  .items-table { width:100%; border-collapse:collapse; margin:0 0 10px 0; font-size:12px; }
  .items-table th { text-align:left; padding:8px 10px; background:${accentTint}; border:1px solid #ddd; font-weight:600; text-transform:uppercase; color:#444; font-size:11px; }
  .items-table td { padding:9px 10px; border:1px solid #e5e7eb; }
  .items-table th:last-child,.items-table td.amt { text-align:right; width:100px; }
  .items-table tbody tr:nth-child(even) td { background:#fafafa; }
  .bottom-wrap { display:flex; gap:16px; margin-top:6px; }
  .payment-left { flex:1; }
  .totals-right { width:280px; }
  .totals-table { border-collapse:collapse; font-size:11.5px; width:100%; border:1px solid #ddd; border-radius:2px; }
  .totals-table td { padding:6px 10px; border-bottom:1px solid #eee; }
  .totals-table td:first-child { background:${accentTint}; }
  .totals-table td.num { text-align:right; }
  .totals-table tr.total-row td { font-weight:bold; border-top:2px solid #333; }
  .payment-box { border:1px solid #e5e7eb; padding:8px 10px; border-radius:2px; font-size:11px; margin-bottom:8px; }
  .bank-tbl { width:100%; border-collapse:collapse; font-size:10.5px; margin-top:6px; }
  .bank-tbl th,.bank-tbl td { padding:4px 6px; text-align:left; border:1px solid #eee; }
  .bank-tbl th { background:#f5f5f5; font-weight:600; }
  .disclaimer { margin-top:12px; font-size:10px; color:#aaa; font-style:italic; }
</style>
</head>
<body>
<div class="top-hdr">
  <div class="inv-nr-big">${invoice.is_credit ? "CREDIT-INVOICE" : t.invoice} ${invoice.invoice_number || ""}</div>
  <div class="inv-date">${t.date}: ${formatDate(invoice.invoice_date)}</div>
</div>

<div class="info-line">
  ${logoUrl ? `<div><img src="${logoUrl}" alt="Logo" style="height:36px;max-width:100px;object-fit:contain"></div>` : ""}
  <div><span class="info-lbl">${t.beneficiary}</span> ${beneficiaryName}${beneficiaryAddress ? ` · ${beneficiaryAddress}` : ""}</div>
  <div><span class="info-lbl">${t.payer}</span> ${invoice.payer_name || "-"}${invoice.payer_address ? ` · ${invoice.payer_address}` : ""}</div>
  ${invoice.is_credit ? `<div style="color:green;font-size:11px">${t.refundCredit}</div>` : ""}
</div>

<table class="items-table">
  <thead>
    <tr>
      <th>${t.dates}</th>
      <th>${t.service}</th>
      <th>${t.client}</th>
      <th style="text-align:right">${t.amount}</th>
    </tr>
  </thead>
  <tbody>
    ${items.length ? items.map((r) => `<tr><td>${r.dates}</td><td style="white-space:pre-line">${r.serviceText}</td><td style="white-space:pre-line">${r.client}</td><td class="amt">${r.amount}</td></tr>`).join("") : `<tr><td colspan="4">${t.noItems}</td></tr>`}
  </tbody>
</table>

<div class="bottom-wrap">
  <div class="payment-left">
    ${hasPaymentTerms ? `
    <div class="payment-box">
      <strong>${t.paymentTerms}:</strong><br>
      ${paymentTermsText}
    </div>
    ` : ""}
    ${bankAccounts.length > 0 ? `
    <table class="bank-tbl">
      <tr><th colspan="4">${t.bankingDetails} — ${beneficiaryName}</th></tr>
      <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
      ${bankRowsHTML(bankAccounts)}
    </table>
    ` : ""}
    <p class="disclaimer">${t.electronicDisclaimer}</p>
  </div>
  <div class="totals-right">
    <table class="totals-table">
      ${isLatvia ? buildLatviaBlock(invoice, lang, t) : buildNonLatviaTotals(invoice, t)}
    </table>
    <div style="text-align:center;color:#888;font-size:11px;margin-top:10px">${t.thankYou}</div>
  </div>
</div>
</body>
</html>`;
}

// ─── Hex to RGB helper ────────────────────────────────────────────────────────

function hexToRgb(hex: string): string | null {
  const clean = (hex || "").replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r},${g},${b}`;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function generateTemplatedInvoiceHTML(
  invoice: any,
  logoUrl: string | null,
  company: InvoiceCompanyInfo | null,
  templateId: string,
  accentColor: string
): string {
  const accent = accentColor || "#1e40af";
  switch (templateId as InvoiceTemplateId) {
    case "modern-clean":    return templateModernClean(invoice, logoUrl, company, accent);
    case "ultra-modern":    return templateUltraModern(invoice, logoUrl, company, accent);
    case "corporate":       return templateCorporate(invoice, logoUrl, company, accent);
    case "elegant":         return templateElegant(invoice, logoUrl, company, accent);
    case "compact-pro":     return templateCompactPro(invoice, logoUrl, company, accent);
    case "bold-header":     return templateBoldHeader(invoice, logoUrl, company, accent);
    case "two-column":      return templateTwoColumn(invoice, logoUrl, company, accent);
    case "sidebar-accent":  return templateSidebarAccent(invoice, logoUrl, company, accent);
    case "table-focus":     return templateTableFocus(invoice, logoUrl, company, accent);
    case "classic":
    default:                return templateClassic(invoice, logoUrl, company, accent);
  }
}

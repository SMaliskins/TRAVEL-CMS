import { formatDateDDMMYYYY, type DateFormatPattern } from "@/utils/dateFormat";
import type { InvoiceCompanyInfo } from "@/lib/invoices/generateInvoiceHTML";

const RECEIPT_LABELS: Record<string, Record<string, string>> = {
  en: {
    title: "DEPOSIT RECEIPT",
    beneficiary: "Beneficiary",
    payer: "Payer",
    paymentDate: "Payment Date",
    paymentMethod: "Payment Method",
    linkedInvoice: "Linked Invoice",
    creditedAccount: "Credited Account",
    bank: "Bank",
    description: "Description",
    amount: "Amount",
    totalReceived: "Total Received",
    bankingDetails: "Banking Details",
    beneficiaryLabel: "Beneficiary",
    note: "Note",
    disclaimer: "This receipt was prepared electronically and is valid without signature and stamp.",
    thankYou: "Thank you for your payment.",
    depositFor: "Deposit received for order",
    deposit: "Deposit received",
    order: "Order",
    client: "Client",
  },
  lv: {
    title: "DEPOZĪTA KVĪTS",
    beneficiary: "Saņēmējs",
    payer: "Maksātājs",
    paymentDate: "Maksājuma datums",
    paymentMethod: "Maksājuma veids",
    linkedInvoice: "Saistītais rēķins",
    creditedAccount: "Konta saņēmējs",
    bank: "Banka",
    description: "Apraksts",
    amount: "Summa",
    totalReceived: "Kopā saņemts",
    bankingDetails: "Bankas dati",
    beneficiaryLabel: "Saņēmēja nosaukums",
    note: "Piezīme",
    disclaimer: "Kvīts sagatavota elektroniski un ir derīga bez paraksta un zīmoga.",
    thankYou: "Paldies par maksājumu.",
    depositFor: "Saņemts depozīts pasūtījumam",
    deposit: "Saņemts depozīts",
    order: "Pasūtījums",
    client: "Klients",
  },
  ru: {
    title: "ДЕПОЗИТНАЯ КВИТАНЦИЯ",
    beneficiary: "Получатель",
    payer: "Плательщик",
    paymentDate: "Дата платежа",
    paymentMethod: "Способ оплаты",
    linkedInvoice: "Связанный счёт",
    creditedAccount: "Счёт получателя",
    bank: "Банк",
    description: "Описание",
    amount: "Сумма",
    totalReceived: "Итого получено",
    bankingDetails: "Банковские реквизиты",
    beneficiaryLabel: "Наименование получателя",
    note: "Примечание",
    disclaimer: "Квитанция подготовлена в электронном виде и действительна без подписи и печати.",
    thankYou: "Благодарим за оплату.",
    depositFor: "Получен депозит за заказ",
    deposit: "Получен депозит",
    order: "Заказ",
    client: "Клиент",
  },
  de: {
    title: "ANZAHLUNGSQUITTUNG",
    beneficiary: "Zahlungsempfänger",
    payer: "Auftraggeber",
    paymentDate: "Zahlungsdatum",
    paymentMethod: "Zahlungsart",
    linkedInvoice: "Verknüpfte Rechnung",
    creditedAccount: "Gutgeschriebenes Konto",
    bank: "Bank",
    description: "Beschreibung",
    amount: "Betrag",
    totalReceived: "Gesamt erhalten",
    bankingDetails: "Bankdaten",
    beneficiaryLabel: "Empfängername",
    note: "Hinweis",
    disclaimer: "Diese Quittung wurde elektronisch erstellt und ist ohne Unterschrift und Stempel gültig.",
    thankYou: "Vielen Dank für Ihre Zahlung.",
    depositFor: "Anzahlung erhalten für Auftrag",
    deposit: "Anzahlung erhalten",
    order: "Auftrag",
    client: "Kunde",
  },
  fr: {
    title: "REÇU DE DÉPÔT",
    beneficiary: "Bénéficiaire",
    payer: "Payeur",
    paymentDate: "Date de paiement",
    paymentMethod: "Mode de paiement",
    linkedInvoice: "Facture liée",
    creditedAccount: "Compte crédité",
    bank: "Banque",
    description: "Description",
    amount: "Montant",
    totalReceived: "Total reçu",
    bankingDetails: "Coordonnées bancaires",
    beneficiaryLabel: "Nom du bénéficiaire",
    note: "Note",
    disclaimer: "Ce reçu a été préparé électroniquement et est valable sans signature ni tampon.",
    thankYou: "Merci pour votre paiement.",
    depositFor: "Acompte reçu pour la commande",
    deposit: "Acompte reçu",
    order: "Commande",
    client: "Client",
  },
  es: {
    title: "RECIBO DE DEPÓSITO",
    beneficiary: "Beneficiario",
    payer: "Pagador",
    paymentDate: "Fecha de pago",
    paymentMethod: "Método de pago",
    linkedInvoice: "Factura vinculada",
    creditedAccount: "Cuenta acreditada",
    bank: "Banco",
    description: "Descripción",
    amount: "Importe",
    totalReceived: "Total recibido",
    bankingDetails: "Datos bancarios",
    beneficiaryLabel: "Nombre del beneficiario",
    note: "Nota",
    disclaimer: "Este recibo fue preparado electrónicamente y es válido sin firma ni sello.",
    thankYou: "Gracias por su pago.",
    depositFor: "Depósito recibido para el pedido",
    deposit: "Depósito recibido",
    order: "Pedido",
    client: "Cliente",
  },
};

export type DepositReceiptData = {
  receiptNumber: string;
  receiptDate: string;
  paymentDate: string;
  orderCode?: string | null;
  orderClient?: string | null;
  payerName?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  note?: string | null;
  invoiceNumber?: string | null;
  accountName?: string | null;
  accountBankName?: string | null;
  dateFormat?: DateFormatPattern;
  language?: string | null;
};

function formatAmount(amount: number, currency: string): string {
  const symbolByCurrency: Record<string, string> = {
    EUR: "EUR",
    USD: "USD",
    GBP: "GBP",
  };

  const code = symbolByCurrency[currency] || currency || "EUR";
  return `${Math.abs(Number(amount) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${code}`;
}

export function generateDepositReceiptHTML(
  receipt: DepositReceiptData,
  companyLogoUrl: string | null = null,
  company: InvoiceCompanyInfo | null = null
): string {
  const lang = (receipt.language && String(receipt.language).trim().toLowerCase()) || "en";
  const t = RECEIPT_LABELS[lang] || RECEIPT_LABELS.en;
  const companyName = company?.name || "Company";
  const payerName = receipt.payerName || receipt.orderClient || "-";
  const dateFormat = receipt.dateFormat;
  const receiptDate = formatDateDDMMYYYY(receipt.receiptDate, dateFormat);
  const paymentDate = formatDateDDMMYYYY(receipt.paymentDate, dateFormat);
  const amountText = formatAmount(receipt.amount, receipt.currency);
  const serviceDescription = receipt.orderCode
    ? `${t.depositFor} ${receipt.orderCode}`
    : t.deposit;

  const beneficiaryRegVatLine =
    (company?.regNr ? `Reg. Nr: ${company.regNr}<br>` : "") +
    (company?.vatNr ? `VAT: ${company.vatNr}<br>` : "");

  const bankAccounts = company?.bankAccounts && company.bankAccounts.length > 0
    ? company.bankAccounts
    : [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${t.title} ${receipt.receiptNumber}</title>
  <style>
    @page { size: A4; margin: 5mm; }
    html, body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 12px; box-sizing: border-box; }
    body { margin: 5mm; }
    * { box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .doc-title { font-size: 30px; font-weight: bold; letter-spacing: 0.02em; }
    .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 8px; }
    .section { border: 1px solid #ddd; background: #fafafa; padding: 12px 15px; border-radius: 5px; font-size: 12px; }
    .section-title { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
    .section-content { font-size: 12px; }
    .section-content .company-name { font-size: 13px; font-weight: bold; }
    .meta-box { border: 1px solid #ddd; border-radius: 5px; padding: 10px 12px; margin: 10px 0 14px 0; background: #fff; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
    .items-table { width: 100%; border-collapse: collapse; margin: 8px 0 16px 0; font-size: 12px; }
    .items-table th, .items-table td { padding: 8px 10px; border: 1px solid #ddd; font-size: 12px; }
    .items-table th { text-align: left; background: #f5f5f5; font-weight: 600; text-transform: uppercase; color: #444; }
    .items-table th:last-child, .items-table td.amount { text-align: right; width: 140px; min-width: 140px; }
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
    .totals-table { border-collapse: collapse; font-size: 12px; width: 340px; }
    .totals-table td { padding: 6px 10px; border: 1px solid #eee; }
    .totals-table td:first-child { background: #fafafa; }
    .totals-table td.num { text-align: right; width: 140px; min-width: 140px; }
    .totals-table tr.total-row td { font-weight: bold; border-top: 2px solid #333; }
    .bank-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    .bank-table th, .bank-table td { padding: 6px 10px; text-align: left; border: 1px solid #ddd; }
    .bank-table th { background: #f5f5f5; font-weight: 600; }
    .note { margin-top: 10px; padding: 10px 12px; border-radius: 5px; background: #fff3cd; border: 1px solid #f3e3a3; }
    .thank-you { margin-top: 24px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="flex-shrink: 0;">
      ${companyLogoUrl ? `
        <div style="width: 160px; height: 160px; overflow: hidden;">
          <img src="${companyLogoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
      ` : `
        <div style="width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">
          Logo
        </div>
      `}
    </div>
    <div style="text-align: right; flex: 1;">
      <div class="doc-title">${t.title}</div>
      <div style="margin-top: 8px; font-size: 12px; font-weight: bold;">${receipt.receiptNumber}</div>
      <div style="margin-top: 4px; font-size: 12px;"><strong>${t.paymentDate}:</strong> ${receiptDate}</div>
    </div>
  </div>

  <div class="sections">
    <div class="section">
      <div class="section-title">${t.beneficiary}</div>
      <div class="section-content">
        <span class="company-name">${companyName}</span><br>
        ${beneficiaryRegVatLine}
        ${company?.address ? `${company.address}<br>` : ""}
      </div>
    </div>
    <div class="section">
      <div class="section-title">${t.payer}</div>
      <div class="section-content">
        <span class="company-name">${payerName}</span><br>
        ${receipt.orderCode ? `${t.order}: ${receipt.orderCode}<br>` : ""}
        ${receipt.orderClient && receipt.orderClient !== payerName ? `${t.client}: ${receipt.orderClient}<br>` : ""}
      </div>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-grid">
      <div><strong>${t.paymentDate}:</strong> ${paymentDate}</div>
      <div><strong>${t.paymentMethod}:</strong> ${receipt.paymentMethod}</div>
      <div><strong>${t.linkedInvoice}:</strong> ${receipt.invoiceNumber || "-"}</div>
      <div><strong>${t.creditedAccount}:</strong> ${receipt.accountName || "-"}</div>
      <div><strong>${t.bank}:</strong> ${receipt.accountBankName || "-"}</div>
      <div></div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>${t.description}</th>
        <th style="text-align: right;">${t.amount}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${serviceDescription}</td>
        <td class="amount">${amountText}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-table">
      <tr class="total-row">
        <td>${t.totalReceived}</td>
        <td class="num">${amountText}</td>
      </tr>
    </table>
  </div>

  ${bankAccounts.length > 0 ? `
    <table class="bank-table">
      <tr><th colspan="4">${t.bankingDetails}</th></tr>
      <tr><td colspan="4"><strong>${t.beneficiaryLabel}:</strong> ${companyName}</td></tr>
      <tr><th>${t.bank}</th><th>IBAN</th><th>SWIFT</th><th>${t.amount}</th></tr>
      ${bankAccounts.map((acc) => {
        const currency = (acc.currency === "MULTI" || acc.currency === "Multi-currency")
          ? "Multi"
          : (acc.currency || "EUR");
        return `<tr><td>${acc.bank_name || ""}</td><td style="word-break: break-all;">${acc.iban || ""}</td><td>${acc.swift || ""}</td><td>${currency}</td></tr>`;
      }).join("")}
    </table>
  ` : ""}

  ${receipt.note ? `<div class="note"><strong>${t.note}:</strong> ${receipt.note}</div>` : ""}

  <p style="margin-top: 18px; font-size: 11px; color: #666; font-style: italic;">${t.disclaimer}</p>
  <div class="thank-you">${t.thankYou}</div>
</body>
</html>
  `;
}

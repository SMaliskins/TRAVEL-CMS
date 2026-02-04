/** Company (beneficiary) data for invoice: who receives the payment */
export type InvoiceCompanyInfo = {
  name: string;
  address?: string | null;
  regNr?: string | null;
  vatNr?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankSwift?: string | null;
};

/** Invoice UI labels by language (for PDF/HTML output) */
const INVOICE_LABELS: Record<string, Record<string, string>> = {
  en: {
    invoice: "INVOICE",
    creditNote: "CREDIT NOTE",
    refundCredit: "Refund / Credit",
    date: "Date",
    beneficiary: "Beneficiary",
    regNr: "Reg. Nr",
    pvn: "PVN",
    payer: "Payer",
    dates: "Dates",
    service: "Service",
    client: "Client",
    amount: "Amount",
    noItems: "No items",
    subtotal: "Subtotal",
    vat: "VAT",
    total: "Total",
    paymentTerms: "Payment Terms",
    deposit: "Deposit",
    finalPayment: "Final Payment",
    bankingDetails: "Banking Details",
    bank: "Bank",
    account: "Account",
    dueDate: "Due Date",
    thankYou: "Thank you for your business!",
  },
  lv: {
    invoice: "RĒKINS",
    creditNote: "KRĒDITNOTA",
    refundCredit: "Atgriezums / Kredīts",
    date: "Datums",
    beneficiary: "Saņēmējs",
    regNr: "Reģ. Nr",
    pvn: "PVN",
    payer: "Maksātājs",
    dates: "Datumi",
    service: "Pakalpojums",
    client: "Klients",
    amount: "Summa",
    noItems: "Nav pozīciju",
    subtotal: "Starpsumma",
    vat: "PVN",
    total: "Kopā",
    paymentTerms: "Apmaksas noteikumi",
    deposit: "Īres nauda",
    finalPayment: "Galīgais maksājums",
    bankingDetails: "Bankas dati",
    bank: "Banka",
    account: "Konts",
    dueDate: "Termiņš",
    thankYou: "Paldies par sadarbību!",
  },
  ru: {
    invoice: "СЧЁТ",
    creditNote: "КРЕДИТНОЕ УВЕДОМЛЕНИЕ",
    refundCredit: "Возврат / Кредит",
    date: "Дата",
    beneficiary: "Получатель",
    regNr: "Рег. №",
    pvn: "НДС",
    payer: "Плательщик",
    dates: "Даты",
    service: "Услуга",
    client: "Клиент",
    amount: "Сумма",
    noItems: "Нет позиций",
    subtotal: "Подытог",
    vat: "НДС",
    total: "Итого",
    paymentTerms: "Условия оплаты",
    deposit: "Предоплата",
    finalPayment: "Окончательная оплата",
    bankingDetails: "Банковские реквизиты",
    bank: "Банк",
    account: "Счёт",
    dueDate: "Срок оплаты",
    thankYou: "Благодарим за сотрудничество!",
  },
  de: {
    invoice: "RECHNUNG",
    creditNote: "GUTSCHRIFT",
    refundCredit: "Erstattung / Gutschrift",
    date: "Datum",
    beneficiary: "Zahlungsempfänger",
    regNr: "Reg.-Nr.",
    pvn: "USt.-IdNr.",
    payer: "Zahler",
    dates: "Daten",
    service: "Leistung",
    client: "Kunde",
    amount: "Betrag",
    noItems: "Keine Positionen",
    subtotal: "Zwischensumme",
    vat: "MwSt.",
    total: "Gesamt",
    paymentTerms: "Zahlungsbedingungen",
    deposit: "Anzahlung",
    finalPayment: "Schlusszahlung",
    bankingDetails: "Bankverbindung",
    bank: "Bank",
    account: "Konto",
    dueDate: "Fälligkeitsdatum",
    thankYou: "Vielen Dank für Ihre Zusammenarbeit!",
  },
  fr: {
    invoice: "FACTURE",
    creditNote: "AVOIR",
    refundCredit: "Remboursement / Avoir",
    date: "Date",
    beneficiary: "Bénéficiaire",
    regNr: "N° SIRET",
    pvn: "TVA",
    payer: "Payeur",
    dates: "Dates",
    service: "Prestation",
    client: "Client",
    amount: "Montant",
    noItems: "Aucune ligne",
    subtotal: "Sous-total",
    vat: "TVA",
    total: "Total",
    paymentTerms: "Conditions de paiement",
    deposit: "Acompte",
    finalPayment: "Solde",
    bankingDetails: "Coordonnées bancaires",
    bank: "Banque",
    account: "Compte",
    dueDate: "Date d'échéance",
    thankYou: "Merci pour votre confiance !",
  },
  es: {
    invoice: "FACTURA",
    creditNote: "NOTA DE CRÉDITO",
    refundCredit: "Reembolso / Crédito",
    date: "Fecha",
    beneficiary: "Beneficiario",
    regNr: "CIF",
    pvn: "IVA",
    payer: "Pagador",
    dates: "Fechas",
    service: "Servicio",
    client: "Cliente",
    amount: "Importe",
    noItems: "Sin partidas",
    subtotal: "Subtotal",
    vat: "IVA",
    total: "Total",
    paymentTerms: "Condiciones de pago",
    deposit: "Anticipo",
    finalPayment: "Pago final",
    bankingDetails: "Datos bancarios",
    bank: "Banco",
    account: "Cuenta",
    dueDate: "Fecha de vencimiento",
    thankYou: "¡Gracias por su confianza!",
  },
};

/**
 * Generate invoice HTML for PDF/email
 * Shared between PDF route and email route.
 * Uses invoice.language for labels (en, lv, ru, de, fr, es); falls back to en.
 * @param company When provided, Beneficiary and Banking Details use company (the issuer); otherwise fallback to invoice fields (legacy)
 */
export function generateInvoiceHTML(
  invoice: any,
  companyLogoUrl: string | null = null,
  company: InvoiceCompanyInfo | null = null
): string {
  const lang = (invoice?.language && typeof invoice.language === "string") ? invoice.language.trim().toLowerCase() : "en";
  const t = INVOICE_LABELS[lang] || INVOICE_LABELS.en;

  const formatCurrency = (amount: number) => {
    return `€${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const beneficiaryName = company ? (company.name || "Company Name") : (invoice.client_name || "Company Name");
  const beneficiaryReg = company ? company.regNr ?? null : (invoice.payer_reg_nr ?? null);
  const beneficiaryVat = company ? company.vatNr ?? null : (invoice.payer_vat_nr ?? null);
  const beneficiaryAddress = company ? (company.address ?? null) : (invoice.client_address ?? null);
  const beneficiaryRegVatLine = (beneficiaryReg || beneficiaryVat)
    ? `${beneficiaryReg ? t.regNr + ": " + beneficiaryReg : ""}${beneficiaryReg && beneficiaryVat ? " • " : ""}${beneficiaryVat ? t.pvn + ": " + beneficiaryVat : ""}<br>`
    : "";

  const bankName = company?.bankName ?? invoice.bank_name;
  const bankAccount = company?.bankAccount ?? invoice.bank_account;
  const bankSwift = company?.bankSwift ?? invoice.bank_swift;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; font-size: 12px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .invoice-title { font-size: 32px; font-weight: bold; }
    .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .section { background: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 12px; }
    .section-title { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 10px; }
    .section-content { font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
    th { text-align: left; padding: 10px; background: #f5f5f5; border-bottom: 2px solid #ddd; font-size: 12px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    .totals { text-align: right; margin-top: 20px; font-size: 12px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
    .total-final { font-size: 12px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
    .payment-terms { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 12px; }
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
    <div style="text-align: right; flex: 1; align-self: flex-start;">
      <div class="invoice-title" style="font-size: 32px; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.02em;">${invoice.is_credit ? t.creditNote : t.invoice}</div>
      ${invoice.is_credit ? `<div style="color: green; font-size: 12px;">${t.refundCredit}</div>` : ""}
      <div style="margin-top: 8px; font-size: 12px; font-weight: bold;">${invoice.invoice_number}</div>
    </div>
  </div>

  <div style="margin-bottom: 20px;">
    <strong>${t.date}:</strong> ${formatDate(invoice.invoice_date)}
  </div>

    <div class="sections">
      <div class="section">
        <div class="section-title">${t.beneficiary}</div>
        <div class="section-content">
          <strong>${beneficiaryName}</strong><br>
          ${beneficiaryRegVatLine}
          ${beneficiaryAddress ? beneficiaryAddress + "<br>" : ""}
        </div>
      </div>
      <div class="section">
        <div class="section-title">${t.payer}</div>
        <div class="section-content">
          <strong>${invoice.payer_name || "-"}</strong><br>
          ${invoice.payer_address ? invoice.payer_address + "<br>" : ""}
          ${invoice.payer_email ? invoice.payer_email + "<br>" : ""}
          ${invoice.payer_phone ? invoice.payer_phone : ""}
        </div>
      </div>
    </div>

  <table>
    <thead>
      <tr>
        <th>${t.dates}</th>
        <th>${t.service}</th>
        <th>${t.client}</th>
        <th style="text-align: right;">${t.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.invoice_items?.map((item: any) => `
        <tr>
          <td>${item.service_date_from ? formatDate(item.service_date_from) : "-"}${item.service_date_to && item.service_date_to !== item.service_date_from ? " - " + formatDate(item.service_date_to) : ""}</td>
          <td style="word-wrap: break-word; white-space: normal;">${item.service_name || "-"}</td>
          <td>${item.service_client || "-"}</td>
          <td style="text-align: right;">${formatCurrency(item.line_total)}</td>
        </tr>
      `).join("") || `<tr><td colspan="4">${t.noItems}</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>${t.subtotal}:</span>
      <span>${formatCurrency(invoice.subtotal || 0)}</span>
    </div>
    <div class="total-row">
      <span>${t.vat} (${invoice.tax_rate || 0}%):</span>
      <span>${formatCurrency(invoice.tax_amount || 0)}</span>
    </div>
    <div class="total-row total-final">
      <span>${t.total}:</span>
      <span>${formatCurrency(invoice.total || 0)}</span>
    </div>
  </div>

  ${(invoice.deposit_amount || invoice.final_payment_amount) ? `
    <div class="payment-terms">
      <strong>${t.paymentTerms}</strong><br>
      ${invoice.deposit_amount && invoice.deposit_date ? `${t.deposit}: ${formatCurrency(invoice.deposit_amount)} by ${formatDate(invoice.deposit_date)}<br>` : ""}
      ${invoice.final_payment_amount && invoice.final_payment_date ? `${t.finalPayment}: ${formatCurrency(invoice.final_payment_amount)} by ${formatDate(invoice.final_payment_date)}<br>` : ""}
      ${(bankName || bankAccount || bankSwift) ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
          <strong>${t.bankingDetails}</strong><br>
          ${bankName ? `${t.bank}: ${bankName}<br>` : ""}
          ${bankAccount ? `${t.account}: ${bankAccount}<br>` : ""}
          ${bankSwift ? `SWIFT: ${bankSwift}` : ""}
        </div>
      ` : ""}
    </div>
  ` : (invoice.due_date ? `
    <div class="payment-terms">
      <strong>${t.dueDate}</strong><br>
      ${formatDate(invoice.due_date)}
      ${(bankName || bankAccount || bankSwift) ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
          <strong>${t.bankingDetails}</strong><br>
          ${bankName ? `${t.bank}: ${bankName}<br>` : ""}
          ${bankAccount ? `${t.account}: ${bankAccount}<br>` : ""}
          ${bankSwift ? `SWIFT: ${bankSwift}` : ""}
        </div>
      ` : ""}
    </div>
  ` : "")}

  <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
    ${t.thankYou}
  </div>
</body>
</html>
  `;
}

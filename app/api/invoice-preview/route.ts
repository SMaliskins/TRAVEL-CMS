import { NextRequest, NextResponse } from "next/server";
import { generateTemplatedInvoiceHTML } from "@/lib/invoices/invoiceTemplates";
import type { InvoiceCompanyInfo } from "@/lib/invoices/generateInvoiceHTML";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("template") || "classic";
  const accentColor = searchParams.get("accent") || "#1e40af";

  const fakeInvoice = {
    invoice_number: "INV-2024-0042",
    invoice_date: "2024-03-15",
    language: "en",
    is_credit: false,
    payer_name: "Nordic Travels OÜ",
    payer_address: "Pärnu mnt 12, Tallinn",
    payer_reg_nr: null,
    payer_vat_nr: null,
    payer_personal_code: null,
    invoice_items: [
      {
        service_name: "Flight TLL-CDG return",
        service_client: "John Smith",
        service_date_from: "2024-04-10",
        service_date_to: "2024-04-17",
        service_dates_text: null,
        line_total: 485.00,
      },
      {
        service_name: "Hotel Le Marais 7 nights",
        service_client: "John Smith",
        service_date_from: "2024-04-10",
        service_date_to: "2024-04-17",
        service_dates_text: null,
        line_total: 1260.00,
      },
      {
        service_name: "Airport Transfer CDG",
        service_client: "John Smith",
        service_date_from: "2024-04-10",
        service_date_to: "2024-04-10",
        service_dates_text: null,
        line_total: 95.00,
      },
    ],
    subtotal: 1840.00,
    tax_rate: 0,
    tax_amount: 0,
    total: 1840.00,
    deposit_amount: 920.00,
    deposit_date: "2024-03-25",
    final_payment_amount: 920.00,
    final_payment_date: "2024-04-01",
    due_date: null,
  };

  const fakeCompany: InvoiceCompanyInfo = {
    name: "Sunshine Travel Agency",
    address: "Brīvības iela 45, Riga, Latvia",
    regNr: "40103XXXXXX",
    vatNr: "LV40103XXXXXX",
    country: "Latvia",
    bankAccounts: [
      {
        bank_name: "Swedbank AS",
        iban: "LV02HABALV0000000000",
        swift: "HABALV22",
        currency: "EUR",
      },
    ],
  };

  const html = generateTemplatedInvoiceHTML(fakeInvoice, null, fakeCompany, templateId, accentColor);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

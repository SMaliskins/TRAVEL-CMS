/**
 * Parser for Lotus Notes CGN export format.
 * Records are key-value pairs separated by 2+ blank lines.
 */

export interface LotusOrder {
  number: number;
  tourNumber: string;
  status: number;
  tourCountry: string;
  tourCity: string;
  tourFrom: string | null;
  tourTo: string | null;
  tourLength: number;
  tourNights: number;
  tourCategory: string;
  tourType: number;
  tourOperator: string;
  groupName: string;
  transport: string;
  route: string;
  currency: string;
  createdAt: string | null;
  modifiedAt: string | null;
  createdBy: string;

  client: {
    name: string;
    personalCode: string;
    phone: string;
    email: string;
    type: string;
    city: string;
    street: string;
    zip: string;
    citizenship: string;
    birthday: string;
    clientNumber: string;
  };

  travellers: Array<{ name: string; personalCode: string }>;

  finance: {
    clientPrice: number;
    clientPaid: number;
    clientDebt: number;
    clientDiscount: number;
    netto: number;
    profit: number;
    realProfit: number;
    vat: number;
  };

  invoices: Array<{
    number: string;
    payer: string;
    sum: number;
    paid: number;
    debt: number;
    status: string;
    lotusId: string;
  }>;

  servicesTotal: number;
  servicesActive: number;
  servicesPaid: number;

  raw: Record<string, string>;
}

function parseLotusDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const clean = val.trim().split(" ")[0];
  const parts = clean.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseLotusDateTime(val: string): string | null {
  if (!val || !val.trim()) return null;
  const parts = val.trim().split(" ");
  const datePart = parseLotusDate(parts[0]);
  if (!datePart) return null;
  const timePart = parts[1] || "00:00:00";
  return `${datePart}T${timePart}`;
}

function parseNumber(val: string): number {
  if (!val || !val.trim()) return 0;
  return parseFloat(val.replace(",", ".")) || 0;
}

function parseTravellers(serviceClient: string): Array<{ name: string; personalCode: string }> {
  if (!serviceClient) return [];
  return serviceClient.split(",").map((entry) => {
    const match = entry.trim().match(/^(.+?)<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), personalCode: match[2].trim() };
    }
    return { name: entry.trim(), personalCode: "" };
  }).filter((t) => t.name);
}

function parseInvoiceData(
  datalist: string,
  numbers: string,
  statuses: string
): LotusOrder["invoices"] {
  if (!datalist) return [];
  const entries = datalist.split("|").filter(Boolean);
  const nums = numbers ? numbers.split(",").map((n) => n.trim()) : [];
  const stats = statuses ? statuses.split(",").map((s) => s.trim()) : [];

  const invoices: LotusOrder["invoices"] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const line = entries[i]?.trim();
    const lotusId = entries[i + 1]?.trim() || "";
    if (!line) continue;

    const match = line.match(/^\s*(.+?)\s+([\d.,]+)\s*\/\s*([\d.,]+)\s*\/\s*([\d.,]+)\s+(\w+)\s*-\s*(.+)$/);
    if (match) {
      invoices.push({
        payer: match[1].trim(),
        sum: parseNumber(match[2]),
        paid: parseNumber(match[3]),
        debt: parseNumber(match[4]),
        status: match[6].trim(),
        number: nums[invoices.length] || "",
        lotusId,
      });
    }
  }
  return invoices;
}

function parseRecord(fields: Record<string, string>): LotusOrder {
  const travellers = parseTravellers(fields["SERVICECLIENT"] || "");
  if (travellers.length === 0 && fields["TOURPEOPLES"]) {
    for (const name of fields["TOURPEOPLES"].split(",")) {
      if (name.trim()) travellers.push({ name: name.trim(), personalCode: "" });
    }
  }

  return {
    number: parseInt(fields["Number"] || "0") || 0,
    tourNumber: fields["TourNumber"] || "",
    status: parseInt(fields["Status"] || "0") || 0,
    tourCountry: fields["TourCountry"] || "",
    tourCity: fields["TourCity"] || "",
    tourFrom: parseLotusDate(fields["TourFrom"] || ""),
    tourTo: parseLotusDate(fields["TourTo"] || ""),
    tourLength: parseInt(fields["TourLength"] || "0") || 0,
    tourNights: parseInt(fields["TourNights"] || "0") || 0,
    tourCategory: fields["TourCategory"] || "",
    tourType: parseInt(fields["TourType"] || "0") || 0,
    tourOperator: fields["TourOperator"] || "",
    groupName: fields["GroupName"] || "",
    transport: fields["Transport"] || "",
    route: fields["Route"] || "",
    currency: fields["Curr"] || fields["BaseCurr"] || "EUR",
    createdAt: parseLotusDateTime(fields["TimeCreated"] || ""),
    modifiedAt: parseLotusDateTime(fields["TimeModified"] || ""),
    createdBy: fields["User"] || "",

    client: {
      name: fields["Client"] || "",
      personalCode: fields["ClientID"] || "",
      phone: fields["ClientPhone"] || "",
      email: fields["ClientMail"] || "",
      type: (fields["CLIENTTYPE"] || "Person").toLowerCase(),
      city: fields["ClientCity"] || "",
      street: fields["ClientStreet"] || "",
      zip: fields["ClientZIP"] || "",
      citizenship: fields["ClientCitizenship"] || "",
      birthday: fields["ClientGeburtstag"] || "",
      clientNumber: fields["ClientNumber"] || "",
    },

    travellers,

    finance: {
      clientPrice: parseNumber(fields["ClientPrice"] || ""),
      clientPaid: parseNumber(fields["ClientPaid"] || ""),
      clientDebt: parseNumber(fields["ClientDebt"] || ""),
      clientDiscount: parseNumber(fields["ClientDiscount"] || ""),
      netto: parseNumber(fields["Netto"] || ""),
      profit: parseNumber(fields["Profit"] || ""),
      realProfit: parseNumber(fields["RealProfit"] || ""),
      vat: parseNumber(fields["VAT"] || ""),
    },

    invoices: parseInvoiceData(
      fields["INVOICEDATALIST"] || "",
      fields["INVOICENUMBERS"] || "",
      fields["INVOICESTATUSESWORD"] || ""
    ),

    servicesTotal: parseInt(fields["SERVICESTOTAL"] || "0") || 0,
    servicesActive: parseInt(fields["SERVICESACTIVE"] || "0") || 0,
    servicesPaid: parseInt(fields["SERVICESPAID"] || "0") || 0,

    raw: fields,
  };
}

export function parseLotusExport(text: string): LotusOrder[] {
  const blocks = text.split(/\n{3,}/);
  const orders: LotusOrder[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 5) continue;

    const fields: Record<string, string> = {};
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      if (key && !key.startsWith("$")) {
        fields[key] = value;
      }
    }

    if (fields["Number"] && fields["Client"]) {
      orders.push(parseRecord(fields));
    }
  }

  return orders;
}

/** Company (beneficiary) data for invoice: who receives the payment */
export type InvoiceCompanyInfo = {
  name: string;
  address?: string | null;
  regNr?: string | null;
  vatNr?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankSwift?: string | null;
  bankAccounts?: { account_name?: string; bank_name?: string; iban?: string; swift?: string; currency?: string }[];
  /** Company registration country (e.g. "Latvia"). Used to choose invoice totals template. */
  country?: string | null;
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
    beneficiaryName: "Beneficiary name",
    bank: "Bank",
    account: "IBAN",
    dueDate: "Due Date",
    thankYou: "Thank you for your business!",
    invoiceNo: "Invoice #",
    referenceNr: "Reference Nr.",
    personalCode: "Personal Code",
    fullPayment: "Full Payment",
    by: "by",
    electronicDisclaimer: "This invoice was prepared electronically and is valid without signature and stamp.",
    summa: "Summa",
    nonTaxableAmount: "Amount not subject to VAT",
    taxable0: "Amount taxable at 0% VAT",
    taxable21: "Amount taxable at 21% VAT",
    vat21: "VAT 21%",
    legalNote0: "VAT 0%, VAT Act §46 Part 3, 4",
    legalNote21: "VAT 21% VAT Act §136, profit margin scheme for travel agencies",
    summaApmaksai: "Amount to pay",
    summaVardiem: "Amount in words",
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
    deposit: "Rēķina priekšapmaksa",
    finalPayment: "Rēķina galīgā apmaksa",
    bankingDetails: "Bankas dati",
    beneficiaryName: "Saņēmēja nosaukums",
    bank: "Banka",
    account: "IBAN",
    dueDate: "Termiņš",
    thankYou: "Paldies par sadarbību!",
    invoiceNo: "Rēķina nr.",
    referenceNr: "Ref. nr.",
    personalCode: "Personas kods",
    fullPayment: "Pilna apmaksa",
    by: "līdz",
    electronicDisclaimer: "Rēķins ir sagatavots elektroniski un ir derīgs bez paraksta un zīmoga.",
    summa: "Summa",
    nonTaxableAmount: "Neapliekama ar PVN summa",
    taxable0: "Ar PVN 0% apliekamā summa",
    taxable21: "Ar PVN 21% apliekamā summa",
    vat21: "PVN 21%",
    legalNote0: "PVN 0%, PVN likuma 46.pants 3.,4. daļa",
    legalNote21: "PVN 21% PVN likuma 136.pants, peļņas daļas režīms ceļojumu aģentūrām",
    summaApmaksai: "Summa apmaksai",
    summaVardiem: "Summa vārdiem",
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
    beneficiaryName: "Наименование получателя",
    bank: "Банк",
    account: "IBAN",
    dueDate: "Срок оплаты",
    thankYou: "Благодарим за сотрудничество!",
    invoiceNo: "Счёт №",
    referenceNr: "Реф. №",
    personalCode: "Персональный код",
    fullPayment: "Полная оплата",
    by: "до",
    electronicDisclaimer: "Счёт подготовлен в электронном виде и действителен без подписи и печати.",
    summa: "Сумма",
    nonTaxableAmount: "Сумма, не облагаемая НДС",
    taxable0: "Сумма, облагаемая НДС 0%",
    taxable21: "Сумма, облагаемая НДС 21%",
    vat21: "НДС 21%",
    legalNote0: "НДС 0%",
    legalNote21: "НДС 21%",
    summaApmaksai: "Сумма к оплате",
    summaVardiem: "Сумма прописью",
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
    beneficiaryName: "Zahlungsempfänger",
    bank: "Bank",
    account: "IBAN",
    dueDate: "Fälligkeitsdatum",
    thankYou: "Vielen Dank für Ihre Zusammenarbeit!",
    invoiceNo: "Rechnung Nr.",
    referenceNr: "Ref.-Nr.",
    personalCode: "Personalausweisnummer",
    fullPayment: "Restzahlung",
    by: "bis",
    electronicDisclaimer: "Diese Rechnung wurde elektronisch erstellt und ist ohne Unterschrift und Stempel gültig.",
    summa: "Summe",
    nonTaxableAmount: "Nicht steuerpflichtiger Betrag",
    taxable0: "Betrag mit 0% MwSt.",
    taxable21: "Betrag mit 21% MwSt.",
    vat21: "MwSt. 21%",
    legalNote0: "MwSt. 0%",
    legalNote21: "MwSt. 21%",
    summaApmaksai: "Zu zahlender Betrag",
    summaVardiem: "Betrag in Worten",
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
    beneficiaryName: "Bénéficiaire",
    bank: "Banque",
    account: "IBAN",
    dueDate: "Date d'échéance",
    thankYou: "Merci pour votre confiance !",
    invoiceNo: "Facture n°",
    referenceNr: "Réf. n°",
    personalCode: "Code personnel",
    fullPayment: "Solde total",
    by: "au",
    electronicDisclaimer: "Cette facture a été établie électroniquement et est valable sans signature ni cachet.",
    summa: "Montant",
    nonTaxableAmount: "Montant non assujetti à la TVA",
    taxable0: "Montant soumis à 0% TVA",
    taxable21: "Montant soumis à 21% TVA",
    vat21: "TVA 21%",
    legalNote0: "TVA 0%",
    legalNote21: "TVA 21%",
    summaApmaksai: "Montant à payer",
    summaVardiem: "Montant en lettres",
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
    beneficiaryName: "Beneficiario",
    bank: "Banco",
    account: "IBAN",
    dueDate: "Fecha de vencimiento",
    thankYou: "¡Gracias por su confianza!",
    invoiceNo: "Factura n.º",
    referenceNr: "Ref. n.º",
    personalCode: "Código personal",
    fullPayment: "Pago total",
    by: "antes del",
    electronicDisclaimer: "Esta factura se ha preparado electrónicamente y es válida sin firma ni sello.",
    summa: "Importe",
    nonTaxableAmount: "Importe no sujeto a IVA",
    taxable0: "Importe sujeto a IVA 0%",
    taxable21: "Importe sujeto a IVA 21%",
    vat21: "IVA 21%",
    legalNote0: "IVA 0%",
    legalNote21: "IVA 21%",
    summaApmaksai: "Importe a pagar",
    summaVardiem: "Importe en letras",
  },
  lt: {
    invoice: "SĄSKAITA FAKTŪRA",
    creditNote: "KREDITO PAŽYMA",
    refundCredit: "Grąžinimas / Kreditas",
    date: "Data",
    beneficiary: "Gavėjas",
    regNr: "Įm. kodas",
    pvn: "PVM",
    payer: "Mokėtojas",
    dates: "Datos",
    service: "Paslauga",
    client: "Klientas",
    amount: "Suma",
    noItems: "Nėra pozicijų",
    subtotal: "Tarpinė suma",
    vat: "PVM",
    total: "Iš viso",
    paymentTerms: "Mokėjimo sąlygos",
    deposit: "Avansas",
    finalPayment: "Galutinis mokėjimas",
    bankingDetails: "Banko duomenys",
    beneficiaryName: "Gavėjo pavadinimas",
    bank: "Bankas",
    account: "IBAN",
    dueDate: "Mokėjimo terminas",
    thankYou: "Dėkojame už bendradarbiavimą!",
    invoiceNo: "Sąskaita nr.",
    referenceNr: "Ref. nr.",
    personalCode: "Asmens kodas",
    fullPayment: "Pilna apmoka",
    by: "iki",
    electronicDisclaimer: "Ši sąskaita sukurta elektroniniu būdu ir galioja be parašo ir antspaudų.",
    summa: "Suma",
    nonTaxableAmount: "Suma neapmokestinama PVM",
    taxable0: "Suma apmokestinama 0% PVM",
    taxable21: "Suma apmokestinama 21% PVM",
    vat21: "PVM 21%",
    legalNote0: "PVM 0%",
    legalNote21: "PVM 21%",
    summaApmaksai: "Suma mokėti",
    summaVardiem: "Suma žodžiais",
  },
  pl: {
    invoice: "FAKTURA",
    creditNote: "NOTA KREDYTOWA",
    refundCredit: "Zwrot / Kredyt",
    date: "Data",
    beneficiary: "Odbiorca",
    regNr: "Regon",
    pvn: "NIP",
    payer: "Płatnik",
    dates: "Daty",
    service: "Usługa",
    client: "Klient",
    amount: "Kwota",
    noItems: "Brak pozycji",
    subtotal: "Suma częściowa",
    vat: "VAT",
    total: "Razem",
    paymentTerms: "Warunki płatności",
    deposit: "Zadatek",
    finalPayment: "Płatność końcowa",
    bankingDetails: "Dane bankowe",
    beneficiaryName: "Odbiorca",
    bank: "Bank",
    account: "IBAN",
    dueDate: "Termin płatności",
    thankYou: "Dziękujemy za współpracę!",
    invoiceNo: "Faktura nr",
    referenceNr: "Ref. nr",
    personalCode: "PESEL",
    fullPayment: "Płatność pełna",
    by: "do",
    electronicDisclaimer: "Faktura została wystawiona elektronicznie i jest ważna bez podpisu i pieczęci.",
    summa: "Kwota",
    nonTaxableAmount: "Kwota niepodlegająca VAT",
    taxable0: "Kwota objęta 0% VAT",
    taxable21: "Kwota objęta 21% VAT",
    vat21: "VAT 21%",
    legalNote0: "VAT 0%",
    legalNote21: "VAT 21%",
    summaApmaksai: "Kwota do zapłaty",
    summaVardiem: "Kwota słownie",
  },
  et: {
    invoice: "ARVE",
    creditNote: "KREEDITMÄRK",
    refundCredit: "Tagastus / Kreedit",
    date: "Kuupäev",
    beneficiary: "Saaja",
    regNr: "Reg. nr",
    pvn: "KM kood",
    payer: "Maksja",
    dates: "Kuupäevad",
    service: "Teenus",
    client: "Klient",
    amount: "Summa",
    noItems: "Pole kirjeid",
    subtotal: "Vahesumma",
    vat: "KM",
    total: "Kokku",
    paymentTerms: "Maksetingimused",
    deposit: "Sissemakse",
    finalPayment: "Lõppmakse",
    bankingDetails: "Pangandusandmed",
    beneficiaryName: "Saaja nimi",
    bank: "Pank",
    account: "IBAN",
    dueDate: "Tähtpäev",
    thankYou: "Tänan äriühingut!",
    invoiceNo: "Arve nr.",
    referenceNr: "Ref. nr.",
    personalCode: "Isikukood",
    fullPayment: "Täismakse",
    by: "kuni",
    electronicDisclaimer: "See arve on koostatud elektrooniliselt ja on kehtiv ilma allkirjata ja templita.",
    summa: "Summa",
    nonTaxableAmount: "Käibemaksuga mittekuuluv summa",
    taxable0: "0% käibemaksuga summa",
    taxable21: "21% käibemaksuga summa",
    vat21: "Käibemaks 21%",
    legalNote0: "Käibemaks 0%",
    legalNote21: "Käibemaks 21%",
    summaApmaksai: "Tasumisele kuuluv summa",
    summaVardiem: "Summa sõnadega",
  },
  hu: {
    invoice: "SZÁMLA",
    creditNote: "JÓVÁÍRÁS",
    refundCredit: "Visszatérítés / Jóváírás",
    date: "Dátum",
    beneficiary: "Kedvezményezett",
    regNr: "Cégj. sz.",
    pvn: "Adószám",
    payer: "Fizető",
    dates: "Dátumok",
    service: "Szolgáltatás",
    client: "Ügyfél",
    amount: "Összeg",
    noItems: "Nincs tétel",
    subtotal: "Részösszeg",
    vat: "ÁFA",
    total: "Összesen",
    paymentTerms: "Fizetési feltételek",
    deposit: "Előleg",
    finalPayment: "Végső fizetés",
    bankingDetails: "Banki adatok",
    beneficiaryName: "Kedvezményezett neve",
    bank: "Bank",
    account: "IBAN",
    dueDate: "Fizetési határidő",
    thankYou: "Köszönjük együttműködését!",
    invoiceNo: "Számla nr.",
    referenceNr: "Ref. nr.",
    personalCode: "Személyi ig. szám",
    fullPayment: "Teljes fizetés",
    by: "-ig",
    electronicDisclaimer: "A számla elektronikusan készült és aláírás és pecsét nélkül is érvényes.",
    summa: "Összeg",
    nonTaxableAmount: "ÁFÁ-val nem terhelt összeg",
    taxable0: "0% ÁFÁ-val terhelt összeg",
    taxable21: "21% ÁFÁ-val terhelt összeg",
    vat21: "ÁFA 21%",
    legalNote0: "ÁFA 0%",
    legalNote21: "ÁFA 21%",
    summaApmaksai: "Fizetendő összeg",
    summaVardiem: "Összeg betűvel",
  },
};

/** Service category type labels for "Pakalpojums" column: Aviobiļete, Viesnīca, Transfers, etc. */
const CATEGORY_TYPE_LABELS: Record<string, Record<string, string>> = {
  en: { flight: "Flight", hotel: "Hotel", transfer: "Transfers", tour: "Tour", insurance: "Insurance", visa: "Visa", rent_a_car: "Rent a car", cruise: "Cruise", other: "Other" },
  lv: { flight: "Aviobiļete", hotel: "Viesnīca", transfer: "Transfers", tour: "Tūre", insurance: "Apdrošināšana", visa: "Vīza", rent_a_car: "Auto noma", cruise: "Kruīzs", other: "Cits" },
  ru: { flight: "Авиабилет", hotel: "Отель", transfer: "Трансферы", tour: "Тур", insurance: "Страховка", visa: "Виза", rent_a_car: "Аренда авто", cruise: "Круиз", other: "Другое" },
  de: { flight: "Flug", hotel: "Hotel", transfer: "Transfers", tour: "Reise", insurance: "Versicherung", visa: "Visum", rent_a_car: "Mietwagen", cruise: "Kreuzfahrt", other: "Sonstiges" },
  fr: { flight: "Vol", hotel: "Hôtel", transfer: "Transferts", tour: "Tour", insurance: "Assurance", visa: "Visa", rent_a_car: "Location voiture", cruise: "Croisière", other: "Autre" },
  es: { flight: "Vuelo", hotel: "Hotel", transfer: "Traslados", tour: "Tour", insurance: "Seguro", visa: "Visado", rent_a_car: "Alquiler coche", cruise: "Crucero", other: "Otro" },
};

/** Derive category type from service_category name (e.g. "Flight" -> "flight"). Exported for invoice preview. */
export function getCategoryTypeFromName(categoryStr: string | null | undefined): string | null {
  if (!categoryStr || typeof categoryStr !== "string") return null;
  const c = categoryStr.trim().toLowerCase();
  if (!c) return null;
  if (c.includes("flight") || c.includes("aviob") || c.includes("air ticket")) return "flight";
  if (c.includes("hotel") || c.includes("viesn")) return "hotel";
  if (c.includes("transfer")) return "transfer";
  if (c.includes("tour") && !c.includes("transfer")) return "tour";
  if (c.includes("insurance") || c.includes("apdroš")) return "insurance";
  if (c.includes("visa") || c.includes("vīza")) return "visa";
  if (c.includes("rent") || c.includes("car") || c.includes("noma")) return "rent_a_car";
  if (c.includes("cruise") || c.includes("kruīz")) return "cruise";
  return "other";
}

/** Get service category label by type and language (e.g. flight + lv -> "Aviobiļete"). Exported for invoice preview. */
export function getCategoryLabel(type: string | null | undefined, lang: string): string {
  if (!type) return "";
  const code = (lang && String(lang).trim().toLowerCase()) || "en";
  const labels = CATEGORY_TYPE_LABELS[code] || CATEGORY_TYPE_LABELS.en;
  return labels[type] || labels.other || type;
}

/** Labels for invoice preview/UI by language (same keys as INVOICE_LABELS). */
export function getInvoiceLabels(lang: string): Record<string, string> {
  const code = (lang && String(lang).trim().toLowerCase()) || "en";
  return INVOICE_LABELS[code] || INVOICE_LABELS.en;
}

const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const LV_ONES = ["", "viens", "divi", "trīs", "četri", "pieci", "seši", "septiņi", "astoņi", "deviņi", "desmit", "vienpadsmit", "divpadsmit", "trīspadsmit", "četrpadsmit", "piecpadsmit", "sešpadsmit", "septiņpadsmit", "astoņpadsmit", "deviņpadsmit"];
const LV_TENS = ["", "", "divdesmit", "trīsdesmit", "četrdesmit", "piecdesmit", "sešdesmit", "septiņdesmit", "astoņdesmit", "deviņdesmit"];

function numberToWordsEn(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) n = Math.abs(n);
  const int = Math.floor(n);
  if (int >= 1000) {
    const th = Math.floor(int / 1000);
    const rest = int % 1000;
    const thStr = th === 1 ? "one thousand" : numberToWordsEn(th) + " thousand";
    return rest === 0 ? thStr : thStr + " " + numberToWordsEn(rest);
  }
  if (int >= 100) {
    const h = Math.floor(int / 100);
    const rest = int % 100;
    const hStr = EN_ONES[h] + " hundred";
    return rest === 0 ? hStr : hStr + " " + numberToWordsEn(rest);
  }
  if (int >= 20) {
    const t = Math.floor(int / 10);
    const o = int % 10;
    return o === 0 ? EN_TENS[t] : EN_TENS[t] + " " + EN_ONES[o];
  }
  return EN_ONES[int];
}

function numberToWordsLv(n: number): string {
  if (n === 0) return "nulle";
  if (n < 0) n = Math.abs(n);
  const int = Math.floor(n);
  if (int >= 1000) {
    const th = Math.floor(int / 1000);
    const rest = int % 1000;
    const thStr = th === 1 ? "viens tūkstotis" : numberToWordsLv(th) + " tūkstoši";
    return rest === 0 ? thStr : thStr + " " + numberToWordsLv(rest);
  }
  if (int >= 100) {
    const h = Math.floor(int / 100);
    const rest = int % 100;
    const hStr = h === 1 ? "viens simts" : LV_ONES[h] + " simti";
    return rest === 0 ? hStr : hStr + " " + numberToWordsLv(rest);
  }
  if (int >= 20) {
    const t = Math.floor(int / 10);
    const o = int % 10;
    return o === 0 ? LV_TENS[t] : LV_TENS[t] + " " + LV_ONES[o];
  }
  return LV_ONES[int];
}

/** Exported for invoice preview (e.g. Latvia block "Summa vārdiem"). Uses € for EUR. */
export function numberToWords(amount: number, lang: string): string {
  const int = Math.floor(Math.abs(amount));
  const dec = Math.round((Math.abs(amount) - int) * 100);
  const decStr = String(dec).padStart(2, "0");
  const word = (lang === "lv" ? numberToWordsLv(int) : numberToWordsEn(int));
  const currency = "€";
  return lang === "lv" ? `${word}, ${decStr} ${currency}` : `${word} and ${decStr}/100 ${currency}`;
}

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
  /** Use company country to decide totals template (e.g. Latvia = detailed VAT block). Language is only for labels. */
  const companyCountry = (company?.country && String(company.country).trim()) || "";
  const isLatviaCompany = /latvia|latvija|lettland/i.test(companyCountry);

  const currencySymbol = "€";
  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyWithCode = (amount: number, code = "EUR") => {
    const sym = code === "EUR" ? "€" : code;
    return `${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };
  const isIsoDate = (s: string | null) => s && /^\d{4}-\d{2}-\d{2}$/.test(String(s).trim());
  const formatDatesCell = (from: string | null, to: string | null) => {
    if (!from) return "-";
    if (isIsoDate(from)) {
      const fromFmt = formatDate(from);
      const toFmt = to && to !== from && isIsoDate(to) ? " - " + formatDate(to) : "";
      return fromFmt + toFmt;
    }
    return from;
  };

  const beneficiaryName = company ? (company.name || "Company Name") : (invoice.client_name || "Company Name");
  const beneficiaryReg = company ? company.regNr ?? null : (invoice.payer_reg_nr ?? null);
  const beneficiaryVat = company ? company.vatNr ?? null : (invoice.payer_vat_nr ?? null);
  const beneficiaryAddress = company ? (company.address ?? null) : (invoice.client_address ?? null);
  const beneficiaryRegVatLine =
    (beneficiaryReg ? `${t.regNr}: ${beneficiaryReg}<br>` : "") +
    (beneficiaryVat ? `${t.pvn}: ${beneficiaryVat}<br>` : "");

  const bankName = company?.bankName ?? invoice.bank_name;
  const bankAccount = company?.bankAccount ?? invoice.bank_account;
  const bankSwift = company?.bankSwift ?? invoice.bank_swift;
  const bankAccounts = company?.bankAccounts && company.bankAccounts.length > 0
    ? company.bankAccounts
    : (bankName || bankAccount || bankSwift) ? [{ bank_name: bankName, iban: bankAccount, swift: bankSwift }] : [];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    @page { size: A4; margin: 5mm; }
    html, body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 12px; box-sizing: border-box; }
    body { margin: 5mm; }
    * { box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .invoice-title { font-size: 32px; font-weight: bold; }
    .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .section { border: 1px solid #ddd; background: #fafafa; padding: 12px 15px; border-radius: 5px; font-size: 12px; }
    .section-title { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
    .section-content { font-size: 12px; }
    .section-content .company-name { font-size: 13px; font-weight: bold; }
    .bank-table { width: 100%; max-width: 560px; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    .bank-table th, .bank-table td { padding: 6px 10px; text-align: left; border: 1px solid #ddd; }
    .bank-table th { background: #f5f5f5; font-weight: 600; }
    .bank-table td.num { text-align: right; }
    .totals-table { width: 100%; max-width: 400px; border-collapse: collapse; font-size: 12px; }
    .totals-table td { padding: 6px 10px; border: 1px solid #eee; }
    .totals-table td:first-child { background: #fafafa; }
    .totals-table td.num { text-align: right; }
    .totals-table tr.total-row td { font-weight: bold; border-top: 2px solid #333; }
    .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .items-table th, .items-table td { padding: 8px 10px; border: 1px solid #ddd; font-size: 12px; }
    .items-table th { text-align: left; background: #f5f5f5; font-weight: 600; text-transform: uppercase; color: #444; }
    .items-table td.amount { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th { text-align: left; padding: 8px 10px; background: #f5f5f5; border-bottom: 2px solid #ddd; font-size: 12px; text-transform: uppercase; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    .totals-foot td { padding: 4px 10px; font-size: 12px; text-align: right; vertical-align: top; border: none; background: none; }
    .totals-foot tr.total-final td { font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
    .payment-terms { background: #fff3cd; padding: 12px 15px; border-radius: 5px; margin: 16px 0; font-size: 12px; }
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
      <div class="invoice-title" style="font-size: 32px; font-weight: bold; margin-bottom: 4px; letter-spacing: 0.02em;">${invoice.is_credit ? t.creditNote : t.invoice}</div>
      ${invoice.is_credit ? `<div style="color: green; font-size: 12px;">${t.refundCredit}</div>` : ""}
      <div style="margin-top: 8px; font-size: 12px; font-weight: bold;">${invoice.invoice_number}</div>
      <div style="margin-top: 4px; font-size: 12px;"><strong>${t.date}:</strong> ${formatDate(invoice.invoice_date)}</div>
    </div>
  </div>

  <div class="invoice-body" style="min-height: 400px;">
    <div class="sections">
      <div class="section">
        <div class="section-title">${t.beneficiary}</div>
        <div class="section-content">
          <span class="company-name">${beneficiaryName}</span><br>
          ${beneficiaryRegVatLine}
          ${beneficiaryAddress ? beneficiaryAddress + "<br>" : ""}
        </div>
      </div>
      <div class="section">
        <div class="section-title">${t.payer}</div>
        <div class="section-content">
          <span class="company-name">${invoice.payer_name || "-"}</span><br>
          ${invoice.payer_reg_nr ? `${t.regNr}: ${invoice.payer_reg_nr}<br>` : ""}
          ${invoice.payer_vat_nr ? `${t.pvn}: ${invoice.payer_vat_nr}<br>` : ""}
          ${invoice.payer_address ? invoice.payer_address + "<br>" : ""}
        </div>
      </div>
    </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>${t.dates}</th>
        <th>${t.service}</th>
        <th>${t.client}</th>
        <th style="text-align: right;">${t.amount}</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.invoice_items?.map((item: any) => {
        const serviceText = item.service_name?.trim() || "-";
        const serviceCell = `${t.service}: ${serviceText}`;
        return `
        <tr>
          <td>${(item.service_dates_text && String(item.service_dates_text).trim()) ? String(item.service_dates_text).trim() : formatDatesCell(item.service_date_from, item.service_date_to)}</td>
          <td style="word-wrap: break-word; white-space: normal;">${serviceCell}</td>
          <td>${item.service_client || "-"}</td>
          <td class="amount">${formatCurrency(item.line_total)}</td>
        </tr>
      `;
      }).join("") || `<tr><td colspan="4">${t.noItems}</td></tr>`}
    </tbody>
    ${!isLatviaCompany ? `
    <tfoot class="totals-foot">
      <tr>
        <td colspan="3"></td>
        <td>${t.subtotal}: ${formatCurrency(invoice.subtotal || 0)}</td>
      </tr>
      <tr>
        <td colspan="3"></td>
        <td>${t.vat} (${invoice.tax_rate || 0}%): ${formatCurrency(invoice.tax_amount || 0)}</td>
      </tr>
      <tr class="total-final">
        <td colspan="3"></td>
        <td>${t.total}: ${formatCurrency(invoice.total || 0)}</td>
      </tr>
    </tfoot>
    ` : ""}
  </table>
  ${isLatviaCompany ? `
  <table class="totals-table" style="margin-top: 12px;">
    ${(() => {
      const subtotal = invoice.subtotal ?? 0;
      const taxRate = invoice.tax_rate ?? 0;
      const taxAmount = invoice.tax_amount ?? 0;
      const total = invoice.total ?? 0;
      const nonTaxable = 0;
      const taxable0 = taxRate === 0 ? subtotal : 0;
      const taxable21 = taxRate === 21 ? subtotal : 0;
      const vat21Amount = taxRate === 21 ? taxAmount : 0;
      const curr = "EUR";
      return `
    <tr><td>${t.summa}</td><td class="num">${formatCurrencyWithCode(subtotal, curr)}</td></tr>
    <tr><td>${t.nonTaxableAmount}</td><td class="num">${formatCurrencyWithCode(nonTaxable, curr)}</td></tr>
    <tr><td>${t.taxable0}</td><td class="num">${formatCurrencyWithCode(taxable0, curr)}</td></tr>
    <tr><td>${t.taxable21}</td><td class="num">${formatCurrencyWithCode(taxable21, curr)}</td></tr>
    <tr><td>${t.vat21}</td><td class="num">${formatCurrencyWithCode(vat21Amount, curr)}</td></tr>
    <tr class="total-row"><td>${t.summaApmaksai}</td><td class="num">${formatCurrencyWithCode(total, curr)}</td></tr>
    <tr><td colspan="2" style="font-style: italic; border: none; padding-top: 4px;">${t.summaVardiem}: ${numberToWords(total, lang)}</td></tr>
    <tr><td colspan="2" style="font-size: 11px; color: #666; border: none; padding-top: 8px;">${t.legalNote0}</td></tr>
    <tr><td colspan="2" style="font-size: 11px; color: #666; border: none;">${t.legalNote21}</td></tr>
      `;
    })()}
  </table>
  ` : ""}

  ${(invoice.deposit_amount || invoice.final_payment_amount) ? `
    <div class="payment-terms">
      <strong>${t.paymentTerms}</strong><br>
      ${invoice.deposit_amount && invoice.deposit_date ? `${t.deposit}: ${formatCurrency(invoice.deposit_amount)} ${t.by || "by"} ${formatDate(invoice.deposit_date)}<br>` : ""}
      ${invoice.final_payment_amount && invoice.final_payment_date ? `${t.finalPayment}: ${formatCurrency(invoice.final_payment_amount)} ${t.by || "by"} ${formatDate(invoice.final_payment_date)}<br>` : ""}
      ${bankAccounts.length > 0 ? `
        <table class="bank-table">
          <tr><th colspan="4">${t.bankingDetails}</th></tr>
          <tr><td colspan="4"><strong>${t.beneficiaryName}:</strong> ${beneficiaryName}</td></tr>
          <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
          ${bankAccounts.map((acc: { account_name?: string; bank_name?: string; iban?: string; swift?: string; currency?: string }) => {
            const curr = (acc.currency === "MULTI" || acc.currency === "Multi-currency") ? "Multi" : (acc.currency === "EUR" || !acc.currency ? "€" : (acc.currency || ""));
            return `<tr><td>${acc.bank_name || ""}</td><td style="word-break: break-all;">${acc.iban || ""}</td><td>${acc.swift ? acc.swift : ""}</td><td>${curr}</td></tr>`;
          }).join("")}
        </table>
      ` : ""}
    </div>
  ` : (invoice.due_date ? `
    <div class="payment-terms">
      <strong>${t.dueDate}</strong><br>
      ${formatDate(invoice.due_date)}
      ${bankAccounts.length > 0 ? `
        <table class="bank-table">
          <tr><th colspan="4">${t.bankingDetails}</th></tr>
          <tr><td colspan="4"><strong>${t.beneficiaryName}:</strong> ${beneficiaryName}</td></tr>
          <tr><th>${t.bank}</th><th>${t.account}</th><th>SWIFT</th><th></th></tr>
          ${bankAccounts.map((acc: { account_name?: string; bank_name?: string; iban?: string; swift?: string; currency?: string }) => {
            const curr = (acc.currency === "MULTI" || acc.currency === "Multi-currency") ? "Multi" : (acc.currency === "EUR" || !acc.currency ? "€" : (acc.currency || ""));
            return `<tr><td>${acc.bank_name || ""}</td><td style="word-break: break-all;">${acc.iban || ""}</td><td>${acc.swift ? acc.swift : ""}</td><td>${curr}</td></tr>`;
          }).join("")}
        </table>
      ` : ""}
    </div>
  ` : "")}

  <p style="margin-top: 20px; font-size: 11px; color: #666; font-style: italic;">${t.electronicDisclaimer || "This invoice was prepared electronically and is valid without signature and stamp."}</p>

  <div class="thank-you">
    ${t.thankYou}
  </div>
  </div>
</body>
</html>
  `;
}

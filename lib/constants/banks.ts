/**
 * Banks for Bank details (Latvia, Lithuania, Estonia, Wise, Revolut, Paysera)
 */
export const BANK_LIST = [
  // Latvia
  "Citadele",
  "Luminor",
  "Rietumu Banka",
  "SEB",
  "Swedbank",
  // Lithuania
  "Šiaulių bankas",
  "UAB Travel Union",
  // Estonia
  "LHV",
  // Digital / Neo
  "Paysera",
  "Revolut",
  "Wise",
  // Other
  "Other",
] as const;

export type BankOption = (typeof BANK_LIST)[number];

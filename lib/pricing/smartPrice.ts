import type { ProviderName, NormalizedRate } from "@/lib/providers/types";

export interface PriceSource {
  provider: ProviderName;
  price: number;
  currency: string;
  isAvailable: boolean;
  isSupplier: boolean;
  roomType?: string;
  mealPlan?: string;
  rateId?: string;
}

export interface SmartPriceResult {
  recommendedPrice: number;
  bestSupplierPrice: number;
  bestSupplierProvider: ProviderName;
  lowestCompetitorPrice: number | null;
  margin: number;
  marginPercent: number;
  priceAdvice: "optimal" | "above_market" | "at_cost";
  allPrices: PriceSource[];
  currency: string;
}

const SUPPLIER_PROVIDERS: ProviderName[] = ["ratehawk", "goglobal"];

export function calculateSmartPrice(
  prices: PriceSource[],
  markupPercent = 0
): SmartPriceResult {
  const supplierPrices = prices.filter(
    (p) => p.isSupplier && p.isAvailable && p.price > 0
  );
  const competitorPrices = prices.filter(
    (p) => !p.isSupplier && p.isAvailable && p.price > 0
  );

  if (supplierPrices.length === 0) {
    const fallback = prices.find((p) => p.isAvailable && p.price > 0);
    return {
      recommendedPrice: fallback?.price ?? 0,
      bestSupplierPrice: 0,
      bestSupplierProvider: fallback?.provider ?? "ratehawk",
      lowestCompetitorPrice: null,
      margin: 0,
      marginPercent: 0,
      priceAdvice: "at_cost",
      allPrices: prices,
      currency: fallback?.currency ?? "EUR",
    };
  }

  const bestSupplier = supplierPrices.reduce((min, p) =>
    p.price < min.price ? p : min
  );

  const lowestCompetitor =
    competitorPrices.length > 0
      ? competitorPrices.reduce((min, p) => (p.price < min.price ? p : min))
      : null;

  let recommendedPrice: number;
  let priceAdvice: "optimal" | "above_market" | "at_cost";

  const costWithMarkup =
    bestSupplier.price * (1 + Math.max(0, markupPercent) / 100);

  if (!lowestCompetitor) {
    recommendedPrice = costWithMarkup;
    priceAdvice = "optimal";
  } else if (costWithMarkup >= lowestCompetitor.price) {
    recommendedPrice = costWithMarkup;
    priceAdvice = "above_market";
  } else {
    recommendedPrice = Math.min(lowestCompetitor.price, costWithMarkup);
    priceAdvice = "optimal";
  }

  if (lowestCompetitor && recommendedPrice > lowestCompetitor.price) {
    recommendedPrice = lowestCompetitor.price;
    priceAdvice =
      recommendedPrice <= bestSupplier.price ? "at_cost" : "optimal";
  }

  recommendedPrice = Math.max(recommendedPrice, bestSupplier.price);

  const margin = recommendedPrice - bestSupplier.price;
  const marginPercent =
    bestSupplier.price > 0
      ? Math.round((margin / bestSupplier.price) * 10000) / 100
      : 0;

  return {
    recommendedPrice: Math.round(recommendedPrice * 100) / 100,
    bestSupplierPrice: bestSupplier.price,
    bestSupplierProvider: bestSupplier.provider,
    lowestCompetitorPrice: lowestCompetitor?.price ?? null,
    margin: Math.round(margin * 100) / 100,
    marginPercent,
    priceAdvice,
    allPrices: prices,
    currency: bestSupplier.currency,
  };
}

export function buildPriceSources(
  rates: NormalizedRate[],
  markupPercent = 0
): { sources: PriceSource[]; smartPrice: SmartPriceResult } {
  const sources: PriceSource[] = rates.map((rate) => ({
    provider: rate.provider,
    price: rate.totalPrice,
    currency: rate.currency,
    isAvailable: true,
    isSupplier: SUPPLIER_PROVIDERS.includes(rate.provider),
    roomType: rate.roomName,
    mealPlan: rate.mealPlan,
    rateId: rate.rateId,
  }));

  const smartPrice = calculateSmartPrice(sources, markupPercent);
  return { sources, smartPrice };
}

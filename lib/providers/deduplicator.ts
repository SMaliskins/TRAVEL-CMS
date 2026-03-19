import type { NormalizedHotel, AggregatedHotel, ProviderName, NormalizedRate } from './types';

const GEO_THRESHOLD = 0.001; // ~100 meters
const NAME_SIMILARITY_THRESHOLD = 0.75;

function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bhotel\b/gi, '')
    .replace(/\bresort\b/gi, '')
    .replace(/\b&\b/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeHotelName(a);
  const nb = normalizeHotelName(b);

  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

function geoClose(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): boolean {
  if (!lat1 || !lng1 || !lat2 || !lng2) return false;
  return (
    Math.abs(lat1 - lat2) < GEO_THRESHOLD &&
    Math.abs(lng1 - lng2) < GEO_THRESHOLD
  );
}

function isSameHotel(a: NormalizedHotel, b: NormalizedHotel): boolean {
  const closeGeo = geoClose(a.latitude, a.longitude, b.latitude, b.longitude);
  const similarName = nameSimilarity(a.name, b.name) >= NAME_SIMILARITY_THRESHOLD;

  return closeGeo && similarName;
}

function mergeImages(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing);
  for (const img of incoming) set.add(img);
  return Array.from(set);
}

function mergeAmenities(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing.map((a) => a.toLowerCase()));
  const result = [...existing];
  for (const amenity of incoming) {
    if (!set.has(amenity.toLowerCase())) {
      set.add(amenity.toLowerCase());
      result.push(amenity);
    }
  }
  return result;
}

function buildCompositeId(hotel: NormalizedHotel): string {
  const normalized = normalizeHotelName(hotel.name);
  const slug = normalized.replace(/\s+/g, '-').slice(0, 40);
  const lat = hotel.latitude.toFixed(4);
  const lng = hotel.longitude.toFixed(4);
  return `${slug}_${lat}_${lng}`;
}

function findBestPrice(rates: NormalizedRate[]): { price: number; provider: ProviderName } {
  let best = rates[0];
  for (let i = 1; i < rates.length; i++) {
    if (rates[i].totalPrice < best.totalPrice) {
      best = rates[i];
    }
  }
  return { price: best.totalPrice, provider: best.provider };
}

function hotelToAggregated(hotel: NormalizedHotel): AggregatedHotel {
  const { price, provider } = findBestPrice(hotel.rates);
  return {
    id: buildCompositeId(hotel),
    name: hotel.name,
    address: hotel.address,
    city: hotel.city,
    country: hotel.country,
    countryCode: hotel.countryCode,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    starRating: hotel.starRating,
    reviewScore: hotel.reviewScore,
    reviewCount: hotel.reviewCount,
    images: [...hotel.images],
    amenities: [...hotel.amenities],
    providers: [hotel.provider],
    rates: [...hotel.rates],
    bestPrice: price,
    bestPriceProvider: provider,
    currency: hotel.rates[0]?.currency ?? 'EUR',
  };
}

function mergeIntoAggregated(
  target: AggregatedHotel,
  source: NormalizedHotel
): void {
  if (!target.providers.includes(source.provider)) {
    target.providers.push(source.provider);
  }

  target.rates.push(...source.rates);
  target.images = mergeImages(target.images, source.images);
  target.amenities = mergeAmenities(target.amenities, source.amenities);

  if (source.reviewScore !== null && target.reviewScore === null) {
    target.reviewScore = source.reviewScore;
    target.reviewCount = source.reviewCount;
  }

  if (source.starRating > target.starRating) {
    target.starRating = source.starRating;
  }

  const { price, provider } = findBestPrice(target.rates);
  target.bestPrice = price;
  target.bestPriceProvider = provider;
}

export function deduplicateHotels(hotels: NormalizedHotel[]): AggregatedHotel[] {
  const aggregated: AggregatedHotel[] = [];
  const matched = new Set<number>();

  for (let i = 0; i < hotels.length; i++) {
    if (matched.has(i)) continue;

    const base = hotelToAggregated(hotels[i]);

    for (let j = i + 1; j < hotels.length; j++) {
      if (matched.has(j)) continue;

      if (isSameHotel(hotels[i], hotels[j])) {
        mergeIntoAggregated(base, hotels[j]);
        matched.add(j);
      }
    }

    aggregated.push(base);
  }

  return aggregated;
}

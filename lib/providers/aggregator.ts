import type { HotelProvider, HotelSearchParams, AggregatedHotel, NormalizedHotel } from './types';
import { deduplicateHotels } from './deduplicator';

interface SearchError {
  provider: string;
  error: string;
}

interface AggregatedSearchResult {
  hotels: AggregatedHotel[];
  errors: SearchError[];
  timing: {
    totalMs: number;
    perProvider: Record<string, number>;
  };
}

export async function searchAll(
  providers: HotelProvider[],
  params: HotelSearchParams
): Promise<AggregatedSearchResult> {
  const start = Date.now();
  const perProvider: Record<string, number> = {};

  const tasks = providers.map(async (provider) => {
    const t0 = Date.now();
    const results = await provider.search(params);
    perProvider[provider.name] = Date.now() - t0;
    return results;
  });

  const settled = await Promise.allSettled(tasks);

  const allHotels: NormalizedHotel[] = [];
  const errors: SearchError[] = [];

  settled.forEach((result, idx) => {
    const providerName = providers[idx].name;
    if (result.status === 'fulfilled') {
      allHotels.push(...result.value);
    } else {
      errors.push({
        provider: providerName,
        error: result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      });
    }
  });

  const deduplicated = deduplicateHotels(allHotels);
  deduplicated.sort((a, b) => a.bestPrice - b.bestPrice);

  if (params.maxResults && deduplicated.length > params.maxResults) {
    deduplicated.length = params.maxResults;
  }

  return {
    hotels: deduplicated,
    errors,
    timing: {
      totalMs: Date.now() - start,
      perProvider,
    },
  };
}

type RateLimitEntry = {
  timestamps: number[];
};

type Store = Map<string, RateLimitEntry>;

type GlobalWithRateLimit = typeof globalThis & {
  __travelCmsRateLimitStore?: Store;
};

function getStore(): Store {
  const g = globalThis as GlobalWithRateLimit;
  if (!g.__travelCmsRateLimitStore) {
    g.__travelCmsRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return g.__travelCmsRateLimitStore;
}

export function consumeRateLimit(params: {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const { bucket, key, limit, windowMs } = params;
  const store = getStore();
  const now = Date.now();
  const bucketKey = `${bucket}:${key}`;
  const windowStart = now - windowMs;

  const entry = store.get(bucketKey) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= limit) {
    const earliest = entry.timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, earliest + windowMs - now);
    store.set(bucketKey, entry);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);
  store.set(bucketKey, entry);

  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.timestamps.length),
    retryAfterSec: 0,
  };
}

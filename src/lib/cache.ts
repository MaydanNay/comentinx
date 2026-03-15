type CacheEntry<T> = {
  data: T;
  expiry: number;
};

const cache = new Map<string, CacheEntry<any>>();

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setToCache<T>(key: string, data: T, ttlSeconds: number) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

// Global cleanup interval to prevent memory leaks
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of cache.entries()) {
            if (now > entry.expiry) cache.delete(key);
        }
    }, 60000);
}

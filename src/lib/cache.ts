type CacheEntry = {expiresAt: number, value: unknown};
const Cache: Record<string, CacheEntry> = {};

export function cachedSyncFetch<T>(key: string, ttlMs: number, fetchCallback: () => T): T {
    if (typeof Cache[key]?.expiresAt === 'number' && Cache[key].expiresAt > Date.now()) {
        return Cache[key].value as T;
    }

    Cache[key] = {
        expiresAt: Date.now() + ttlMs,
        value: fetchCallback()
    };

    return Cache[key].value as T;
}

export async function cachedAsyncFetch<T>(key: string, ttlMs: number, fetchCallback: () => Promise<T>): Promise<T> {
    if (typeof Cache[key]?.expiresAt === 'number' && Cache[key].expiresAt > Date.now()) {
        return Cache[key].value as T;
    }

    Cache[key] = {
        expiresAt: Date.now() + ttlMs,
        value: await fetchCallback()
    };

    return Cache[key].value as T;
}

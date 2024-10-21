import { Mutex } from "async-mutex";
import { defaultCacheTtl } from "~/scripts/lib/database";
import { getMonolitoBase } from "./monolito";
import { getDbInstance } from "~/scripts/lib/instance";

type CacheEntry = {
  expiresAt: number;
  fetchMutex: Mutex;
  value: unknown;
};

type GlobalCache = {
  cache: Record<string, CacheEntry | null>;
};

export async function cachedAsyncFetch<T>(key: string, ttlMs: number, fetchCallback: () => Promise<T>, forceCache = false): Promise<T> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("cachedAsyncFetch called from NEXT_RUNTIME", process.env.NEXT_RUNTIME);
  }

  if (!(global as unknown as GlobalCache).cache) {
    console.error("cachedAsyncFetch: recreating cache");
    (global as unknown as GlobalCache).cache = {} as Record<string, CacheEntry>;
  }

  const Cache = (global as unknown as GlobalCache).cache;

  if (
    typeof Cache[key]?.expiresAt === "number" &&
    Cache[key].expiresAt > Date.now() &&
    Date.now() - Cache[key].expiresAt <= ttlMs &&
    !forceCache
  ) {
    console.log("cachedAsyncFetch: Cache hit at key", key);
    return Cache[key].value as T;
  } else if (typeof Cache[key]?.expiresAt === "number") {
    console.log("cachedAsyncFetch: Cache miss or forced at key", key);
    await Cache[key].fetchMutex.runExclusive(async () => {
      if (Cache[key]) {
        Cache[key].value = await fetchCallback();
        Cache[key].expiresAt = Date.now() + ttlMs;
      }
    });
  } else {
    console.log("cachedAsyncFetch: Cache missing key", key);
    Cache[key] = {
      expiresAt: Date.now() + ttlMs,
      value: await fetchCallback(),
      fetchMutex: new Mutex(),
    };
  }

  return Cache[key].value as T;
}

async function cacheTaskKey<T>(key: string, Cache: GlobalCache["cache"], callback: () => Promise<T>) {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("cacheTaskKey called from NEXT_RUNTIME", process.env.NEXT_RUNTIME);
  }

  const start = Date.now();
  if (Cache[key] === undefined) {
    Cache[key] = {
      expiresAt: Date.now() + defaultCacheTtl,
      value: await callback(),
      fetchMutex: new Mutex(),
    };

    console.log(`cacheTask: first loaded ${key} in ${Date.now() - start}ms`, process.env.NEXT_RUNTIME);
  } else if (typeof Cache[key]?.expiresAt === "number" && Date.now() >= Cache[key].expiresAt) {
    await Cache[key].fetchMutex.runExclusive(async () => {
      if (Cache[key]) {
        Cache[key].value = await callback();
        Cache[key].expiresAt = Date.now() + defaultCacheTtl;
      }
    });

    console.log(`cacheTask: reloaded ${key} in ${Date.now() - start}ms`);
  }
}

export function cacheInvalidate(userId: string) {
  const Cache = (global as unknown as GlobalCache).cache;
  if (!Cache) {
    return;
  }

  for (const key of Object.keys(Cache)) {
    if (key.endsWith(userId)) {
      Cache[key] = null;
    }
  }
}

export async function cacheTask() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("cacheTask called from NEXT_RUNTIME", process.env.NEXT_RUNTIME);
  }

  if (!(global as unknown as GlobalCache).cache) {
    (global as unknown as GlobalCache).cache = {} as Record<string, CacheEntry>;
  }

  const Cache = (global as unknown as GlobalCache).cache;
  for (const key of Object.keys(Cache)) {
    if (key.startsWith("monolito-base-")) {
      const id = key.replace("monolito-base-", "");
      await cacheTaskKey(key, Cache, async () => await getMonolitoBase(id));
    }
  }

  // await cacheTaskKey(, Cache, async () => await getMonolitoBase());
  void (await (await getDbInstance()).readAllData(undefined, true));
}

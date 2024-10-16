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
  cache: Record<string, CacheEntry>;
};

export async function cachedAsyncFetch<T>(key: string, ttlMs: number, fetchCallback: () => Promise<T>): Promise<T> {
  if (!(global as unknown as GlobalCache).cache) {
    (global as unknown as GlobalCache).cache = {} as Record<string, CacheEntry>;
  }

  const Cache = (global as unknown as GlobalCache).cache;

  if (typeof Cache[key]?.expiresAt === "number" && Cache[key].expiresAt > Date.now()) {
    return Cache[key].value as T;
  } else if (typeof Cache[key]?.expiresAt === "number") {
    await Cache[key].fetchMutex.runExclusive(async () => {
      if (Cache[key] !== undefined) {
        Cache[key].value = await fetchCallback();
      }
    });
  } else {
    Cache[key] = {
      expiresAt: Date.now() + ttlMs,
      value: await fetchCallback(),
      fetchMutex: new Mutex(),
    };
  }

  return Cache[key].value as T;
}

async function cacheTaskKey<T>(key: string, Cache: GlobalCache["cache"], callback: () => Promise<T>) {
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
      if (Cache[key] !== undefined) {
        Cache[key].value = await callback();
      }
    });

    console.log(`cacheTask: reloaded ${key} in ${Date.now() - start}ms`);
  }
}

export async function cacheTask() {
  if (!(global as unknown as GlobalCache).cache) {
    (global as unknown as GlobalCache).cache = {} as Record<string, CacheEntry>;
  }

  const Cache = (global as unknown as GlobalCache).cache;
  await cacheTaskKey("monolito-base", Cache, async () => await getMonolitoBase());
  void (await (await getDbInstance()).readAllData());
}

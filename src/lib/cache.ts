import { Mutex } from "async-mutex";
import { defaultCacheTtl } from "~/scripts/lib/database";
import type { getMonolitoByForecastId } from "./monolito";
import { getDbInstance } from "~/scripts/lib/instance";
import { db } from "~/server/db";
import { Worker } from "node:worker_threads";
import type { ForecastProfile } from "~/mrp_data/transform_mrp_data";
import { nullProfile } from "./nullForecastProfile";
import { queryBaseMRPData } from "~/serverfunctions";

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
  if (!Cache[key]) {
    Cache[key] = {
      expiresAt: Date.now() + defaultCacheTtl,
      value: await callback(),
      fetchMutex: new Mutex(),
    };

    console.log(`cacheTask: first loaded ${key} in ${Date.now() - start}ms`, process.env.NEXT_RUNTIME);
  } else {
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

function runService<T>(workerData: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./src/worker.js", { workerData });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

async function workerGetMonolitoByForecastId(forecastProfileId: number | null) {
  const forecastProfiles = await db.query.forecastProfiles.findMany();

  let forecastProfile: ForecastProfile | null =
    forecastProfileId != null ? (forecastProfiles.find((v) => v.id === forecastProfileId) ?? null) : null;

  if (!forecastProfile) {
    forecastProfile = nullProfile;
  }

  const args = {
    data: await queryBaseMRPData(defaultCacheTtl),
    forecastProfile,
    forecastProfiles,
  };

  console.log("");
  return runService<ReturnType<typeof getMonolitoByForecastId>>(args);
}

export async function cacheTask() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("cacheTask called from NEXT_RUNTIME", process.env.NEXT_RUNTIME);
  }

  if (!(global as unknown as GlobalCache).cache) {
    (global as unknown as GlobalCache).cache = {} as Record<string, CacheEntry>;
  }

  const Cache = (global as unknown as GlobalCache).cache;

  void (await (await getDbInstance()).readAllData(undefined, true));

  /* for (const key of Object.keys(Cache)) {
    if (key.startsWith("monolito-base-")) {
      const id = key.replace("monolito-base-", "");
      await cacheTaskKey(key, Cache, async () => await getMonolitoBase(id));
    }
  } */

  const allForecastProfiles = await db.query.forecastProfiles.findMany();
  for (const fProfile of allForecastProfiles) {
    await cacheTaskKey(`monolito-fc-${fProfile.id}`, Cache, async () => await workerGetMonolitoByForecastId(fProfile.id));
  }

  await cacheTaskKey(`monolito-fc-null`, Cache, async () => await workerGetMonolitoByForecastId(null));

  // await cacheTaskKey(, Cache, async () => await getMonolitoBase());
  console.log("cacheTask finished execution");
}

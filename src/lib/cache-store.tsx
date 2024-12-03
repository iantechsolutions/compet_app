import { parse, stringify } from "flatted";

async function getCache() {
  return caches.open("data");
}

export async function saveToCache<T>(key: string, value: T) {
  const cache = await getCache();

  const response = new Response(stringify(value), {});

  return cache.put("/" + key, response);
}

export async function readFromCache<T>(key: string): Promise<T | null> {
  try {
    const cache = await getCache();

    const response = await cache.match("/" + key);

    if (!response) {
      return null;
    }

    const text = await response.text();

    return parse(text) as T;
  }
  catch (e) {
    console.log("aca");
    console.log(e);
  }

  return null;
}

export async function deleteFromCache(key: string) {
  const cache = await getCache();

  return cache.delete("/" + key);
}

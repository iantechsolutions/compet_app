import { getDbInstance } from "../scripts/lib/instance";
import type { Product } from "./types";
import { queryBaseMRPData } from "../serverfunctions";
import { type ForecastProfile } from "../mrp_data/transform_mrp_data";
import { getUserSetting } from "./settings";
import { db } from "../server/db";
import { nullProfile } from "./nullForecastProfile";
import { getMonolitoByForecast } from "./monolito-calc";

// la diferencia de los list* con los definidos previamente
// es el tipo de retorno (records en vez de maps, listas en vez de sets, etc)

export const getProductByCode = async () => {
  const products = await (await getDbInstance()).getProducts();
  const productByCode = new Map<string, Product>();
  for (const product of products) {
    productByCode.set(product.code, product);
  }

  return { products, productByCode };
};

export const getMonolitoBase = async (userId: string, cacheTtl?: number) => {
  const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", userId);
  return getMonolitoByForecastId(forecastProfileId, cacheTtl);
};

export const getMonolitoByForecastId = async (forecastProfileId: number | null, cacheTtl?: number) => {
  const forecastProfiles = await db.query.forecastProfiles.findMany();

  let forecastProfile: ForecastProfile | null =
    forecastProfileId != null ? (forecastProfiles.find((v) => v.id === forecastProfileId) ?? null) : null;

  if (!forecastProfile) {
    forecastProfile = nullProfile;
  }

  return getMonolitoByForecast({
    forecastProfile,
    forecastProfiles,
    data: await queryBaseMRPData(cacheTtl),
  });
};

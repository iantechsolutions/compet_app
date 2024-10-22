/* eslint-disable */

import { CrmBudget, CrmBudgetProduct, OrderProductSold, type OrderSold } from "../lib/types";
import { queryBaseMRPData } from "./query_mrp_data";
import type { ForecastProfile } from "./transform_mrp_data";
import { queryForecastDataSync } from "~/lib/monolito-calc";

export type ForecastDataEvent<Date> = {
  type: "sold" | "budget"; // | 'import'
  product_code: string;
  date: Date;
  quantity: number;
  originalQuantity?: number;
};

export async function queryForecastData(
  forecastProfile: ForecastProfile,
  mrpRawData: {
    budget_products: CrmBudgetProduct[];
    products_sold: OrderProductSold[];
    sold: OrderSold[];
    months: string[];
    budgetsById: Map<number, CrmBudget>;
  },
): Promise<ReturnType<typeof queryForecastDataSync>> {
  return queryForecastDataSync(forecastProfile, mrpRawData ?? (await queryBaseMRPData()));
}

export type ForecastData = Awaited<ReturnType<typeof queryForecastData>>;

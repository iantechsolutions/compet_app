/* eslint-disable */

import dayjs from "dayjs";
import { sql } from "drizzle-orm";
import { OrderProductSold, type OrderSold } from "~/lib/types";
import { monthCodeFromDate, monthCodeToDate } from "~/lib/utils";
import { db } from "~/server/db";
import { type RawMRPData, queryBaseMRPData } from "./query_mrp_data";
import type { ForecastProfile } from "./transform_mrp_data";

type ForecastDataEvent = {
  type: "sold" | "budget"; // | 'import'
  product_code: string;
  date: Date;
  quantity: number;
  originalQuantity?: number;
};

export async function queryForecastData(forecastProfile: ForecastProfile, mrpRawData?: RawMRPData) {
  const data = mrpRawData ?? (await queryBaseMRPData());

  const budgetProducts = data.budget_products;
  const clientInclusionSet = forecastProfile.clientInclusionList ? new Set(forecastProfile.clientInclusionList) : null;

  const events: ForecastDataEvent[] = [
    // {
    //     product_code: '01014040 CON AD',
    //     date: new Date(2023, 11, 1),
    //     quantity: 1500,
    // },
    // {
    //     product_code: '03103EPE201593',
    //     date: new Date(2023, 11, 2),
    //     quantity: 880,
    // }
  ];

  /**
   * SOLD AREA
   */

  const soldProductsBase = data.products_sold;
  const ordersSold = data.sold;

  const ordersSoldByN_COMP: Map<string, OrderSold> = new Map();
  for (const orderSold of ordersSold) {
    ordersSoldByN_COMP.set(orderSold.N_COMP, orderSold);
  }

  const soldProducts = soldProductsBase
    .map((soldProduct) => {
      const order = ordersSoldByN_COMP.get(soldProduct.N_COMP)!;
      return {
        ...soldProduct,
        order,
      };
    })
    .filter((soldProduct) => {
      if (clientInclusionSet && !clientInclusionSet.has(soldProduct.order.client_code.toString())) return false;
      return true;
    });

  const productsSoldMonthlyByCode = new Map<string, Map<string, number>>();

  for (const soldProduct of soldProducts) {
    const date = dayjs(soldProduct.order.emission_date).startOf("month").toDate();
    const date_key = monthCodeFromDate(date);

    const code = soldProduct.product_code;
    const quantity = soldProduct.CANTIDAD;

    if (!productsSoldMonthlyByCode.has(code)) {
      productsSoldMonthlyByCode.set(code, new Map());
    }

    const productSoldMonthly = productsSoldMonthlyByCode.get(code)!;

    if (!productSoldMonthly.has(date_key)) {
      productSoldMonthly.set(date_key, 0);
    }

    const currentQuantity = productSoldMonthly.get(date_key)!;

    productSoldMonthly.set(date_key, currentQuantity + quantity);
  }

  const last6MonthsCodes = [
    monthCodeFromDate(dayjs().subtract(5, "month").toDate()),
    monthCodeFromDate(dayjs().subtract(4, "month").toDate()),
    monthCodeFromDate(dayjs().subtract(3, "month").toDate()),
    monthCodeFromDate(dayjs().subtract(2, "month").toDate()),
    monthCodeFromDate(dayjs().subtract(1, "month").toDate()),
    monthCodeFromDate(dayjs().toDate()),
  ];

  // key: product_code, value: average sold quantity in the last 6 months
  const productSoldAverageMonthlyByCode = new Map<string, number>();

  for (const [code, soldMonthly] of productsSoldMonthlyByCode.entries()) {
    let total = 0;

    for (const code of last6MonthsCodes) {
      total += soldMonthly.get(code) ?? 0;
    }

    productSoldAverageMonthlyByCode.set(code, total / 6);
  }

  if (forecastProfile.includeSales) {
    // for next 9 months (starting the next month)
    for (let i = 1; i < 10; i++) {
      const date = dayjs().startOf("month").add(6, "hours").add(i, "month").toDate();

      for (const product_code of productSoldAverageMonthlyByCode.keys()) {
        const quantity = productSoldAverageMonthlyByCode.get(product_code)!;

        // ForecastDataEvent (not same as ProductEvent)
        events.push({
          type: "sold",
          product_code,
          date,
          quantity: quantity * (1 + i * forecastProfile.salesIncrementFactor),
        });
      }
    }
  }

  /** END BUDGETS AREA */

  /**
   * BUDGETS AREA
   */

  // const budgets = data.budgets

  if (forecastProfile.includeBudgets) {
    const productsBudgetForecastByMonth = new Map<string, Map<string, number>>();

    data.months.forEach((month) => {
      productsBudgetForecastByMonth.set(month, new Map());
    });

    for (const budgetProduct of budgetProducts) {
      const budget = data.budgetsById.get(budgetProduct.budget_id);
      if (!budget) continue;

      if (clientInclusionSet && !clientInclusionSet.has(budget.client_id.toString())) continue;

      // if (budget.finished_date) continue
      // if (budget.validity_date && new Date(budget.validity_date) < new Date()) continue

      // TODO: Preguntar por que fecha utilizar según el presupuesto

      if (!budget.date) continue;
      if (new Date(budget.date) < new Date()) continue;

      // events.push({
      //     type: 'budget',
      //     date: new Date(budget.date),
      //     product_code: budgetProduct.product_code,
      //     quantity: budgetProduct.quantity * forecastProfile.budgetsInclusionFactor,
      //     // originalQuantity: budgetProduct.quantity,
      // })

      const month = monthCodeFromDate(new Date(budget.date));

      const monthMap = productsBudgetForecastByMonth.get(month);
      if (!monthMap) continue;

      const currentQuantity = monthMap.get(budgetProduct.product_code) ?? 0;

      monthMap.set(budgetProduct.product_code, currentQuantity + budgetProduct.quantity * forecastProfile.budgetsInclusionFactor);
    }

    for (const [month, monthMap] of productsBudgetForecastByMonth.entries()) {
      for (const [product_code, quantity] of monthMap.entries()) {
        events.push({
          type: "budget",
          date: dayjs(monthCodeToDate(month)).add(6, "hours").toDate(),
          product_code,
          quantity,
        });
      }
    }
  }

  /** END BUDGETS AREA */

  return {
    // soldProducts,
    productsSoldMonthlyByCode,
    productSoldAverageMonthlyByCode,
    events,
    forecastProfile,
  };
}

export type ForecastData = Awaited<ReturnType<typeof queryForecastData>>;

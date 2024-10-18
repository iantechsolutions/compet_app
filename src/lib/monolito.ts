import { getDbInstance } from "~/scripts/lib/instance";
import type { Product } from "./types";
import { queryBaseMRPData } from "~/serverfunctions";
import {
  eventsOfProductByMonth,
  type ForecastProfile,
  listAllEventsWithSupplyEvents,
  listProductsEvents,
  type ProductEvent,
  stockOfProductByMonth,
} from "~/mrp_data/transform_mrp_data";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { getUserSetting } from "./settings";
import { db } from "~/server/db";
import { nullProfile } from "./nullForecastProfile";

export const getProductByCode = async () => {
  const products = await (await getDbInstance()).getProducts();
  const productByCode = new Map<string, Product>();
  for (const product of products) {
    productByCode.set(product.code, product);
  }

  return { products, productByCode };
};

export const getMonolitoBase = async (userId: string, cacheTtl?: number) => {
  const data = await queryBaseMRPData(cacheTtl);

  const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", userId);
  const forecastProfiles = await db.query.forecastProfiles.findMany();

  let forecastProfile: ForecastProfile | null =
    forecastProfileId != null ? (forecastProfiles.find((v) => v.id === forecastProfileId) ?? null) : null;

  if (!forecastProfile) {
    forecastProfile = nullProfile;
  }

  const productsByCode = new Map(data.products.map((product) => [product.code, product]));
  const providersByCode = new Map(data.providers.map((provider) => [provider.code, provider]));

  // Imports por su identificador
  const importsById = new Map(data.imports.map((imported) => [imported.id, imported]));

  // Importaciones de productos por su identificador y código de producto
  const productImportsById = new Map(data.productImports.map((productImport) => [productImport.id, productImport]));
  const productImportsByProductCode = new Map(data.productImports.map((productImport) => [productImport.product_code, productImport]));

  // Ordenes por su número de orden
  const ordersByOrderNumber = new Map(data.orders.map((order) => [order.order_number, order]));

  // Ordenes de productos por su número de orden y código de producto
  const orderProductsByOrderNumber = new Map<
    string,
    {
      id: number;
      order_number: string;
      product_code: string;
      ordered_quantity: number;
    }[]
  >();

  data.orderProducts.forEach((order) => {
    orderProductsByOrderNumber.set(order.order_number, [...(orderProductsByOrderNumber.get(order.order_number) ?? []), order]);
  });

  const orderProductsByProductCode = new Map<
    string,
    {
      id: number;
      order_number: string;
      product_code: string;
      ordered_quantity: number;
    }[]
  >();

  data.orderProducts.forEach((order) => {
    orderProductsByProductCode.set(order.product_code, [...(orderProductsByProductCode.get(order.product_code) ?? []), order]);
  });

  const orderProductsById = new Map(data.orderProducts.map((order) => [order.id, order]));
  const clientsByCode = new Map(data.clients.map((client) => [client.code, client]));
  const assemblyById = new Map(data.assemblies.map((assembly) => [assembly.id, assembly]));
  const forecastData = await queryForecastData(forecastProfile, data);

  const evolvedData = {
    ...data,
    forecastData,

    productsByCode,
    providersByCode,

    importsById,

    productImportsById,
    productImportsByProductCode,

    ordersByOrderNumber,

    orderProductsByOrderNumber,
    orderProductsByProductCode,
    orderProductsById,
    clientsByCode,
    assemblyById,
  };

  const events = listAllEventsWithSupplyEvents(evolvedData);
  const eventsByProductCode = listProductsEvents(evolvedData, events);
  const months = data.months;

  const stockOfProductsByMonth = new Map<string, Map<string, number>>();
  for (const product of evolvedData.products) {
    stockOfProductsByMonth.set(product.code, stockOfProductByMonth(product.stock, eventsByProductCode.get(product.code)!, months));
  }

  // product_id: { month_code: number }

  const eventsOfProductsByMonth = new Map<string, Map<string, ProductEvent[]>>();
  for (const product of evolvedData.products) {
    eventsOfProductsByMonth.set(product.code, eventsOfProductByMonth(eventsByProductCode.get(product.code)!, months));
  }

  const stockVariationByMonth = new Map<string, Map<string, number>>();
  const importedQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const orderedQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsSupplyQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastTypeSoldQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastTypeBudgetQuantityOfProductsByMonth = new Map<string, Map<string, number>>();

  for (const product of evolvedData.products) {
    const events = eventsOfProductsByMonth.get(product.code)!;

    for (const month of months) {
      stockVariationByMonth.set(product.code, stockVariationByMonth.get(product.code) ?? new Map<string, number>());
      importedQuantityOfProductsByMonth.set(product.code, importedQuantityOfProductsByMonth.get(product.code) ?? new Map<string, number>());
      orderedQuantityOfProductsByMonth.set(product.code, orderedQuantityOfProductsByMonth.get(product.code) ?? new Map<string, number>());
      usedAsSupplyQuantityOfProductsByMonth.set(
        product.code,
        usedAsSupplyQuantityOfProductsByMonth.get(product.code) ?? new Map<string, number>(),
      );
      usedAsForecastQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastQuantityOfProductsByMonth.get(product.code) ?? new Map<string, number>(),
      );
      usedAsForecastTypeSoldQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code) ?? new Map<string, number>(),
      );
      usedAsForecastTypeBudgetQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code) ?? new Map<string, number>(),
      );

      stockVariationByMonth.get(product.code)!.set(month, 0);
      importedQuantityOfProductsByMonth.get(product.code)!.set(month, 0);
      orderedQuantityOfProductsByMonth.get(product.code)!.set(month, 0);
      usedAsSupplyQuantityOfProductsByMonth.get(product.code)!.set(month, 0);
      usedAsForecastQuantityOfProductsByMonth.get(product.code)!.set(month, 0);
      usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code)!.set(month, 0);
      usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code)!.set(month, 0);

      for (const event of events.get(month) ?? []) {
        // Aunque solo el valor de quantity afecte a la variación de stock, queremos que los eventos musetren la cantidad original por más de que se hayan dividido en eventos de suministro
        const qty = event.originalQuantity ?? event.quantity;

        let stockModifier = 0;

        if (event.type === "import") {
          importedQuantityOfProductsByMonth
            .get(product.code)!
            .set(month, importedQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty);
          stockModifier = qty;
        } else if (event.type === "forecast" || event.isForecast) {
          usedAsForecastQuantityOfProductsByMonth
            .get(product.code)!
            .set(month, usedAsForecastQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty);

          if (event.forecastType === "sold") {
            usedAsForecastTypeSoldQuantityOfProductsByMonth
              .get(product.code)!
              .set(month, usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty);
          } else if (event.forecastType === "budget") {
            usedAsForecastTypeBudgetQuantityOfProductsByMonth
              .get(product.code)!
              .set(month, usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty);
          }

          stockModifier = -event.quantity;
        } else if (event.type === "order") {
          orderedQuantityOfProductsByMonth
            .get(product.code)!
            .set(month, orderedQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty);
          stockModifier = -event.quantity;
        } else if (event.type === "supply") {
          usedAsSupplyQuantityOfProductsByMonth
            .get(product.code)!
            .set(month, usedAsSupplyQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty);
          stockModifier = -event.quantity;
        }

        stockVariationByMonth.get(product.code)!.set(month, stockVariationByMonth.get(product.code)!.get(month)! + stockModifier);
      }
    }
  }

  const products = evolvedData.products.map((product) => {
    const expiredNotImportEvents = (eventsByProductCode.get(product.code) ?? []).filter(
      (event) => event.expired && event.type !== "import",
    );
    const expiredSum = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);

    return {
      ...product,
      commited: expiredSum,
      stock_at: stockOfProductsByMonth.get(product.code)!,
      imported_quantity_by_month: importedQuantityOfProductsByMonth.get(product.code)!,
      ordered_quantity_by_month: orderedQuantityOfProductsByMonth.get(product.code)!,
      stock_variation_by_month: stockVariationByMonth.get(product.code)!,
      used_as_supply_quantity_by_month: usedAsSupplyQuantityOfProductsByMonth.get(product.code)!,
      used_as_forecast_quantity_by_month: usedAsForecastQuantityOfProductsByMonth.get(product.code)!,
      used_as_forecast_type_sold_quantity_by_month: usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code)!,
      used_as_forecast_type_budget_quantity_by_month: usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code)!,
      events_by_month: eventsOfProductsByMonth.get(product.code),
      events: eventsByProductCode.get(product.code),
    };
  });

  const transformedData = {
    ...evolvedData,
    products,
    events,
    eventsByProductCode,
    stockOfProductsByMonth,
    eventsOfProductsByMonth,
    forecastProfiles: forecastProfiles.map((p) => ({
      ...p,
      current: p.id == forecastProfileId,
    })),
  };

  return transformedData;
};

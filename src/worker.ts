// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { parentPort, workerData } from "node:worker_threads";
import { getMonolitoByForecast } from "./lib/monolito-calc";

/* const nA = (k) => {
  if (k === undefined || k === null) {
    throw new Error("na Failed");
  } else {
    return k;
  }
}

const getMonolitoByForecast = (args) => {
  const { forecastProfile, forecastProfiles, data } = args;
  const productsByCode = Object.fromEntries(data.products.map((product) => [product.code, product]));
  const providersByCode = Object.fromEntries(data.providers.map((provider) => [provider.code, provider]));

  // Imports por su identificador
  const importsById = Object.fromEntries(data.imports.map((imported) => [imported.id, imported]));

  // Importaciones de productos por su identificador y código de producto
  const productImportsById = Object.fromEntries(data.productImports.map((productImport) => [productImport.id, productImport]));
  const productImportsByProductCode = Object.fromEntries(
    data.productImports.map((productImport) => [productImport.product_code, productImport]),
  );

  // Ordenes por su número de orden
  const ordersByOrderNumber = Object.fromEntries(
    data.orders.map((order) => [
      order.order_number,
      {
        ...order,
        approval_date: new Date(order.approval_date).getTime(),
        delivery_date: new Date(order.delivery_date).getTime(),
        entry_date: new Date(order.entry_date).getTime(),
        order_date: new Date(order.order_date).getTime(),
      },
    ]),
  );

  // Ordenes de productos por su número de orden y código de producto
  const orderProductsByOrderNumber = {};

  data.orderProducts.forEach((order) => {
    if (orderProductsByOrderNumber[order.order_number] !== undefined) {
      nA(orderProductsByOrderNumber[order.order_number]).push(order);
    } else {
      orderProductsByOrderNumber[order.order_number] = [order];
    }
  });

  const orderProductsByProductCode = {};

  data.orderProducts.forEach((order) => {
    if (orderProductsByProductCode[order.product_code] !== undefined) {
      nA(orderProductsByProductCode[order.product_code]).push(order);
    } else {
      orderProductsByProductCode[order.product_code] = [order];
    }
  });

  const orderProductsById = Object.fromEntries(data.orderProducts.map((order) => [order.id, order]));
  const clientsByCode = Object.fromEntries(data.clients.map((client) => [client.code, client]));
  const assemblyById = Object.fromEntries(data.assemblies.map((assembly) => [assembly.id, assembly]));
  const forecastData = queryForecastDataSync(forecastProfile, data);

  const evolvedData = {
    ...data,
    budgetsById: Object.fromEntries(data.budgetsById.entries()),
    forecastData: {
      events: forecastData.events.map((v) => ({
        ...v,
        date: v.date.getTime(),
      })),
      forecastProfile: forecastData.forecastProfile,
      // productSoldAverageMonthlyByCode: Object.fromEntries(forecastData.productSoldAverageMonthlyByCode.entries()),
    },

    sold: data.sold.map((sale) => ({
      ...sale,
      emission_date: new Date(sale.emission_date).getTime(),
    })),

    budgets: data.budgets.map((bd) => ({
      ...bd,
      date: bd.date ? new Date(bd.date).getTime() : null,
    })),

    imports: data.imports.map((bd) => ({
      ...bd,
      opening_date: bd.opening_date ? new Date(bd.opening_date).getTime() : null,
      validity_date: bd.validity_date ? new Date(bd.validity_date).getTime() : null,
    })),

    productImports: data.productImports.map((pi) => {
      return {
        ...pi,
        arrival_date: pi.arrival_date ? new Date(pi.arrival_date).getTime() : undefined,
      };
    }),

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

  const stockOfProductsByMonth = {};
  for (const product of evolvedData.products) {
    stockOfProductsByMonth[product.code] = Object.fromEntries(
      stockOfProductByMonth(product.stock, nA(eventsByProductCode[product.code]), months).entries(),
    );
  }

  // product_id: { month_code: number }

  const eventsOfProductsByMonth = {};
  for (const product of evolvedData.products) {
    eventsOfProductsByMonth[product.code] = Object.fromEntries(
      eventsOfProductByMonth(nA(eventsByProductCode[product.code]), months).entries(),
    );
  }

  const stockVariationByMonth = new Map();
  const importedQuantityOfProductsByMonth = new Map();
  const orderedQuantityOfProductsByMonth = new Map();
  const usedAsSupplyQuantityOfProductsByMonth = new Map();
  const usedAsForecastQuantityOfProductsByMonth = new Map();
  const usedAsForecastTypeSoldQuantityOfProductsByMonth = new Map();
  const usedAsForecastTypeBudgetQuantityOfProductsByMonth = new Map();

  for (const product of evolvedData.products) {
    const events = nA(eventsOfProductsByMonth[product.code]);

    for (const month of months) {
      stockVariationByMonth.set(product.code, stockVariationByMonth.get(product.code) ?? new Map());
      importedQuantityOfProductsByMonth.set(product.code, importedQuantityOfProductsByMonth.get(product.code) ?? new Map());
      orderedQuantityOfProductsByMonth.set(product.code, orderedQuantityOfProductsByMonth.get(product.code) ?? new Map());
      usedAsSupplyQuantityOfProductsByMonth.set(
        product.code,
        usedAsSupplyQuantityOfProductsByMonth.get(product.code) ?? new Map(),
      );
      usedAsForecastQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastQuantityOfProductsByMonth.get(product.code) ?? new Map(),
      );
      usedAsForecastTypeSoldQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code) ?? new Map(),
      );
      usedAsForecastTypeBudgetQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code) ?? new Map(),
      );

      nA(stockVariationByMonth.get(product.code)).set(month, 0);
      nA(importedQuantityOfProductsByMonth.get(product.code)).set(month, 0);
      nA(orderedQuantityOfProductsByMonth.get(product.code)).set(month, 0);
      nA(usedAsSupplyQuantityOfProductsByMonth.get(product.code)).set(month, 0);
      nA(usedAsForecastQuantityOfProductsByMonth.get(product.code)).set(month, 0);
      nA(usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code)).set(month, 0);
      nA(usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code)).set(month, 0);

      for (const event of events[month] ?? []) {
        // Aunque solo el valor de quantity afecte a la variación de stock, queremos que los eventos musetren la cantidad original por más de que se hayan dividido en eventos de suministro
        const qty = event.originalQuantity ?? event.quantity;

        let stockModifier = 0;

        if (event.type === "import") {
          nA(importedQuantityOfProductsByMonth
            .get(product.code))
            .set(month, importedQuantityOfProductsByMonth.get(product.code).get(month) + qty);
          stockModifier = qty;
        } else if (event.type === "forecast" || event.isForecast) {
          nA(usedAsForecastQuantityOfProductsByMonth
            .get(product.code))
            .set(month, usedAsForecastQuantityOfProductsByMonth.get(product.code).get(month) + qty);

          if (event.forecastType === "sold") {
            nA(usedAsForecastTypeSoldQuantityOfProductsByMonth
              .get(product.code))
              .set(month, usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code).get(month) + qty);
          } else if (event.forecastType === "budget") {
            nA(usedAsForecastTypeBudgetQuantityOfProductsByMonth
              .get(product.code))
              .set(month, usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code).get(month) + qty);
          }

          stockModifier = -event.quantity;
        } else if (event.type === "order") {
          nA(orderedQuantityOfProductsByMonth
            .get(product.code))
            .set(month, orderedQuantityOfProductsByMonth.get(product.code).get(month) + qty);
          stockModifier = -event.quantity;
        } else if (event.type === "supply") {
          nA(usedAsSupplyQuantityOfProductsByMonth
            .get(product.code))
            .set(month, usedAsSupplyQuantityOfProductsByMonth.get(product.code).get(month) + qty);
          stockModifier = -event.quantity;
        }

        nA(stockVariationByMonth.get(product.code)).set(month, stockVariationByMonth.get(product.code).get(month) + stockModifier);
      }
    }
  }

  const products = evolvedData.products.map((product) => {
    const expiredNotImportEvents = (eventsByProductCode[product.code] ?? []).filter((event) => event.expired && event.type == "import");
    const expiredSum = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);

    return {
      ...product,
      commited: expiredSum,
      stock_at: nA(stockOfProductsByMonth[product.code]),
      imported_quantity_by_month: Object.fromEntries(importedQuantityOfProductsByMonth.get(product.code).entries()),
      ordered_quantity_by_month: Object.fromEntries(orderedQuantityOfProductsByMonth.get(product.code).entries()),
      stock_variation_by_month: Object.fromEntries(stockVariationByMonth.get(product.code).entries()),
      used_as_supply_quantity_by_month: Object.fromEntries(usedAsSupplyQuantityOfProductsByMonth.get(product.code).entries()),
      used_as_forecast_quantity_by_month: Object.fromEntries(usedAsForecastQuantityOfProductsByMonth.get(product.code).entries()),
      used_as_forecast_type_sold_quantity_by_month: Object.fromEntries(
        usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code).entries(),
      ),
      used_as_forecast_type_budget_quantity_by_month: Object.fromEntries(
        usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code).entries(),
      ),
      // events_by_month: eventsOfProductsByMonth[product.code],
      // events: eventsByProductCode[product.code],
    };
  });

  const transformedData = {
    ...evolvedData,
    products,
    events,
    eventsByProductCode,
    stockOfProductsByMonth,
    // eventsOfProductsByMonth,
    forecastProfiles: forecastProfiles.map((p) => ({
      ...p,
      current: p.id == forecastProfile.id,
      createdAt: new Date(p.createdAt).getTime(),
    })),
  };

  return transformedData;
}; */

const args = workerData;

console.log("running worker with forecast profile", args.forecastProfile.id ?? null);
parentPort.postMessage(getMonolitoByForecast(args));

import { getDbInstance } from "~/scripts/lib/instance";
import type { OrderProduct, Product, ProductAssembly } from "./types";
import { queryBaseMRPData } from "~/serverfunctions";
import { eventsOfProductByMonth, type ForecastProfile, type ProductEvent, stockOfProductByMonth } from "~/mrp_data/transform_mrp_data";
import { type ForecastDataEvent, queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { getUserSetting } from "./settings";
import { db } from "~/server/db";
import { nullProfile } from "./nullForecastProfile";
import dayjs from "dayjs";

// la diferencia de los list* con los definidos previamente
// es el tipo de retorno (records en vez de maps, listas en vez de sets, etc)

type MappedData = {
  products: {
    code: string;
    stock: number;
    supplies?: ProductAssembly[];
  }[];
  forecastData?: {
    events: ForecastDataEvent<number>[];
  };
  productImports: {
    arrival_date: number;
    id: number;
    ordered_quantity: number;
    product_code: string;
  }[];
  orderProducts: OrderProduct[];
  ordersByOrderNumber: Record<
    string,
    {
      order_number: string;
      delivery_date: Date | number;
    }
  >;
  productsByCode: Record<string, Product & { supplies?: ProductAssembly[] }>;
};

export function listAllEvents(data: MappedData) {
  const events: ProductEvent<number>[] = [];

  const today = dayjs().startOf("day").toDate();

  // Take forecast data and transform it into events that the MRP can understand
  // if (data.forecastData) {
  for (const event of data.forecastData!.events) {
    // Transform ForecastDataEvent to ProductEvent
    events.push({
      type: "forecast", // It indicates that it is a forecast event (not a real life event)
      forecastType: event.type,
      referenceId: -1,
      date: event.date,
      quantity: event.quantity,
      productCode: event.product_code,
      expired: new Date(event.date) < today,
      productAccumulativeStock: 0,
      originalQuantity: event.originalQuantity,
      isForecast: true,
    });
  }
  // }

  // Events from imports
  for (const productImport of data.productImports) {
    const date = dayjs(productImport.arrival_date).add(15, "day").toDate();
    events.push({
      type: "import",
      referenceId: productImport.id,
      //! 15 días después de la fecha de llegada para estar seguro
      date: date.getTime(),
      quantity: productImport.ordered_quantity,
      productCode: productImport.product_code,
      expired: date < today,
      productAccumulativeStock: 0,
    });
  }

  // Events from orders
  for (const orderProduct of data.orderProducts) {
    const date = new Date(data.ordersByOrderNumber[orderProduct.order_number]!.delivery_date);

    events.push({
      type: "order",
      referenceId: orderProduct.id,
      date: date.getTime(),
      quantity: orderProduct.ordered_quantity,
      productCode: orderProduct.product_code,
      expired: date < today,
      productAccumulativeStock: 0,
    });
  }

  return events.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// Generamos una lista de eventos generales ordenados por fecha
// Les agregamos eventos de suministro para poder calcular el stock de forma correcta
// Esto sucita cuando se agotan los productos que son armados y se tienen que crear nuevos armados,
// en estos casos se asocia al pedido la materia prima necesaria para armar el producto
// debería usarse posteriormente a mapData (supplies!)
export function listAllEventsWithSupplyEvents(data: MappedData) {
  let events: ProductEvent<number>[] = [...listAllEvents(data)];

  const stockOfProductTmp = new Map<string, number>();

  for (const product of data.products) {
    stockOfProductTmp.set(product.code, product.stock);
  }

  let index = 0;
  // Usamos while porque vamos a modificar el array // y? for clasico no va?
  while (index < events.length) {
    const event = events[index]!;
    // const list = listOf(event.productCode)

    if (event.type === "import") {
      // Si es un import no se van a agentar eventos de supply
      const stock = stockOfProductTmp.get(event.productCode)! + event.quantity;
      stockOfProductTmp.set(event.productCode, stock);
      // Actualizamos el stock en el evento
      event.productAccumulativeStock = stock;
    } else if (event.type === "order" || event.type === "forecast" || event.type === "supply") {
      let newStockAmount = stockOfProductTmp.get(event.productCode)! - event.quantity;

      // Datos del producto
      const product = data.productsByCode[event.productCode]!;

      // Cantidad de unidades que faltan para poder completar el pedido
      let overflow = 0;

      // Si estamos vendiendo más unidades de las que tenemos en stock y es un armado,
      // significa que podemos armar más unidades
      if (newStockAmount < 0 && (product.supplies?.length ?? 0) > 0) {
        // Cantidad de unidades que tenemos que armar
        overflow = -newStockAmount;
        // Si ya había stock negativo
        if (overflow > event.quantity) overflow = event.quantity;

        // Stock de la unidad ya armada (que agotamos)
        newStockAmount += overflow;

        // Nos guardamos la cantidad original de unidades que teníamos que armar
        event.originalQuantity = event.quantity;

        // Restamos la cantidad de unidades que armamos (ya que estas cuentan para otro producto)
        event.quantity -= overflow;

        // Nuevos eventos de summistro
        const newSupplyEvents: ProductEvent<number>[] = [];

        // Por cada producto que se necesita para armar el producto
        for (const supply of product.supplies ?? []) {
          newSupplyEvents.push({
            type: "supply",
            forecastType: event.forecastType,
            level: event.type === "supply" ? event.level! + 1 : 0,
            date: event.date, // La fecha es la misma
            productCode: supply.supply_product_code, // Código del suministro
            quantity: supply.quantity * overflow, // Cantidad por armado por cantidad a armar
            assemblyId: supply.id,
            parentEventIndex: index,
            referenceId: event.referenceId, // Referencia al producto de la orden original
            expired: event.expired,
            isForecast: event.isForecast,
            productAccumulativeStock: 0,
          });
        }

        // (no) Referenciamos el evento original a los nuevos eventos de suministro
        event.childEventsIndexes = [];
        for (let k = 0; k < newSupplyEvents.length; k++) {
          event.childEventsIndexes.push(index + 1 + k);
        }

        // Agregamos los nuevos eventos de suministro a la lista de eventos
        // ES MUY IMPORTANTE RESPETAR EL ORDEN POR FECHA
        // Obs: esto no rompe parentEventIndex porque los indices previos se mantienen
        events = [...events.slice(0, index + 1), ...newSupplyEvents, ...events.slice(index + 1)];
      }

      // Actualizamos el stock del producto
      stockOfProductTmp.set(event.productCode, newStockAmount);

      // Actualizamos el stock en el evento
      event.productAccumulativeStock = newStockAmount;
    }

    index++;
  }

  return events;
}

export function listProductsEvents(data: MappedData, events: ProductEvent<number>[]) {
  const eventsByProductCode: Record<string, ProductEvent<number>[]> = {};

  for (const product of data.products) {
    eventsByProductCode[product.code] = [];
  }

  const listOf = (code: string) => eventsByProductCode[code] ?? [];

  for (const event of events) {
    listOf(event.productCode).push(event);
  }

  return eventsByProductCode;
}

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
  const rawData = await queryBaseMRPData(cacheTtl);
  const data = {
    ...rawData,
    productImports: rawData.productImports.map((pi) => {
      return {
        ...pi,
        arrival_date: new Date(pi.arrival_date).getTime(),
      };
    }),
  };

  const forecastProfiles = await db.query.forecastProfiles.findMany();

  let forecastProfile: ForecastProfile | null =
    forecastProfileId != null ? (forecastProfiles.find((v) => v.id === forecastProfileId) ?? null) : null;

  if (!forecastProfile) {
    forecastProfile = nullProfile;
  }

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
  const orderProductsByOrderNumber: Record<
    string,
    {
      id: number;
      order_number: string;
      product_code: string;
      ordered_quantity: number;
    }[]
  > = {};

  data.orderProducts.forEach((order) => {
    if (orderProductsByOrderNumber[order.order_number] !== undefined) {
      orderProductsByOrderNumber[order.order_number]!.push(order);
    } else {
      orderProductsByOrderNumber[order.order_number] = [order];
    }
  });

  const orderProductsByProductCode: Record<
    string,
    {
      id: number;
      order_number: string;
      product_code: string;
      ordered_quantity: number;
    }[]
  > = {};

  data.orderProducts.forEach((order) => {
    if (orderProductsByProductCode[order.product_code] !== undefined) {
      orderProductsByProductCode[order.product_code]!.push(order);
    } else {
      orderProductsByProductCode[order.product_code] = [order];
    }
  });

  const orderProductsById = Object.fromEntries(data.orderProducts.map((order) => [order.id, order]));
  const clientsByCode = Object.fromEntries(data.clients.map((client) => [client.code, client]));
  const assemblyById = Object.fromEntries(data.assemblies.map((assembly) => [assembly.id, assembly]));
  const forecastData = await queryForecastData(forecastProfile, data);

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

  const stockOfProductsByMonth: Record<string, Record<string, number>> = {};
  for (const product of evolvedData.products) {
    stockOfProductsByMonth[product.code] = Object.fromEntries(
      stockOfProductByMonth(product.stock, eventsByProductCode[product.code]!, months).entries(),
    );
  }

  // product_id: { month_code: number }

  const eventsOfProductsByMonth: Record<string, Record<string, ProductEvent<number>[]>> = {};
  for (const product of evolvedData.products) {
    eventsOfProductsByMonth[product.code] = Object.fromEntries(
      eventsOfProductByMonth(eventsByProductCode[product.code]!, months).entries(),
    );
  }

  const stockVariationByMonth = new Map<string, Map<string, number>>();
  const importedQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const orderedQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsSupplyQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastTypeSoldQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastTypeBudgetQuantityOfProductsByMonth = new Map<string, Map<string, number>>();

  for (const product of evolvedData.products) {
    const events = eventsOfProductsByMonth[product.code]!;

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

      for (const event of events[month] ?? []) {
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
    const expiredNotImportEvents = (eventsByProductCode[product.code] ?? []).filter((event) => event.expired && event.type !== "import");
    const expiredSum = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);

    return {
      ...product,
      commited: expiredSum,
      stock_at: stockOfProductsByMonth[product.code]!,
      imported_quantity_by_month: Object.fromEntries(importedQuantityOfProductsByMonth.get(product.code)!.entries()),
      ordered_quantity_by_month: Object.fromEntries(orderedQuantityOfProductsByMonth.get(product.code)!.entries()),
      stock_variation_by_month: Object.fromEntries(stockVariationByMonth.get(product.code)!.entries()),
      used_as_supply_quantity_by_month: Object.fromEntries(usedAsSupplyQuantityOfProductsByMonth.get(product.code)!.entries()),
      used_as_forecast_quantity_by_month: Object.fromEntries(usedAsForecastQuantityOfProductsByMonth.get(product.code)!.entries()),
      used_as_forecast_type_sold_quantity_by_month: Object.fromEntries(
        usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code)!.entries(),
      ),
      used_as_forecast_type_budget_quantity_by_month: Object.fromEntries(
        usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code)!.entries(),
      ),
      events_by_month: eventsOfProductsByMonth[product.code],
      events: eventsByProductCode[product.code],
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
      createdAt: new Date(p.createdAt).getTime(),
    })),
  };

  return transformedData;
};

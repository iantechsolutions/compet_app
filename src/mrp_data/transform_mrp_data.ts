/* eslint-disable */

import { monthCodeFromDate } from "~/lib/utils";
// Es un archivo de cliente porque enviar todo como JSON del servidor va a generar problemas

// Importamos SOLO el tipo de dato
import type { ForecastData } from "~/mrp_data/query_mrp_forecast_data";
export type { RawMRPData, ForecastData };
import dayjs from "dayjs";
import type { RawMRPData } from "~/mrp_data/query_mrp_data";
import { Client, Import, Order, OrderProduct, Product, ProductAssembly, ProductImport, Provider } from "~/lib/types";

export type ProductEventType = "import" | "order" | "supply" | "forecast";

export type ProductEvent<Date> = {
  type: ProductEventType;
  forecastType?: "sold" | "budget"; // | 'import'
  referenceId: number;
  date: Date;
  originalQuantity?: number;
  quantity: number;
  productCode: string;
  parentEventIndex?: number;
  childEventsIndexes?: number[];
  level?: number;
  expired: boolean;
  assemblyId?: number;
  assemblyQuantity?: number;
  isForecast?: boolean;
  productAccumulativeStock: number;
};

// Transformamos los datos en el cliente para que sean fáciles de consumir y mostrar
function _transformMRPData(rawData: RawMRPData, forecastData: ForecastData | undefined, forecastParams: ForecastProfile | undefined) {
  const data = mapData(rawData, forecastData);

  const months = rawData.months;

  const events = listAllEventsWithSupplyEvents(data);
  const eventsByProductCode = listProductsEvents(data, events);

  const stockOfProductsByMonth = new Map<string, Map<string, number>>();
  for (const product of data.products) {
    stockOfProductsByMonth.set(product.code, stockOfProductByMonth(product.stock, eventsByProductCode.get(product.code)!, months));
  }

  // product_id: { month_code: number }

  const eventsOfProductsByMonth = new Map<string, Map<string, ProductEvent<Date>[]>>();
  for (const product of data.products) {
    eventsOfProductsByMonth.set(product.code, eventsOfProductByMonth(eventsByProductCode.get(product.code)!, months));
  }

  const stockVariationByMonth = new Map<string, Map<string, number>>();
  const importedQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const orderedQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsSupplyQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastTypeSoldQuantityOfProductsByMonth = new Map<string, Map<string, number>>();
  const usedAsForecastTypeBudgetQuantityOfProductsByMonth = new Map<string, Map<string, number>>();

  for (const product of data.products) {
    const events = eventsOfProductsByMonth.get(product.code)!;

    for (const month of months) {
      stockVariationByMonth.set(product.code, stockVariationByMonth.get(product.code) ?? new Map());
      importedQuantityOfProductsByMonth.set(product.code, importedQuantityOfProductsByMonth.get(product.code) ?? new Map());
      orderedQuantityOfProductsByMonth.set(product.code, orderedQuantityOfProductsByMonth.get(product.code) ?? new Map());
      usedAsSupplyQuantityOfProductsByMonth.set(product.code, usedAsSupplyQuantityOfProductsByMonth.get(product.code) ?? new Map());
      usedAsForecastQuantityOfProductsByMonth.set(product.code, usedAsForecastQuantityOfProductsByMonth.get(product.code) ?? new Map());
      usedAsForecastTypeSoldQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastTypeSoldQuantityOfProductsByMonth.get(product.code) ?? new Map(),
      );
      usedAsForecastTypeBudgetQuantityOfProductsByMonth.set(
        product.code,
        usedAsForecastTypeBudgetQuantityOfProductsByMonth.get(product.code) ?? new Map(),
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

  const products = data.products.map((product) => {
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
      events_by_month: eventsOfProductsByMonth.get(product.code)!,
      events: eventsByProductCode.get(product.code)!,
    };
  });

  return {
    ...data,
    products,
    events,
    eventsByProductCode,
    stockOfProductsByMonth,
    eventsOfProductsByMonth,
  };
}

export type ForecastProfile = {
  id?: number;
  name: string;
  includeSales: boolean;
  salesIncrementFactor: number;
  includeBudgets: boolean;
  budgetsInclusionFactor: number;
  clientInclusionList: string[] | null;
};

export function transformMRPData(rawData: RawMRPData, forecastData: ForecastData | undefined, forecastParams: ForecastProfile | undefined) {
  if (!forecastData) throw new Error("No forecast data");
  const data = _transformMRPData(rawData, forecastData, forecastParams);
  const productsByCode = new Map<string, ReturnType<typeof _transformMRPData>["products"][number]>();
  for (const product of data.products) {
    productsByCode.set(product.code, product);
  }

  return {
    ...data,
    productsByCode,
  };
}

export type MRPData = ReturnType<typeof transformMRPData>;
export type MRPProduct = MRPData["products"][number];

// Generamos una lista de eventos generales ordenados por fecha
export function listAllEvents(data: MappedData) {
  const events: ProductEvent<Date>[] = [];

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
      date,
      quantity: productImport.ordered_quantity,
      productCode: productImport.product_code,
      expired: date < today,
      productAccumulativeStock: 0,
    });
  }

  // Events from orders
  for (const orderProduct of data.orderProducts) {
    const date = new Date(data.ordersByOrderNumber.get(orderProduct.order_number)!.delivery_date);

    events.push({
      type: "order",
      referenceId: orderProduct.id,
      date,
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
  let events: ProductEvent<Date>[] = [...listAllEvents(data)];

  const stockOfProductTmp = new Map<string, number>();

  for (const product of data.products) {
    let stock = product.stock - product.commited;
    stockOfProductTmp.set(product.code, stock);
  }

  let index = 0;
  // Usamos while porque vamos a modificar el array
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
      const product = data.productsByCode.get(event.productCode)!;

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
        const newSupplyEvents: ProductEvent<Date>[] = [];

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

export function listProductsEvents(data: MappedData, events: ProductEvent<Date>[]) {
  const eventsByProductCode = new Map<string, ProductEvent<Date>[]>();

  for (const product of data.products) {
    eventsByProductCode.set(product.code, []);
  }

  const listOf = (code: string) => eventsByProductCode.get(code) ?? [];

  for (const event of events) {
    listOf(event.productCode).push(event);
  }

  return eventsByProductCode;
}

export function stockOfProductByMonth(initialStock: number, productEvents: ProductEvent<Date | number>[], months: string[]) {
  const stockByMonth = new Map<string, number>();

  let stock = initialStock;

  const eventsBeforeToday = productEvents.filter((event) => event.expired);
  const eventFromToday = productEvents.filter((event) => !event.expired);

  for (const event of eventsBeforeToday) {
    if (event.type === "import") {
      stock += event.quantity;
    } else if (event.type === "order" || event.type === "forecast") {
      stock -= event.quantity;
    } else if (event.type === "supply") {
      stock -= event.quantity;
    }
  }

  const eventsByMonth = new Map<string, ProductEvent<Date | number>[]>();

  for (const month of months) {
    eventsByMonth.set(month, []);
  }

  for (const event of eventFromToday) {
    const monthCode = monthCodeFromDate(typeof event.date === "number" ? new Date(event.date) : event.date);
    eventsByMonth.get(monthCode)?.push(event);
  }

  let stockCarry = stock;
  for (const month of months) {
    const events = eventsByMonth.get(month)!;

    for (const event of events) {
      if (event.type === "import") {
        stockCarry += event.quantity;
      } else if (event.type === "order" || event.type === "forecast") {
        stockCarry -= event.quantity;
      } else if (event.type === "supply") {
        stockCarry -= event.quantity;
      }
    }

    stockByMonth.set(month, stockCarry);
  }

  return stockByMonth;
}

export function eventsOfProductByMonth<K>(productEvents: ProductEvent<K>[], months: string[]) {
  const eventsByMonth = new Map<string, ProductEvent<K>[]>();

  for (const event of productEvents) {
    const monthCode = monthCodeFromDate(new Date(event.date as unknown as number | Date));
    eventsByMonth.set(monthCode, [...(eventsByMonth.get(monthCode) ?? []), event]);
  }

  // Fill missing months with empty array
  for (const monthCode of months) {
    if (!eventsByMonth.has(monthCode)) {
      eventsByMonth.set(monthCode, []);
    }
  }

  return eventsByMonth;
}

// Generamos mapas para acceder a los datos de forma más eficiente
export function mapData(rawData: RawMRPData, forecastData?: ForecastData): MappedData {
  // Productos y provedores por código
  const productsByCode = new Map(rawData.products.map((product) => [product.code, product]));
  const providersByCode = new Map(rawData.providers.map((provider) => [provider.code, provider]));

  // Imports por su identificador
  const importsById = new Map(rawData.imports.map((imported) => [imported.id, imported]));

  // Importaciones de productos por su identificador y código de producto
  const productImportsById = new Map(rawData.productImports.map((productImport) => [productImport.id, productImport]));
  const productImportsByProductCode = new Map(rawData.productImports.map((productImport) => [productImport.product_code, productImport]));

  // Ordenes por su número de orden
  const ordersByOrderNumber = new Map(rawData.orders.map((order) => [order.order_number, order]));

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
  rawData.orderProducts.forEach((order) => {
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
  rawData.orderProducts.forEach((order) => {
    orderProductsByProductCode.set(order.product_code, [...(orderProductsByProductCode.get(order.product_code) ?? []), order]);
  });

  const orderProductsById = new Map(rawData.orderProducts.map((order) => [order.id, order]));
  const clientsByCode = new Map(rawData.clients.map((client) => [client.code, client]));
  const assemblyById = new Map(rawData.assemblies.map((assembly) => [assembly.id, assembly]));

  return {
    ...rawData,
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
}

export type MappedData = RawMRPData & {
  forecastData?: ForecastData;
  productsByCode: Map<string, RawMRPData["products"][0]>;
  providersByCode: Map<string, Provider>;
  importsById: Map<string, Import>;
  productImportsById: Map<number, ProductImport>;
  productImportsByProductCode: Map<string, ProductImport>;
  ordersByOrderNumber: Map<string, Order>;
  orderProductsByOrderNumber: Map<String, OrderProduct[]>;
  orderProductsByProductCode: Map<String, OrderProduct[]>;
  orderProductsById: Map<number, OrderProduct>;
  clientsByCode: Map<string, Client>;
  assemblyById: Map<number, ProductAssembly>;
};

import dayjs from "dayjs";
import type { ForecastDataEvent } from "../mrp_data/query_mrp_forecast_data";
import type { ForecastProfile, ProductEvent } from "../mrp_data/transform_mrp_data";
import type { db } from "../server/db";
import type { queryBaseMRPData } from "../serverfunctions";
import type { CrmBudget, CrmBudgetProduct, OrderProduct, OrderProductSold, OrderSold, Product, ProductAssembly } from "./types";
import { monthCodeFromDate, monthCodeToDate } from "./utils";

type MappedData = {
  products: {
    code: string;
    stock: number;
    commited: number;
    supplies?: ProductAssembly[];
  }[];
  forecastData?: {
    events: ForecastDataEvent<number>[];
  };
  productImports: {
    arrival_date?: number;
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

export function queryForecastDataSync(
  forecastProfile: ForecastProfile,
  data: {
    budget_products: CrmBudgetProduct[];
    products_sold: OrderProductSold[];
    sold: OrderSold[];
    months: string[];
    budgetsById: Map<number, CrmBudget>;
  },
) {
  const budgetProducts = data.budget_products;
  const clientInclusionSet = forecastProfile.clientInclusionList ? new Set(forecastProfile.clientInclusionList) : null;

  const events: ForecastDataEvent<Date>[] = [
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

  const ordersSoldByN_COMP = new Map<string, OrderSold>();
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

  return {
    // soldProducts,
    productsSoldMonthlyByCode,
    productSoldAverageMonthlyByCode,
    events,
    forecastProfile,
  };
}

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
    stockOfProductTmp.set(product.code, product.stock - product.commited);
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

// obs: chequear el de worker.mjs si modificamos este
export function getMonolitoByForecast(args: {
  forecastProfile: ForecastProfile;
  forecastProfiles: Awaited<ReturnType<typeof db.query.forecastProfiles.findMany>>;
  data: Awaited<ReturnType<typeof queryBaseMRPData>>;
}) {
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

    stock_movements: (data.stock_movements ?? []).map(v => ({
      ...v,
      f: v.f.getTime()
    })),

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

    products_sold: data.products_sold.map((v) => ({
      ...v,
      date: v.date?.getTime() ?? 0
    })),

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
    const monthCode = dayjs(typeof event.date === "number" ? new Date(event.date) : event.date).format("YYYY-MM");
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

function eventsOfProductByMonth<K>(productEvents: ProductEvent<K>[], months: string[]) {
  const eventsByMonth = new Map<string, ProductEvent<K>[]>();

  for (const event of productEvents) {
    const monthCode = dayjs(new Date(event.date as unknown as number | Date)).format("YYYY-MM");
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

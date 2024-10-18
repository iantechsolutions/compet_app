import type { Database } from "~/scripts/lib/database";
import { getMonths, monthCodeFromDate, monthCodeToDate } from "./utils";
import type { CrmBudget, OrderSold, ProductAssembly, ProductStockCommited } from "./types";
import { getDbInstance } from "~/scripts/lib/instance";
import type { ForecastDataEvent, queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import type { ForecastProfile, ProductEvent } from "~/mrp_data/transform_mrp_data";
import dayjs from "dayjs";

type MinimalMonolito = {
  budget_products: Awaited<ReturnType<Database["getBudgetProducts"]>>;
  budgetsById: Map<number, NonNullable<Awaited<ReturnType<Database["getBudgets"]>>[number]>>;
  products_sold: Awaited<ReturnType<Database["getProductsSold"]>>;
  sold: Awaited<ReturnType<Database["getSold"]>>;
  orderProducts: Awaited<ReturnType<Database["getOrdersAndProdOrders"]>>;
  productImports: Awaited<ReturnType<Database["getProductImports"]>>;
  productsBasic: Awaited<ReturnType<Database["getProductCodes"]>>;
  products_assemblies: Awaited<ReturnType<Database["getAssemblies"]>>;
  stockCommitedByProduct: Map<string, ProductStockCommited>;
  products_stock_commited: Awaited<ReturnType<Database["getCommitedStock"]>>;
  months: string[];
  suppliesOfProduct: Map<string, (ProductAssembly & { code: string })[]>;
};

export async function getMinimalMonolito(cacheTtl?: number, forceCache = false): Promise<MinimalMonolito> {
  const dbi = await getDbInstance();
  try {
    const [
      productsBasic,
      products_assemblies,
      products_stock_commited,
      budget_products,
      budgets,
      products_sold,
      sold,
      orderProducts,
      productImports,
    ] = await Promise.all([
      dbi.getProductCodes(cacheTtl, forceCache),
      dbi.getAssemblies(cacheTtl, forceCache),
      dbi.getCommitedStock(cacheTtl, forceCache),
      dbi.getBudgetProducts(cacheTtl, forceCache),
      dbi.getBudgets(cacheTtl, forceCache),
      dbi.getProductsSold(cacheTtl, forceCache),
      dbi.getSold(cacheTtl, forceCache),
      dbi.getOrdersAndProdOrders(cacheTtl, forceCache),
      dbi.getProductImports(cacheTtl, forceCache),
    ]);

    const budgetsById = new Map<number, CrmBudget>();
    for (const budget of budgets) {
      budgetsById.set(budget.budget_id, budget);
    }

    const stockCommitedByProduct = new Map<string, ProductStockCommited>();
    for (const stockCommited of products_stock_commited) {
      // Por alguna razón puede haber más de una fila con el mismo código de producto
      // Por eso vamos a combinarlas
      const prev = stockCommitedByProduct.get(stockCommited.product_code) ?? {
        product_code: stockCommited.product_code,
        stock_quantity: 0,
        commited_quantity: 0,
        pending_quantity: 0,
        last_update: new Date(0),
      };

      stockCommitedByProduct.set(stockCommited.product_code, {
        product_code: stockCommited.product_code,
        commited_quantity: prev.commited_quantity + stockCommited.commited_quantity,
        stock_quantity: prev.stock_quantity + stockCommited.stock_quantity,
        pending_quantity: prev.pending_quantity + stockCommited.pending_quantity,
        last_update: prev.last_update > stockCommited.last_update ? prev.last_update : stockCommited.last_update,
      });
    }

    const suppliesOfProduct = new Map<string, (ProductAssembly & { code: string })[]>();
    for (const assembly of products_assemblies) {
      const supplies = suppliesOfProduct.get(assembly.product_code) ?? [];
      supplies.push({ ...assembly, code: assembly.supply_product_code });
      suppliesOfProduct.set(assembly.product_code, supplies);
    }

    return {
      suppliesOfProduct,
      productsBasic,
      budget_products,
      budgetsById,
      months: getMonths(10),
      orderProducts,
      productImports,
      products_sold,
      sold,
      products_assemblies,
      products_stock_commited,
      stockCommitedByProduct,
    };
  } catch (e) {
    console.error("getMinimalMonolito error");
    console.error(e);
    throw new Error("getMinimalMonolito crashed");
  }
}

export function minQueryForecastData(forecastProfile: ForecastProfile, data: MinimalMonolito) {
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

  /** END BUDGETS AREA */

  return {
    // soldProducts,
    productsSoldMonthlyByCode,
    productSoldAverageMonthlyByCode,
    events,
    forecastProfile,
  };
}

export function minListAllEvents(forecastData: Awaited<ReturnType<typeof queryForecastData>>, data: MinimalMonolito) {
  const events: ProductEvent[] = [];

  const today = dayjs().startOf("day").toDate();

  // Take forecast data and transform it into events that the MRP can understand
  // if (data.forecastData) {
  for (const event of forecastData.events) {
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
    const date = new Date(orderProduct.delivery_date);

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
export function minListAllEventsWithSupplyEvents(events: ReturnType<typeof minListAllEvents>, data: MinimalMonolito) {
  const stockOfProductTmp = new Map<string, number>();
  for (const product of data.productsBasic) {
    stockOfProductTmp.set(product.code, data.stockCommitedByProduct.get(product.code)?.stock_quantity ?? 0);
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
      const supplies = data.suppliesOfProduct.get(event.productCode);

      // Cantidad de unidades que faltan para poder completar el pedido
      let overflow = 0;

      // Si estamos vendiendo más unidades de las que tenemos en stock y es un armado,
      // significa que podemos armar más unidades
      if (newStockAmount < 0 && (supplies?.length ?? 0) > 0) {
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
        const newSupplyEvents: ProductEvent[] = [];

        // Por cada producto que se necesita para armar el producto
        for (const supply of supplies ?? []) {
          newSupplyEvents.push({
            type: "supply",
            forecastType: event.forecastType,
            level: event.type === "supply" ? event.level! + 1 : 0,
            date: event.date, // La fecha es la misma
            productCode: supply.supply_product_code, // Código del suministro
            quantity: supply.quantity * overflow, // Cantidad por armado por cantidad a armar
            assemblyId: supply.id,
            parentEvent: event,
            referenceId: event.referenceId, // Referencia al producto de la orden original
            expired: event.expired,
            isForecast: event.isForecast,
            productAccumulativeStock: 0,
          });
        }

        // Referenciamos el evento original a los nuevos eventos de suministro
        event.childEvents = newSupplyEvents;

        // Agregamos los nuevos eventos de suministro a la lista de eventos
        // ES MUY IMPORTANTE RESPETAR EL ORDEN POR FECHA
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

export function minListProductsEvents(events: ReturnType<typeof minListAllEventsWithSupplyEvents>, data: MinimalMonolito) {
  const eventsByProductCode = new Map<string, ProductEvent[]>();

  for (const product of data.productsBasic) {
    eventsByProductCode.set(product.code, []);
  }

  const listOf = (code: string) => eventsByProductCode.get(code) ?? [];

  for (const event of events) {
    listOf(event.productCode).push(event);
  }

  return eventsByProductCode;
}

import { getDbInstance } from "~/scripts/lib/instance";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import type {
  CrmBudget,
  CrmBudgetProduct,
  Order,
  OrderProductSold,
  Product,
  ProductAssembly,
  ProductImport,
  ProductProvider,
  ProductStockCommited,
} from "~/lib/types";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { getUserSetting } from "~/lib/settings";
import { type ForecastProfile, listAllEventsWithSupplyEvents, listProductsEvents } from "~/mrp_data/transform_mrp_data";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { forecastProfiles } from "~/server/db/schema";
import { getServerAuthSession } from "~/server/auth";
import { nullProfile } from "~/lib/nullForecastProfile";
import { getMonths } from "~/lib/utils";
import { queryBaseMRPData } from "~/serverfunctions";
import { cachedAsyncFetch } from "~/lib/cache";
import { defaultCacheTtl } from "~/scripts/lib/database";
import type { RouterOutputs } from "~/trpc/shared";
import { getProductByCode, getMonolitoBase } from "~/lib/monolito";

export const maxDuration = 300;

export const dbRouter = createTRPCRouter({
  getProducts: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProducts();
  }),
  getProductsByCode: protectedProcedure.query(async () => {
    return await getProductByCode();
  }),
  getProductByCode: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(255),
      }),
    )
    .query(async ({ input }) => {
      return await (await getDbInstance()).getProductByCode(input.code);
    }),
  getCommitedStock: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getCommitedStock();
  }),
  getCommitedStockByProduct: protectedProcedure.query(async () => {
    const products_stock_commited = await (await getDbInstance()).getCommitedStock();
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

    return stockCommitedByProduct;
  }),
  getProviders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProviders();
  }),
  getProductProviders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductProviders();
  }),
  getProductProvidersOfProducts: protectedProcedure.query(async () => {
    const product_providers = await (await getDbInstance()).getProductProviders();
    const productProivderOfProduct = new Map<string, ProductProvider[]>();
    for (const productProvider of product_providers) {
      const productProviders = productProivderOfProduct.get(productProvider.product_code) ?? [];
      productProviders.push(productProvider);
      productProivderOfProduct.set(productProvider.product_code, productProviders);
    }

    return productProivderOfProduct;
  }),
  getAssemblies: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getAssemblies();
  }),
  getImports: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getImports();
  }),
  getProductImports: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductImports();
  }),
  getProductImportsByProduct: protectedProcedure.query(async () => {
    const products_imports = await (await getDbInstance()).getProductImports();
    const productImportsByProduct = new Map<string, ProductImport[]>();

    for (const productImport of products_imports) {
      const productImports = productImportsByProduct.get(productImport.product_code) ?? [];
      productImports.push(productImport);
      productImportsByProduct.set(productImport.product_code, productImports);
    }

    return productImportsByProduct;
  }),
  getProductsAndSupplies: protectedProcedure.query(async () => {
    const products_assemblies = await (await getDbInstance()).getAssemblies();

    const { products, productByCode } = await getProductByCode();
    const suppliesOfProduct = new Map<string, (ProductAssembly & { product: Product })[]>();
    const suppliesOfOfProduct = new Map<string, (ProductAssembly & { product: Product })[]>();

    for (const assembly of products_assemblies) {
      const supplies = suppliesOfProduct.get(assembly.product_code) ?? [];
      let product = productByCode.get(assembly.supply_product_code)!;
      supplies.push({ ...assembly, product });
      suppliesOfProduct.set(assembly.product_code, supplies);

      const suppliesOf = suppliesOfOfProduct.get(assembly.supply_product_code) ?? [];
      product = productByCode.get(assembly.product_code)!;
      suppliesOf.push({ ...assembly, product });
      suppliesOfOfProduct.set(assembly.supply_product_code, suppliesOf);
    }

    return {
      suppliesOfProduct,
      suppliesOfOfProduct,
      productByCode,
      products,
    };
  }),
  getOrders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getOrders();
  }),
  getOrdersByOrderNumber: protectedProcedure.query(async () => {
    const orders = await (await getDbInstance()).getOrders();
    const ordersByOrderNumber = new Map<string, Order>();
    for (const order of orders) {
      ordersByOrderNumber.set(order.order_number, order);
    }

    return ordersByOrderNumber;
  }),
  getProductsOrders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductsOrders();
  }),
  getClients: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getClients();
  }),
  getSold: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getSold();
  }),
  getProductsSold: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductsSold();
  }),
  getProductsSoldByN_COMP: protectedProcedure.query(async () => {
    const products_sold = await (await getDbInstance()).getProductsSold();
    const productSoldByN_COMP = new Map<string, OrderProductSold[]>();
    for (const soldProduct of products_sold) {
      const orderProducts = productSoldByN_COMP.get(soldProduct.N_COMP) ?? [];
      orderProducts.push(soldProduct);
      productSoldByN_COMP.set(soldProduct.N_COMP, orderProducts);
    }

    return productSoldByN_COMP;
  }),
  getBudgets: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getBudgets();
  }),
  getBudgetById: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
      }),
    )
    .query(async ({ input }) => {
      return await (await getDbInstance()).getBudgetById(input.id);
    }),
  getBudgetsById: protectedProcedure.query(async () => {
    const budgets = await (await getDbInstance()).getBudgets();
    const budgetsById = new Map<number, CrmBudget>();
    for (const budget of budgets) {
      budgetsById.set(budget.budget_id, budget);
    }

    return budgetsById;
  }),
  getBudgetProducts: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getBudgetProducts();
  }),
  getBudgetProductsByBudgetId: protectedProcedure.query(async () => {
    const budget_products = await (await getDbInstance()).getBudgetProducts();
    const budgetProductByBudgetId = new Map<number, CrmBudgetProduct[]>();
    for (const budgetProduct of budget_products) {
      const budgetProducts = budgetProductByBudgetId.get(budgetProduct.budget_id) ?? [];
      budgetProducts.push(budgetProduct);
      budgetProductByBudgetId.set(budgetProduct.budget_id, budgetProducts);
    }

    return budgetProductByBudgetId;
  }),
  getCrmClients: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getCrmClients();
  }),
  getMonths: protectedProcedure.query(async () => {
    return getMonths(10);
  }),
  getForecast: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", session?.user.id ?? "");

    let forecastProfile: ForecastProfile | null =
      forecastProfileId != null
        ? ((await db.query.forecastProfiles.findFirst({
            where: eq(forecastProfiles.id, forecastProfileId),
          })) ?? null)
        : null;

    if (!forecastProfile) {
      forecastProfile = nullProfile;
    }

    return await queryForecastData(forecastProfile);
  }),
  getForecastProfile: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", session?.user.id ?? "");

    let forecastProfile: ForecastProfile | null =
      forecastProfileId != null
        ? ((await db.query.forecastProfiles.findFirst({
            where: eq(forecastProfiles.id, forecastProfileId),
          })) ?? null)
        : null;

    if (!forecastProfile) {
      forecastProfile = nullProfile;
    }

    return forecastProfile;
  }),
  getEventsAndForecast: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", session?.user.id ?? "");

    let forecastProfile: ForecastProfile | null =
      forecastProfileId != null
        ? ((await db.query.forecastProfiles.findFirst({
            where: eq(forecastProfiles.id, forecastProfileId),
          })) ?? null)
        : null;

    if (!forecastProfile) {
      forecastProfile = nullProfile;
    }

    const data = await queryBaseMRPData();
    const forecastData = await queryForecastData(forecastProfile, data);

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

    return {
      data: evolvedData,
      events,
      eventsByProductCode,
      forecastData,
    };
  }),
  getMonolito: protectedProcedure
    .input(
      z
        .object({
          data: z
            .object({
              products: z
                .object({
                  events: z.boolean().default(false),
                  events_by_month: z.boolean().default(false),
                  supplies: z.boolean().default(false),
                  suppliesOf: z.boolean().default(false),
                })
                .optional(),
              budgetsById: z.boolean().default(false),
              budgets: z.boolean().default(false),
              events: z.boolean().default(false),
              eventsByProductCode: z.boolean().default(false),
              eventsOfProductsByMonth: z.boolean().default(false),
              ordersByOrderNumber: z.boolean().default(false),
              orderProductsByProductCode: z.boolean().default(false),
              orderProductsByOrderNumber: z.boolean().default(false),
              clientsByCode: z.boolean().default(false),
              productsByCode: z.boolean().default(false),
              assemblyById: z.boolean().default(false),
              providersByCode: z.boolean().default(false),
              crm_clients: z.boolean().default(false),
              orderProductsById: z.boolean().default(false),
              productImportsById: z.boolean().default(false),
              importsById: z.boolean().default(false),
              providers: z.boolean().default(false),
              budget_products: z.boolean().default(false),
              clients: z.boolean().default(false),
              sold: z.boolean().default(false),
            })
            .default({}),
          events: z.boolean().default(false),
          eventsByProductCode: z.boolean().default(false),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const monolito = await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase());
      const monolitoShallow: PartialExcept<
        typeof monolito,
        [
          "data.products",
          "data.products.events",
          "data.forecastData",
          "data.budgets",
          "data.budgetsById",
          "data.eventsByProductCode",
          "data.eventsOfProductsByMonth",
          "data.events",
          "data.sold",
          "data.clients",
          "data.ordersByOrderNumber",
          "data.orderProductsByOrderNumber",
          "data.orderProductsByProductCode",
          "data.clientsByCode",
          "data.assemblyById",
          "data.productsByCode",
          "data.providersByCode",
          "data.crm_clients",
          "data.productImportsById",
          "data.orderProductsById",
          "data.importsById",
          "data.providers",
          "data.budget_products",
          "events",
          "eventsByProductCode",
          "forecastData",
        ]
      > = {
        ...monolito,
      };

      if (input.data.products === undefined) {
        monolitoShallow.data.products = undefined;
      } else {
        monolitoShallow.data.products = monolito.data.products.map((v) => {
          const prodShallow = { ...v };
          if (!input.data.products?.events) {
            prodShallow.events = undefined;
          }

          if (!input.data.products?.events_by_month) {
            prodShallow.events_by_month = undefined;
          }

          if (!input.data.products?.supplies) {
            prodShallow.supplies = undefined;
          }

          if (!input.data.products?.suppliesOf) {
            prodShallow.suppliesOf = undefined;
          }

          return prodShallow;
        });
      }

      if (!input.data.budgetsById) {
        monolitoShallow.data.budgetsById = undefined;
      }

      if (!input.data.sold) {
        monolitoShallow.data.sold = undefined;
      }

      if (!input.data.clients) {
        monolitoShallow.data.clients = undefined;
      }

      if (!input.data.budgets) {
        monolitoShallow.data.budgets = undefined;
      }

      if (!input.data.events) {
        monolitoShallow.data.events = undefined;
      }

      if (!input.data.orderProductsById) {
        monolitoShallow.data.orderProductsById = undefined;
      }

      if (!input.data.productImportsById) {
        monolitoShallow.data.productImportsById = undefined;
      }

      if (!input.data.budget_products) {
        monolitoShallow.data.budget_products = undefined;
      }

      if (!input.data.providers) {
        monolitoShallow.data.providers = undefined;
      }

      if (!input.data.clientsByCode) {
        monolitoShallow.data.clientsByCode = undefined;
      }

      if (!input.data.importsById) {
        monolitoShallow.data.importsById = undefined;
      }

      if (!input.data.assemblyById) {
        monolitoShallow.data.assemblyById = undefined;
      }

      if (!input.data.productsByCode) {
        monolitoShallow.data.productsByCode = undefined;
      }

      if (!input.data.eventsByProductCode) {
        monolitoShallow.data.eventsByProductCode = undefined;
      }

      if (!input.data.crm_clients) {
        monolitoShallow.data.crm_clients = undefined;
      }

      if (!input.data.eventsOfProductsByMonth) {
        monolitoShallow.data.eventsOfProductsByMonth = undefined;
      }

      if (!input.data.ordersByOrderNumber) {
        monolitoShallow.data.ordersByOrderNumber = undefined;
      }

      if (!input.data.orderProductsByProductCode) {
        monolitoShallow.data.orderProductsByProductCode = undefined;
      }

      if (!input.data.providersByCode) {
        monolitoShallow.data.providersByCode = undefined;
      }

      if (!input.data.orderProductsByOrderNumber) {
        monolitoShallow.data.orderProductsByOrderNumber = undefined;
      }

      if (!input.events) {
        monolitoShallow.events = undefined;
      }

      if (!input.eventsByProductCode) {
        monolitoShallow.eventsByProductCode = undefined;
      }

      return monolitoShallow;
    }),
  getMEventsByProductCode: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).eventsByProductCode;
  }),
  getMProviders: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.providers;
  }),
  getMAssemblyById: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.assemblyById;
  }),
  getMBudgetProducts: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.budget_products;
  }),
  getMBudgetsById: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.budgetsById;
  }),
  getMCrmClients: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.crm_clients;
  }),
  getMBudgets: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.budgets;
  }),
  getMSold: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.sold;
  }),
  getMClients: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.clients;
  }),
  getMProductsDefault: protectedProcedure.query(async () => {
    const res = (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.products;
    return res.map((v) => {
      const k = { ...v };
      k.supplies = undefined;
      k.suppliesOf = undefined;
      k.events = undefined;
      k.events_by_month = undefined;
      return k;
    });
  }),
  getMProductsWSuppliesOf: protectedProcedure.query(async () => {
    const res = (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.products;
    return res.map((v) => {
      const k = { ...v };
      k.supplies = undefined;
      k.events = undefined;
      k.events_by_month = undefined;
      return k;
    });
  }),
  getMProductsWSupplies: protectedProcedure.query(async () => {
    const res = (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.products;
    return res.map((v) => {
      const k = { ...v };
      k.suppliesOf = undefined;
      k.events = undefined;
      k.events_by_month = undefined;
      return k;
    });
  }),
  getMProvidersByCode: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.providersByCode;
  }),
  getMOrderProductsById: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.orderProductsById;
  }),
  getMOrdersByOrderNumber: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.ordersByOrderNumber;
  }),
  getMOrderProductsByProductCode: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.orderProductsByProductCode;
  }),
  getMOrderProductsByOrderNumber: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.orderProductsByOrderNumber;
  }),
  getMProductImportsById: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.productImportsById;
  }),
  getMImportsById: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.importsById;
  }),
  getMClientsByCode: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.clientsByCode;
  }),
  getMProductsByCode: protectedProcedure.query(async () => {
    return (await cachedAsyncFetch("monolito-base", defaultCacheTtl, async () => await getMonolitoBase())).data.productsByCode;
  }),
});

type NestedKeys<T extends string, U extends string[]> = {
  [K in keyof U]: U[K] extends `${T}.${infer V}` ? V : never;
};

type PartialExcept<T, U extends string[]> = {
  [K in keyof T as K extends U[number] ? K : never]?: T[K];
} & {
  [K in keyof T as K extends U[number] ? never : K]: K extends string ? PartialExcept<T[K], NestedKeys<K, U>> : T[K];
};

export type MonolitoProduct = NonNullable<RouterOutputs["db"]["getMonolito"]["data"]["products"]>[0];

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
import { type ForecastProfile } from "~/mrp_data/transform_mrp_data";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { forecastProfiles } from "~/server/db/schema";
import { getServerAuthSession } from "~/server/auth";
import { nullProfile } from "~/lib/nullForecastProfile";
import { getMonths } from "~/lib/utils";
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

    const data = await cachedAsyncFetch(
      `monolito-base-${session?.user.id ?? ""}`,
      defaultCacheTtl,
      async () => await getMonolitoBase(session?.user.id ?? ""),
    );
    const forecastData = await queryForecastData(forecastProfile, data);
    return forecastData;
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

    const data = await cachedAsyncFetch(
      `monolito-base-${session?.user.id ?? ""}`,
      defaultCacheTtl,
      async () => await getMonolitoBase(session?.user.id ?? ""),
    );
    const forecastData = await queryForecastData(forecastProfile, data);

    return {
      forecastData,
      eventsByProductCode: data.eventsByProductCode,
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
      const session = await getServerAuthSession();
      const monolito = await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      );
      const monolitoShallow: PartialExcept<
        typeof monolito,
        [
          "products",
          "products.events",
          "forecastData",
          "budgets",
          "budgetsById",
          "eventsByProductCode",
          "eventsOfProductsByMonth",
          "events",
          "sold",
          "clients",
          "ordersByOrderNumber",
          "orderProductsByOrderNumber",
          "orderProductsByProductCode",
          "clientsByCode",
          "assemblyById",
          "productsByCode",
          "providersByCode",
          "crm_clients",
          "productImportsById",
          "orderProductsById",
          "importsById",
          "providers",
          "budget_products",
        ]
      > = {
        ...monolito,
      };

      if (input.data.products === undefined) {
        monolitoShallow.products = undefined;
      } else {
        monolitoShallow.products = monolito.products.map((v) => {
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
        monolitoShallow.budgetsById = undefined;
      }

      if (!input.data.sold) {
        monolitoShallow.sold = undefined;
      }

      if (!input.data.clients) {
        monolitoShallow.clients = undefined;
      }

      if (!input.data.budgets) {
        monolitoShallow.budgets = undefined;
      }

      if (!input.data.events) {
        monolitoShallow.events = undefined;
      }

      if (!input.data.orderProductsById) {
        monolitoShallow.orderProductsById = undefined;
      }

      if (!input.data.productImportsById) {
        monolitoShallow.productImportsById = undefined;
      }

      if (!input.data.budget_products) {
        monolitoShallow.budget_products = undefined;
      }

      if (!input.data.providers) {
        monolitoShallow.providers = undefined;
      }

      if (!input.data.clientsByCode) {
        monolitoShallow.clientsByCode = undefined;
      }

      if (!input.data.importsById) {
        monolitoShallow.importsById = undefined;
      }

      if (!input.data.assemblyById) {
        monolitoShallow.assemblyById = undefined;
      }

      if (!input.data.productsByCode) {
        monolitoShallow.productsByCode = undefined;
      }

      if (!input.data.eventsByProductCode) {
        monolitoShallow.eventsByProductCode = undefined;
      }

      if (!input.data.crm_clients) {
        monolitoShallow.crm_clients = undefined;
      }

      if (!input.data.eventsOfProductsByMonth) {
        monolitoShallow.eventsOfProductsByMonth = undefined;
      }

      if (!input.data.ordersByOrderNumber) {
        monolitoShallow.ordersByOrderNumber = undefined;
      }

      if (!input.data.orderProductsByProductCode) {
        monolitoShallow.orderProductsByProductCode = undefined;
      }

      if (!input.data.providersByCode) {
        monolitoShallow.providersByCode = undefined;
      }

      if (!input.data.orderProductsByOrderNumber) {
        monolitoShallow.orderProductsByOrderNumber = undefined;
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
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).eventsByProductCode;
  }),
  getMProviders: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).providers;
  }),
  getMAssemblyById: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).assemblyById;
  }),
  getMBudgetProducts: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).budget_products;
  }),
  getMBudgetsById: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).budgetsById;
  }),
  getMCrmClients: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).crm_clients;
  }),
  getMBudgets: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).budgets;
  }),
  getMSold: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).sold;
  }),
  getMClients: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).clients;
  }),
  getMProductsDefault: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    const res = (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).products;
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
    const session = await getServerAuthSession();
    const res = (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).products;
    return res.map((v) => {
      const k = { ...v };
      k.supplies = undefined;
      k.events = undefined;
      k.events_by_month = undefined;
      return k;
    });
  }),
  getMProductsWSupplies: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    const res = (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).products;
    return res.map((v) => {
      const k = { ...v };
      k.suppliesOf = undefined;
      k.events = undefined;
      k.events_by_month = undefined;
      return k;
    });
  }),
  getMProvidersByCode: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).providersByCode;
  }),
  getMOrderProductsById: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).orderProductsById;
  }),
  getMOrdersByOrderNumber: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).ordersByOrderNumber;
  }),
  getMOrderProductsByProductCode: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).orderProductsByProductCode;
  }),
  getMOrderProductsByOrderNumber: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).orderProductsByOrderNumber;
  }),
  getMProductImportsById: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).productImportsById;
  }),
  getMImportsById: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).importsById;
  }),
  getMClientsByCode: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).clientsByCode;
  }),
  getMProductsByCode: protectedProcedure.query(async () => {
    const session = await getServerAuthSession();
    return (
      await cachedAsyncFetch(
        `monolito-base-${session?.user.id ?? ""}`,
        defaultCacheTtl,
        async () => await getMonolitoBase(session?.user.id ?? ""),
      )
    ).productsByCode;
  }),
  getMonolitoUncached: protectedProcedure.mutation(async () => {
    const session = await getServerAuthSession();
    return await getMonolitoBase(session?.user.id ?? "");
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

export type MonolitoProduct = NonNullable<RouterOutputs["db"]["getMonolito"]["products"]>[0];
export type MonolitoProductById = NonNullable<NonNullable<RouterOutputs["db"]["getMonolito"]["productsByCode"]>["get"]>;
export type Monolito = RouterOutputs["db"]["getMonolitoUncached"];

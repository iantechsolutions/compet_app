import { getDbInstance } from "~/scripts/lib/instance";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
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

const getProductBycode = async () => {
  const products = await (await getDbInstance()).getProducts();
  const productByCode = new Map<string, Product>();
  for (const product of products) {
    productByCode.set(product.code, product);
  }

  return productByCode;
};

export const dbRouter = createTRPCRouter({
  getProducts: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProducts();
  }),
  getProductsByCode: protectedProcedure.query(async () => {
    return await getProductBycode();
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

    const productByCode = await getProductBycode();
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
        id: z.string().min(1).max(255),
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
});

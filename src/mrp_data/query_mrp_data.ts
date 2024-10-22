/* eslint-disable */
import dayjs from "dayjs";
import { getSetting } from "~/lib/settings";
import type {
  CrmBudget,
  CrmBudgetProduct,
  CrmClient,
  Order,
  OrderProductSold,
  Product,
  ProductAssembly,
  ProductImport,
  ProductProvider,
  ProductStockCommited,
} from "~/lib/types";
import { decodeData, getMonths } from "~/lib/utils";
import { DataExport } from "~/scripts/lib/database";
import { getDbInstance } from "~/scripts/lib/instance";
import { env } from "~/env";
import { api } from "~/trpc/server";

export async function queryBaseMRPData() {
  let data;
  let exportURL: string;
  let dataInfo;

  if (env.DB_DIRECT_CONNECTION) {
    const db = await getDbInstance();
    data = await db.readAllData();
    exportURL = "null";
    dataInfo = {
      exportDate: Date.now(),
    };
  } else {
    const mrpExportFile = await getSetting<string>("mrp.export-file");

    if (!mrpExportFile) {
      throw new Error(
        "No se encontró el archivo de exportación de datos. Se debe ejecutar el script `load-data`, asegurarse de configurar uploadthing correctamente.",
      );
    }

    dataInfo = await api.mrpData.mrpDataInfo.query();
    exportURL = dataInfo.exportURL;

    const dataEncoded = await fetch(exportURL).then((res) => res.text());
    data = decodeData(dataEncoded) as DataExport;
  }

  const {
    products,
    products_stock_commited,
    providers,
    product_providers,
    products_assemblies,
    imports,
    products_imports,
    orders,
    products_orders,
    clients: clients_bad,
    sold,
    products_sold,
    budgets: budgets_bad,
    budget_products,
    crm_clients: crm_clients_bad,
  } = data;

  const { budgets, clients, crm_clients } = transformClientsIdsCodes({
    budgets: budgets_bad,
    clients: clients_bad,
    crm_clients: crm_clients_bad,
  });

  const productByCode: Map<string, Product> = new Map();
  for (const product of products) {
    productByCode.set(product.code, product);
  }

  const stockCommitedByProduct: Map<string, ProductStockCommited> = new Map();
  for (const stockCommited of products_stock_commited) {
    // Por alguna razón puede haber más de una fila con el mismo código de producto
    // Por eso vamos a combinarlas
    const prev = stockCommitedByProduct.get(stockCommited.product_code) || {
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

  const productImportsByProduct: Map<string, ProductImport[]> = new Map();
  for (const productImport of products_imports) {
    const productImports = productImportsByProduct.get(productImport.product_code) ?? [];
    productImports.push(productImport);
    productImportsByProduct.set(productImport.product_code, productImports);
  }

  const suppliesOfProduct: Map<string, (ProductAssembly & { product: Product })[]> = new Map();
  const suppliesOfOfProduct: Map<string, (ProductAssembly & { product: Product })[]> = new Map();
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

  const productProivderOfProduct: Map<string, ProductProvider[]> = new Map();
  for (const productProvider of product_providers) {
    const productProviders = productProivderOfProduct.get(productProvider.product_code) ?? [];
    productProviders.push(productProvider);
    productProivderOfProduct.set(productProvider.product_code, productProviders);
  }

  const ordersByOrderNumber: Map<string, Order> = new Map();
  for (const order of orders) {
    ordersByOrderNumber.set(order.order_number, order);
  }

  const productSoldByN_COMP: Map<string, OrderProductSold[]> = new Map();
  for (const soldProduct of products_sold) {
    const orderProducts = productSoldByN_COMP.get(soldProduct.N_COMP) ?? [];
    orderProducts.push(soldProduct);
    productSoldByN_COMP.set(soldProduct.N_COMP, orderProducts);
  }

  const budgetsById: Map<number, CrmBudget> = new Map();
  for (const budget of budgets) {
    budgetsById.set(budget.budget_id, budget);
  }

  const budgetProductByBudgetId: Map<number, CrmBudgetProduct[]> = new Map();
  for (const budgetProduct of budget_products) {
    const budgetProducts = budgetProductByBudgetId.get(budgetProduct.budget_id) ?? [];
    budgetProducts.push(budgetProduct);
    budgetProductByBudgetId.set(budgetProduct.budget_id, budgetProducts);
  }

  const months = getMonths(10);

  return {
    months,
    imports,
    productImports: products_imports,
    products: products
      .map((product) => ({
        ...product,
        stock: stockCommitedByProduct.get(product.code)?.stock_quantity ?? 0,
        commited: stockCommitedByProduct.get(product.code)?.commited_quantity ?? 0,
        imports: productImportsByProduct.get(product.code) ?? [],
        supplies: suppliesOfProduct.get(product.code),
        suppliesOf: suppliesOfOfProduct.get(product.code),
        providers: productProivderOfProduct.get(product.code) ?? [],
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    stockCommitedData: products_stock_commited,
    assemblies: products_assemblies,
    providers,
    orders,
    orderProducts: products_orders.filter((orderProduct) => {
      const order = ordersByOrderNumber.get(orderProduct.order_number);
      if (!order) return false;
      if (order.state != 2) return false;
      if (order.delivery_date < dayjs("2020-01-01").toDate()) {
        return false;
      }
      return true;
    }),
    clients,
    sold: sold.map((sold) => ({
      ...sold,
      products: productSoldByN_COMP.get(sold.N_COMP) ?? [],
    })),
    products_sold,

    budgetsById,
    budgets: budgets.map((budget) => ({
      ...budget,
      products: budgetProductByBudgetId.get(budget.budget_id) ?? [],
    })),
    budget_products,
    crm_clients,

    dataExportUrl: exportURL,
    dataExportDate: dataInfo.exportDate,
  };
}

export function transformClientsIdsCodes({
  budgets,
  clients,
  crm_clients,
}: Pick<DataExport, "crm_clients" | "clients" | "budgets">): Pick<DataExport, "crm_clients" | "clients" | "budgets"> {
  const clientsByCode: Map<string, (typeof clients)[number]> = new Map();

  for (const client of clients) {
    clientsByCode.set(client.code, client);
  }

  const clientIdMap: Map<string, string> = new Map();

  for (const c of crm_clients) {
    const code = clientsByCode.get(c.tango_code)?.code;

    if (!code) {
      continue;
    }

    clientIdMap.set(c.client_id.toString(), code);
  }

  return {
    budgets: budgets.map((budget) => ({
      ...budget,
      // Id del tango o el original (si el crm no conoce el id del tango)
      client_id: clientIdMap.get(budget.client_id.toString()) ?? budget.client_id.toString(),
    })),
    clients,
    crm_clients: crm_clients.map((crm_client) => ({
      ...crm_client,
      // Id del tango o el original (si el crm no conoce el id del tango)
      client_id: clientIdMap.get(crm_client.client_id.toString()) ?? crm_client.client_id.toString(),
    })),
  };
}

export function simplifyName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(\d+)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export type RawMRPData = Awaited<ReturnType<typeof queryBaseMRPData>>;

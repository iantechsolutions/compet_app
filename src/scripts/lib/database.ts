import sql from "mssql";
import {
  clientSchema,
  crmBudgetProductSchema,
  crmBudgetSchema,
  crmClientSchema,
  importSchema,
  orderAndOrderProdSchema,
  orderProductSchema,
  orderProductSoldSchema,
  orderProductWProductSchema,
  orderSchema,
  orderSoldSchema,
  productAssemblyAndProductSchema,
  productAssemblySchema,
  productCodeSchema,
  productImportSchema,
  productProviderSchema,
  productSchema,
  productStockCommitedSchema,
  providerSchema,
  stockMovementSchema,
} from "../../lib/types";
import { z } from "zod";
import { soldProductsQuery, soldProductsQueryByCode, soldQuery } from "./large-queries";
import { cachedAsyncFetch } from "../../lib/cache";
import { env } from "../../env";
import { queryBaseMRPDataUT } from "../../serverfunctions";

const defaultConnectionQuery =
  process.env.CONNECTION_QUERY ??
  `Server=COMPET01\\AXSQLEXPRESS;DSN=Axoft;Description=Axoft;UID=Axoft;PWD=Axoft;APP=Microsoft Office XP;WSID=GERNOTE;DATABASE=Compet_SA;Network=DBNM;Encrypt=false;Connection Timeout=60`;
export type DataExport = Awaited<ReturnType<InstanceType<typeof Database>["readAllDataDirect"]>>;
export const defaultCacheTtl = 1000 * 60 * 6;

export class Database {
  private SQL_CONNECTION_POOL: sql.ConnectionPool | null = null;

  private assertConnected(): sql.ConnectionPool {
    if (this.SQL_CONNECTION_POOL === null) {
      throw new Error("Database.assertConnected failed");
    }

    return this.SQL_CONNECTION_POOL;
  }

  public async open(connectionQuery?: string) {
    this.SQL_CONNECTION_POOL = await sql.connect(connectionQuery ?? defaultConnectionQuery);
  }

  private async runQuery(query: string): Promise<Record<string, unknown>[]> {
    return (await this.assertConnected().query(query)).recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
  }

  private static trimAllProperties(obj: Record<string, unknown>): Record<string, unknown> {
    for (const prop in obj) {
      if (typeof obj[prop] === "string") {
        obj[prop] = obj[prop].trim();
      }
    }
    return obj;
  }

  private async fetchTableWithQuery<T extends z.Schema>(query: string, schema: T, virtualId = false) {
    let rows = await this.runQuery(query);
    if (virtualId) {
      rows = rows.map((row, index) => ({ ...row, id: index + 1 }));
    }

    const arraySchema = z.array(schema);
    return arraySchema.parse(rows);
  }

  public async readAllData(cacheTtl?: number, forceCache = false) {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT(cacheTtl, forceCache);
      return {
        ...r.data,
        stock_movements: [],
      };
    } else {
      return await this.readAllDataDirect(cacheTtl, forceCache);
    }
  }

  public async readAllDataUT(cacheTtl?: number, forceCache = false) {
    return cachedAsyncFetch("db-readAllDataUT", cacheTtl ?? defaultCacheTtl, async () => await queryBaseMRPDataUT(), forceCache);
  }

  public async readAllDataDirect(cacheTtl?: number, forceCache = false) {
    const start = Date.now();
    const [
      products,
      products_stock_commited,
      providers,
      product_providers,
      products_assemblies,
      imports,
      products_imports,
      orders,
      products_orders,
      clients,
      sold,
      products_sold,
      budgets,
      budget_products,
      crm_clients,
      stock_movements
    ] = await Promise.all([
      this.getProducts(cacheTtl, forceCache),
      this.getCommitedStock(cacheTtl, forceCache),
      this.getProviders(cacheTtl, forceCache),
      this.getProductProviders(cacheTtl, forceCache),
      this.getAssemblies(cacheTtl, forceCache),
      this.getImports(cacheTtl, forceCache),
      this.getProductImports(cacheTtl, forceCache),
      this.getOrders(cacheTtl, forceCache),
      this.getProductsOrders(cacheTtl, forceCache),
      this.getClients(cacheTtl, forceCache),
      this.getSold(cacheTtl, forceCache),
      this.getProductsSold(cacheTtl, forceCache),
      this.getBudgets(cacheTtl, forceCache),
      this.getBudgetProducts(cacheTtl, forceCache),
      this.getCrmClients(cacheTtl, forceCache),
      this.getStockMovements(cacheTtl, forceCache)
    ]);

    const productsFiltered = products.filter((product) => !(product.code.startsWith("A000") || product.code.startsWith("Z000")));
    const end = Date.now();

    console.log(`Database.readAllData elapsed ${end - start}ms`);

    return {
      products: productsFiltered,
      products_stock_commited,
      providers,
      product_providers,
      products_assemblies,
      imports,
      products_imports,
      orders,
      products_orders,
      clients,
      sold,
      products_sold,
      budgets,
      budget_products,
      crm_clients,
      stock_movements
    };
  }

  public async getProducts(cacheTtl?: number, forceCache = false): Promise<(typeof productSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products;
    }

    return await cachedAsyncFetch(
      "db-getProducts",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
            COD_ARTICU as code,
            DESCRIPCIO as description,
            DESC_ADIC as additional_description
            FROM STA11`,
          productSchema,
        );
      },
      forceCache,
    );
  }

  public async getProductCodes(cacheTtl?: number, forceCache = false): Promise<(typeof productCodeSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products;
    }

    return await cachedAsyncFetch(
      "db-getProducts",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
            COD_ARTICU as code
            FROM STA11`,
          productCodeSchema,
        );
      },
      forceCache,
    );
  }

  public async getProductByCode(code: string): Promise<(typeof productSchema)["_output"] | undefined> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products.find((v) => v.code === code)!;
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`SELECT
                COD_ARTICU as code,
                DESCRIPCIO as description,
                DESC_ADIC as additional_description
                FROM STA11
                WHERE COD_ARTICU = @code`);

    const records = rows.recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
    const arraySchema = z.array(productSchema);
    return arraySchema.parse(records)[0];
  }

  public async getCommitedStock(cacheTtl?: number, forceCache = false): Promise<(typeof productStockCommitedSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_stock_commited;
    }

    return await cachedAsyncFetch(
      "db-getCommitedStock",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
          COD_ARTICU as product_code,
          CANT_STOCK as stock_quantity,
          CANT_COMP as commited_quantity,
          CANT_PEND as pending_quantity,
          FECHA_ANT as last_update
          FROM STA19`,
          productStockCommitedSchema,
        );
      },
      forceCache,
    );
  }

  public async getCommitedStockByCode(code: string): Promise<(typeof productStockCommitedSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_stock_commited.filter((v) => v.product_code === code);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT
      COD_ARTICU as product_code,
      CANT_STOCK as stock_quantity,
      CANT_COMP as commited_quantity,
      CANT_PEND as pending_quantity,
      FECHA_ANT as last_update
      FROM STA19
      WHERE COD_ARTICU = @code`);

    const records = rows.recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
    const arraySchema = z.array(productStockCommitedSchema);
    return arraySchema.parse(records);
  }

  public async getProviders(cacheTtl?: number, forceCache = false): Promise<(typeof providerSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.providers;
    }

    return await cachedAsyncFetch(
      "db-getProviders",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
                COD_PROVEE as code, NOM_PROVEE as name, TELEFONO_1 as phone, 
                LOCALIDAD as city, C_POSTAL as zip_code, DOMICILIO as address FROM CPA01`,
          providerSchema,
        );
      },
      forceCache,
    );
  }

  public async getProductProviders(cacheTtl?: number, forceCache = false): Promise<(typeof productProviderSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.product_providers;
    }

    return await cachedAsyncFetch(
      "db-getProductProviders",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT COD_ARTICU product_code, COD_PROVEE as provider_code, COD_SINONI as provider_product_code FROM CPA15`,
          productProviderSchema,
        );
      },
      forceCache,
    );
  }

  public async getAssemblies(cacheTtl?: number, forceCache = false): Promise<(typeof productAssemblySchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_assemblies;
    }

    return await cachedAsyncFetch(
      "db-getAssemblies",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT COD_ARTICU as product_code,
          COD_INSUMO as supply_product_code,
          CANT_NETA as quantity FROM STA03`,
          productAssemblySchema,
          true,
        );
      },
      forceCache,
    );
  }

  public async getAssembliesAndSuppliesByCode(code: string): Promise<(typeof productAssemblyAndProductSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_assemblies
        .filter((v) => v.product_code === code)
        .map((k) => {
          const prod = r.data.products.find((p) => p.code === k.supply_product_code)!;
          return {
            additional_description: prod.additional_description,
            code: prod.code,
            description: prod.description,
            id: k.id,
            product_code: k.product_code,
            quantity: k.quantity,
            supply_product_code: k.supply_product_code,
          };
        });
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT
      STA03.COD_ARTICU as product_code,
      STA03.COD_INSUMO as supply_product_code,
      STA03.CANT_NETA as quantity,
      STA11.DESC_ADIC as additional_description,
      STA11.DESCRIPCIO as description,
      STA11.COD_ARTICU as code
      FROM STA03
      LEFT JOIN STA11
      ON STA11.COD_INSUMO = STA03.COD_ARTICU
      WHERE STA03.COD_ARTICU = @code`);

    const records = rows.recordset
      .map((k) => Database.trimAllProperties(k as Record<string, unknown>))
      .map((row, index) => ({ ...row, id: index + 1 }));

    const arraySchema = z.array(productAssemblyAndProductSchema);
    return arraySchema.parse(records);
  }

  public async getImports(cacheTtl?: number, forceCache = false): Promise<(typeof importSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.imports;
    }

    return await cachedAsyncFetch(
      "db-getImports",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT 
                ID_CARPETA as id,
                COD_PROVEE as provider_code,
                HABILITADA as enabled,
                FEC_APERT as opening_date,
                FEC_VIGENC as validity_date,
                MON_ORIGEN as origin_currency,
                PAIS as country,
                OBSERVACIO as observations,
                COTIZ as dollar_price,
                LEYENDA1 as legend1,
                LEYENDA2 as legend2,
                LEYENDA3 as legend3
                FROM CPA65`,
          importSchema,
        );
      },
      forceCache,
    );
  }

  public async getProductImports(cacheTtl?: number, forceCache = false): Promise<(typeof productImportSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_imports;
    }

    return await cachedAsyncFetch(
      "db-getProductImports",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT 
          ID_CARPETA as import_id,
          COD_ARTICU as product_code,
          CANT_PEDID as ordered_quantity,
          CERRADO as closed,
          FEC_EMBARC as shipping_date,
          FEC_NACION as national_date,
          FEC_P_PUER as arrival_date,
          CANT_NACIO as national_quantity
          FROM CPA66 WHERE CANT_NACIO = 0 AND CERRADO = 0 AND COD_ARTICU <> ''`,
          productImportSchema,
          true,
        );
      },
      forceCache,
    );
  }

  public async getProductImportsByCode(code: string): Promise<(typeof productImportSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_imports.filter((k) => k.product_code === code);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT 
      ID_CARPETA as import_id,
      COD_ARTICU as product_code,
      CANT_PEDID as ordered_quantity,
      CERRADO as closed,
      FEC_EMBARC as shipping_date,
      FEC_NACION as national_date,
      FEC_P_PUER as arrival_date,
      CANT_NACIO as national_quantity
      FROM CPA66 WHERE CANT_NACIO = 0 AND CERRADO = 0 AND COD_ARTICU = @code`);

    const records = rows.recordset
      .map((k) => Database.trimAllProperties(k as Record<string, unknown>))
      .map((row, index) => ({ ...row, id: index + 1 }));
    const arraySchema = z.array(productImportSchema);
    return arraySchema.parse(records);
  }

  public async getOrders(cacheTtl?: number, forceCache = false): Promise<(typeof orderSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.orders;
    }

    return await cachedAsyncFetch(
      "db-getOrders",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
                NRO_PEDIDO as order_number,
                APRUEBA as approved_by,
                COD_CLIENT as client_code,
                FECHA_APRU as approval_date,
                FECHA_ENTR as delivery_date,
                FECHA_PEDI as order_date,
                FECHA_INGRESO as entry_date,
                N_REMITO as remito_number,
                ESTADO as state
                FROM GVA21`,
          orderSchema,
        );
      },
      forceCache,
    );
  }

  public async getOrdersAndProdOrdersByCode(code: string): Promise<(typeof orderAndOrderProdSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.orders
        .map((k) => {
          const prod_order = r.data.products_orders.find((v) => v.order_number === k.order_number)!;
          return {
            ...k,
            product_code: prod_order.product_code,
            ordered_quantity: prod_order.ordered_quantity,
            id: prod_order.id,
          };
        })
        .filter((a) => a.product_code === code);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT
      GVA21.NRO_PEDIDO as order_number,
      GVA21.APRUEBA as approved_by,
      GVA21.COD_CLIENT as client_code,
      GVA21.FECHA_APRU as approval_date,
      GVA21.FECHA_ENTR as delivery_date,
      GVA21.FECHA_PEDI as order_date,
      GVA21.FECHA_INGRESO as entry_date,
      GVA21.N_REMITO as remito_number,
      GVA21.ESTADO as state,
      GVA03.COD_ARTICU as product_code,
      GVA03.CANT_PEN_D as ordered_quantity
      FROM GVA21
      INNER JOIN GVA03
      ON GVA21.NRO_PEDIDO = GVA03.NRO_PEDIDO
      WHERE GVA21.COD_ARTICU = @code`);

    const records = rows.recordset
      .map((k) => Database.trimAllProperties(k as Record<string, unknown>))
      .map((row, index) => ({ ...row, id: index + 1 }));

    const arraySchema = z.array(orderAndOrderProdSchema);
    return arraySchema.parse(records);
  }

  public async getOrdersAndProdOrders(cacheTtl?: number, forceCache = false): Promise<(typeof orderAndOrderProdSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.orders.map((k) => {
        const prod_order = r.data.products_orders.find((v) => v.order_number === k.order_number)!;
        return {
          ...k,
          product_code: prod_order.product_code,
          ordered_quantity: prod_order.ordered_quantity,
          id: prod_order.id,
        };
      });
    }

    return await cachedAsyncFetch(
      "db-getOrdersAndProdOrders",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
          GVA21.NRO_PEDIDO as order_number,
          GVA21.APRUEBA as approved_by,
          GVA21.COD_CLIENT as client_code,
          GVA21.FECHA_APRU as approval_date,
          GVA21.FECHA_ENTR as delivery_date,
          GVA21.FECHA_PEDI as order_date,
          GVA21.FECHA_INGRESO as entry_date,
          GVA21.N_REMITO as remito_number,
          GVA21.ESTADO as state,
          GVA03.COD_ARTICU as product_code,
          GVA03.CANT_PEN_D as ordered_quantity
          FROM GVA21
          INNER JOIN GVA03
          ON GVA21.NRO_PEDIDO = GVA03.NRO_PEDIDO`,
          orderAndOrderProdSchema,
          true,
        );
      },
      forceCache,
    );
  }

  public async getOrderByNumber(ord: string): Promise<(typeof orderSchema)["_output"] | undefined> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.orders.find((v) => v.order_number === ord);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, ord).query(`SELECT
                NRO_PEDIDO as order_number,
                APRUEBA as approved_by,
                COD_CLIENT as client_code,
                FECHA_APRU as approval_date,
                FECHA_ENTR as delivery_date,
                FECHA_PEDI as order_date,
                FECHA_INGRESO as entry_date,
                N_REMITO as remito_number,
                ESTADO as state
                FROM GVA21
                WHERE NRO_PEDIDO = @code`);

    const records = rows.recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
    const arraySchema = z.array(orderSchema);
    return arraySchema.parse(records).at(0);
  }

  public async getOrder(cacheTtl?: number, forceCache = false): Promise<(typeof orderSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.orders;
    }

    return await cachedAsyncFetch(
      "db-getOrders",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
                NRO_PEDIDO as order_number,
                APRUEBA as approved_by,
                COD_CLIENT as client_code,
                FECHA_APRU as approval_date,
                FECHA_ENTR as delivery_date,
                FECHA_PEDI as order_date,
                FECHA_INGRESO as entry_date,
                N_REMITO as remito_number,
                ESTADO as state
                FROM GVA21`,
          orderSchema,
        );
      },
      forceCache,
    );
  }

  public async getProductsOrders(cacheTtl?: number, forceCache = false): Promise<(typeof orderProductSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_orders;
    }

    return await cachedAsyncFetch(
      "db-getProductsOrders",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
            NRO_PEDIDO as order_number,
            COD_ARTICU as product_code,
            CANT_PEN_D as ordered_quantity
            FROM GVA03`,
          orderProductSchema,
          true,
        );
      },
      forceCache,
    );
  }

  public async getProductsOrdersByCode(code: string): Promise<(typeof orderProductSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_orders.filter((k) => k.product_code === code);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT
      NRO_PEDIDO as order_number,
      COD_ARTICU as product_code,
      CANT_PEN_D as ordered_quantity
      FROM GVA03
      WHERE COD_ARTICU = @code`);

    const records = rows.recordset
      .map((k) => Database.trimAllProperties(k as Record<string, unknown>))
      .map((row, index) => ({ ...row, id: index + 1 }));
    const arraySchema = z.array(orderProductSchema);
    return arraySchema.parse(records);
  }

  public async getProductsOrdersByOrderNumber(code: string): Promise<(typeof orderProductWProductSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_orders
        .filter((k) => k.order_number === code)
        .map((v) => {
          const product = r.data.products.find((n) => n.code === v.product_code)!;
          return { ...v, ...product };
        });
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT
      GVA03.NRO_PEDIDO as order_number,
      GVA03.COD_ARTICU as product_code,
      GVA03.CANT_PEN_D as ordered_quantity,
      STA11.COD_ARTICU as code,
      STA11.DESCRIPCIO as description,
      STA11.DESC_ADIC as additional_description
      FROM GVA03
      INNER JOIN STA11
      ON GVA03.COD_ARTICU = STA11.COD_ARTICU
      WHERE GVA03.NRO_PEDIDO = @code`);

    const records = rows.recordset
      .map((k) => Database.trimAllProperties(k as Record<string, unknown>))
      .map((row, index) => ({ ...row, id: index + 1 }));
    const arraySchema = z.array(orderProductWProductSchema);
    return arraySchema.parse(records);
  }

  public async getClients(cacheTtl?: number, forceCache = false): Promise<(typeof clientSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.clients;
    }

    return await cachedAsyncFetch(
      "db-getClients",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
          COD_CLIENT as code,
          CUIT as cuit,
          NOM_COM as name,
          RAZON_SOCI as business_name,
          OBSERVACIO as observations,
          TELEFONO_1 as phone,
          MAIL_DE as email,
          WEB as web,
          N_IMPUESTO as tax_type,
          LOCALIDAD as city,
          DOMICILIO as address
          FROM GVA14`,
          clientSchema,
        );
      },
      forceCache,
    );
  }

  public async getClientByCode(code: string): Promise<(typeof clientSchema)["_output"] | undefined> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.clients.find((v) => v.code === code);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(`
      SELECT
      COD_CLIENT as code,
      CUIT as cuit,
      NOM_COM as name,
      RAZON_SOCI as business_name,
      OBSERVACIO as observations,
      TELEFONO_1 as phone,
      MAIL_DE as email,
      WEB as web,
      N_IMPUESTO as tax_type,
      LOCALIDAD as city,
      DOMICILIO as address
      FROM GVA14
      WHERE COD_CLIENT = @code`);

    const records = rows.recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
    const arraySchema = z.array(clientSchema);
    return arraySchema.parse(records).at(0);
  }


  // "comprobantes de cuenta corriente" GVA12
  public async getSold(cacheTtl?: number, forceCache = false): Promise<(typeof orderSoldSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.sold;
    }

    return await cachedAsyncFetch(
      "db-getSold",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(soldQuery, orderSoldSchema);
      },
      forceCache,
    );
  }

  // "renglones de comprobantes de facturación" GVA53
  public async getProductsSold(cacheTtl?: number, forceCache = false): Promise<(typeof orderProductSoldSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_sold;
    }

    return await cachedAsyncFetch(
      "db-getProductsSold",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(soldProductsQuery, orderProductSoldSchema);
      },
      forceCache,
    );
  }

  public async getProductsSoldByCode(code: string): Promise<(typeof orderProductSoldSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.products_sold.filter((v) => v.product_code === code);
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, code).query(soldProductsQueryByCode);

    const records = rows.recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
    const arraySchema = z.array(orderProductSoldSchema);
    return arraySchema.parse(records);
  }

  public async getBudgets(cacheTtl?: number, forceCache = false): Promise<(typeof crmBudgetSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.budgets;
    }

    return await cachedAsyncFetch(
      "db-getBudgets",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
                ID_Presupuesto as budget_id,
                ID_Cliente as client_id,
                ID_Categoria as category_id,
                Fecha_Entrega as date,
                FechaVigencia as validity_date,
                Finalizada as finished_date,
                Prox_Contacto as next_contact_date,
                FechaUltimoCambio as last_update,
                Comentarios as comments
                FROM CRM_PRESUPUESTOS`,
          crmBudgetSchema,
        );
      },
      forceCache,
    );
  }

  public async getBudgetById(id: number): Promise<(typeof crmBudgetSchema)["_output"] | undefined> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.budgets.find((v) => v.budget_id === id)!;
    }

    const rows = await this.assertConnected().request().input("code", sql.VarChar, id).query(`SELECT
                ID_Presupuesto as budget_id,
                ID_Cliente as client_id,
                ID_Categoria as category_id,
                Fecha_Entrega as date,
                FechaVigencia as validity_date,
                Finalizada as finished_date,
                Prox_Contacto as next_contact_date,
                FechaUltimoCambio as last_update,
                Comentarios as comments
                FROM CRM_PRESUPUESTOS
                WHERE ID_Presupuesto = @code`);

    const records = rows.recordset.map((k) => Database.trimAllProperties(k as Record<string, unknown>));
    const arraySchema = z.array(crmBudgetSchema);
    return arraySchema.parse(records)[0];
  }

  public async getBudgetProducts(cacheTtl?: number, forceCache = false): Promise<(typeof crmBudgetProductSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.budget_products;
    }

    return await cachedAsyncFetch(
      "db-getBudgetProducts",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT 
                ID_PresupuestoDetalle as budget_products_id,
                ID_Presupuesto as budget_id,
                Cod_Articu as product_code,
                Descripcion as description,
                Cantidad as quantity,
                CantidadPendiente as pending_quantity,
                FechaAltaRenglon as creation_date
                FROM CRM_PresupuestosDetalles`,
          crmBudgetProductSchema,
        );
      },
      forceCache,
    );
  }

  public async getCrmClients(cacheTtl?: number, forceCache = false): Promise<(typeof crmClientSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      const r = await this.readAllDataUT();
      return r.data.crm_clients;
    }

    return await cachedAsyncFetch(
      "db-getCrmClients",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
                ID_Cliente as client_id,
                RazonSocial as business_name,
                NombreFantasia as name,
                Domicilio as address,
                Localidad as city,
                Provincia as province,
                CP as zip_code,
                Email as email,
                Cod_Tango as tango_code,
                Comentarios as comments,
                CUIT as cuit,
                Telef1 as phone1,
                FechaAlta as creation_date,
                FechaUltimaModificacion as last_update,
                HorarioAten as attention_schedule,
                Estado as state
                FROM CRM_CLIENTES`,
          crmClientSchema,
        );
      },
      forceCache,
    );
  }

  public async getStockMovements(cacheTtl?: number, forceCache = false): Promise<(typeof stockMovementSchema)["_output"][]> {
    if (!env.DB_DIRECT_CONNECTION) {
      // const r = await this.readAllDataUT();
      console.error('getStockMovements not implemented for UT');
      return [];
    }

    return await cachedAsyncFetch(
      "db-getStockMovements",
      cacheTtl ?? defaultCacheTtl,
      async () => {
        return await this.fetchTableWithQuery(
          `SELECT
           STA20.CANTIDAD as c,
           STA20.COD_ARTICU as p,
           STA20.FECHA_MOV as f,
           STA20.TIPO_MOV t
           FROM
           Compet_SA.dbo.STA20 STA20,
           Compet_SA.dbo.STA14 STA14
           WHERE
           STA14.ID_STA14 = STA20.ID_STA14
           AND STA20.COD_ARTICU <> ''
           AND STA20.TCOMP_IN_S IS NOT NULL
           AND STA20.FECHA_MOV IS NOT NULL
            `,
          stockMovementSchema,
        );
      },
      forceCache,
    );
  }
}

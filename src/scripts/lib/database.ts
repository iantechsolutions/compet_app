import "server-only";
import sql from "mssql";
import {
  clientSchema,
  crmBudgetProductSchema,
  crmBudgetSchema,
  crmClientSchema,
  importSchema,
  orderProductSchema,
  orderProductSoldSchema,
  orderSchema,
  orderSoldSchema,
  productAssemblySchema,
  productImportSchema,
  productProviderSchema,
  productSchema,
  productStockCommitedSchema,
  providerSchema,
} from "~/lib/types";
import { z } from "zod";
import { soldProductsQuery, soldQuery } from "./large-queries";
import { cachedAsyncFetch } from "~/lib/cache";
import { env } from "~/env";
import { queryBaseMRPDataUT } from "~/serverfunctions";

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
      return r.data;
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
          `SELECT COD_ARTICU as product_code, COD_INSUMO as supply_product_code, CANT_NETA as quantity FROM STA03`,
          productAssemblySchema,
          true,
        );
      },
      forceCache,
    );
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

    const rows = await this.assertConnected().request().input("code", sql.Int, id).query(`SELECT
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
}

import 'server-only';
import sql from "mssql";
import { clientSchema, crmBudgetProductSchema, crmBudgetSchema, crmClientSchema, importSchema, orderProductSchema, orderProductSoldSchema, orderSchema, orderSoldSchema, productAssemblySchema, productImportSchema, productProviderSchema, productSchema, productStockCommitedSchema, providerSchema } from "~/lib/types";
import { z } from "zod";
import { soldProductsQuery, soldQuery } from "./large-queries";

const defaultConnectionQuery =
  process.env.CONNECTION_QUERY ?? `Server=COMPET01\\AXSQLEXPRESS;DSN=Axoft;Description=Axoft;UID=Axoft;PWD=Axoft;APP=Microsoft Office XP;WSID=GERNOTE;DATABASE=Compet_SA;Network=DBNM;Encrypt=false;Connection Timeout=60`;
export type DataExport = Awaited<ReturnType<InstanceType<typeof Database>['readAllData']>>;

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

    public async readAllData(opts?: { log: (...args: unknown[]) => unknown }) {
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
            this.getProducts(),
            this.getCommitedStock(),
            this.getProviders(),
            this.getProductProviders(),
            this.getAssemblies(),
            this.getImports(),
            this.getProductImports(),
            this.getOrders(),
            this.getProductsOrders(),
            this.getClients(),
            this.getSold(),
            this.getProductsSold(),
            this.getBudgets(),
            this.getBudgetProducts(),
            this.getCrmClients()
        ]);

        const productsFiltered = products.filter((product) => product.code.startsWith("A000") || product.code.startsWith("Z000"));
        const end = Date.now();

        (opts?.log ?? console.log)(`Database.readAllData elapsed ${end - start}ms`);

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

    public async getProducts(): Promise<typeof productSchema["_output"][]> {
        return await this.fetchTableWithQuery(
            `SELECT
            COD_ARTICU as code,
            DESCRIPCIO as description,
            DESC_ADIC as additional_description
            FROM STA11`,
            productSchema,
        );
    }

    public async getCommitedStock(): Promise<typeof productStockCommitedSchema["_output"][]> {
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
    }

    public async getProviders(): Promise<typeof providerSchema["_output"][]> {
        return await this.fetchTableWithQuery(
            `SELECT
            COD_PROVEE as code, NOM_PROVEE as name, TELEFONO_1 as phone, 
            LOCALIDAD as city, C_POSTAL as zip_code, DOMICILIO as address FROM CPA01`,
            providerSchema,
        );
    }

    public async getProductProviders(): Promise<typeof productProviderSchema["_output"][]> {
        return await this.fetchTableWithQuery(
            `SELECT COD_ARTICU product_code, COD_PROVEE as provider_code, COD_SINONI as provider_product_code FROM CPA15`,
            productProviderSchema,
        );
    }

    public async getAssemblies(): Promise<typeof productAssemblySchema["_output"][]> {
        return await this.fetchTableWithQuery(
            `SELECT COD_ARTICU as product_code, COD_INSUMO as supply_product_code, CANT_NETA as quantity FROM STA03`,
            productAssemblySchema,
            true,
        );
    }

    public async getImports(): Promise<typeof importSchema["_output"][]> {
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
    }

    public async getProductImports(): Promise<typeof productImportSchema["_output"][]> {
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
    }

    public async getOrders(): Promise<typeof orderSchema["_output"][]> {
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
    }

    public async getProductsOrders(): Promise<typeof orderProductSchema["_output"][]> {
        return await this.fetchTableWithQuery(
            `SELECT
            NRO_PEDIDO as order_number,
            COD_ARTICU as product_code,
            CANT_PEN_D as ordered_quantity
            FROM GVA03`,
            orderProductSchema,
            true,
        );
    }

    public async getClients(): Promise<typeof clientSchema["_output"][]> {
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
    }

    public async getSold(): Promise<typeof orderSoldSchema["_output"][]> {
        return await this.fetchTableWithQuery(soldQuery, orderSoldSchema);
    }

    public async getProductsSold(): Promise<typeof orderProductSoldSchema["_output"][]> {
        return await this.fetchTableWithQuery(soldProductsQuery, orderProductSoldSchema);
    }

    public async getBudgets(): Promise<typeof crmBudgetSchema["_output"][]> {
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
    }

    public async getBudgetProducts(): Promise<typeof crmBudgetProductSchema["_output"][]> {
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
    }

    public async getCrmClients(): Promise<typeof crmClientSchema["_output"][]> {
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
    }
}
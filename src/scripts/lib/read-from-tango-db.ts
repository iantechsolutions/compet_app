import sql from "mssql";
import { z } from "zod";
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
import { soldProductsQuery, soldQuery } from "./large-queries";

const connectionQuery =
  process.env.CONNECTION_QUERY ||
  `Server=COMPET01\\AXSQLEXPRESS;DSN=Axoft;Description=Axoft;UID=Axoft;PWD=Axoft;APP=Microsoft Office XP;WSID=GERNOTE;DATABASE=Compet_SA;Network=DBNM;Encrypt=false;Connection Timeout=60`;

export async function runQuery(query: string) {
  return (await sql.query(query)).recordset.map(trimmAllProperties) as Record<string, any>[];
}

export async function fetchTableWithQuery<T extends z.Schema>(query: string, schema: T, virtualId = false) {
  let rows = await runQuery(query);

  if (virtualId) {
    rows = rows.map((row, index) => ({ ...row, id: index + 1 }));
  }

  const arraySchema = z.array(schema);

  return arraySchema.parse(rows);
}

export function trimmAllProperties(obj: Record<string, any>) {
  for (const prop in obj) {
    if (typeof obj[prop] === "string") {
      obj[prop] = obj[prop].trim();
    }
  }
  return obj;
}

export async function readDataFromDB(opts?: { log: (...args: any[]) => unknown }) {
  const log = opts?.log || console.log;

  log("Conectando a la base de datos...");
  const connection = await sql.connect(connectionQuery);

  log("Leyendo tablas...");

  // **** Products and providers ****
  const products = await fetchTableWithQuery(
    `SELECT
    COD_ARTICU as code,
    DESCRIPCIO as description,
    DESC_ADIC as additional_description
    FROM STA11`,
    productSchema,
  );

  const products_stock_commited = await fetchTableWithQuery(
    `SELECT
    COD_ARTICU as product_code,
    CANT_STOCK as stock_quantity,
    CANT_COMP as commited_quantity,
    CANT_PEND as pending_quantity,
    FECHA_ANT as last_update
    FROM STA19`,
    productStockCommitedSchema,
  );

  const providers = await fetchTableWithQuery(
    `SELECT
    COD_PROVEE as code, NOM_PROVEE as name, TELEFONO_1 as phone, 
    LOCALIDAD as city, C_POSTAL as zip_code, DOMICILIO as address FROM CPA01`,
    providerSchema,
  );

  const product_providers = await fetchTableWithQuery(
    `SELECT COD_ARTICU product_code, COD_PROVEE as provider_code, COD_SINONI as provider_product_code FROM CPA15`,
    productProviderSchema,
  );
  // *************

  // **** Assemblies ****
  const products_assemblies = await fetchTableWithQuery(
    `SELECT COD_ARTICU as product_code, COD_INSUMO as supply_product_code, CANT_NETA as quantity FROM STA03`,
    productAssemblySchema,
    true,
  );
  // *************

  // **** Imports ****
  const imports = await fetchTableWithQuery(
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

  const products_imports = await fetchTableWithQuery(
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
  // *************

  // **** Orders ****
  const orders = await fetchTableWithQuery(
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

  const products_orders = await fetchTableWithQuery(
    `SELECT
    NRO_PEDIDO as order_number,
    COD_ARTICU as product_code,
    CANT_PEN_D as ordered_quantity
    FROM GVA03`,
    orderProductSchema,
    true,
  );
  // *************

  // **** Clients ****
  const clients = await fetchTableWithQuery(
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
  // *************

  // **** Sold ****
  const sold = await fetchTableWithQuery(soldQuery, orderSoldSchema);
  const products_sold = await fetchTableWithQuery(soldProductsQuery, orderProductSoldSchema);
  // *************

  // **** CRM ****
  const budgets = await fetchTableWithQuery(
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

  const budget_products = await fetchTableWithQuery(
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

  const crm_clients = await fetchTableWithQuery(
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

  await connection.close();

  const productsFiltered = products.filter((product) => product.code.startsWith("A000") || product.code.startsWith("Z000"));

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

export type DataExport = Awaited<ReturnType<typeof readDataFromDB>>;

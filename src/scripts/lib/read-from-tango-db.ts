import sql from 'mssql'
import { soldProductsQuery, soldQuery } from './large-queries'

const connectionQuery = process.env.CONNECTION_QUERY || `Server=COMPET01\\AXSQLEXPRESS;DSN=Axoft;Description=Axoft;UID=Axoft;PWD=Axoft;APP=Microsoft Office XP;WSID=GERNOTE;DATABASE=Compet_SA;Network=DBNM;Encrypt=false;Connection Timeout=60`

export async function runQuery(query: string) {
    return (await sql.query(query)).recordset.map(trimmAllProperties)
}

export function trimmAllProperties(obj: Record<string, any>) {
    for (const prop in obj) {
        if (typeof obj[prop] === 'string') {
            obj[prop] = obj[prop].trim()
        }
    }
    return obj
}

export async function readDataFromDB() {
    console.log("Conectando a la base de datos...")
    const connection = await sql.connect(connectionQuery)
    console.log("Se conectó a la base de datos")

    console.log("Leyendo tablas...")

    // **** Products and providers ****
    const products = await runQuery(`SELECT
    COD_ARTICU as code,
    DESCRIPCIO as description,
    DESC_ADIC as additional_description
    FROM STA11`)

    const products_stock_commited = await runQuery(`SELECT
    COD_ARTICU as product_code,
    CANT_STOCK as stock_quantity,
    CANT_COMP as commited_quantity,
    CANT_PEND as pending_quantity,
    FECHA_ANT as last_update
    FROM STA19`)

    const providers = `SELECT
    COD_PROVEE as code, NOM_PROVEE as name, TELEFONO_1 as phone, 
    LOCALIDAD as city, C_POSTAL as zip_code, DOMICILIO as address FROM CPA01`

    const product_providers = await runQuery(`SELECT COD_ARTICU product_code, COD_PROVEE as provider_code, COD_SINONI as provider_product_code FROM CPA15`)
    // *************


    // **** Assemblies ****
    const products_assemblies = await runQuery(`SELECT COD_ARTICU as product_code, COD_INSUMO as supply_product_code, CANT_NETA as quantity FROM STA03`)
    // *************


    // **** Imports ****
    const imports = await runQuery(`SELECT 
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
    FROM CPA65`)

    const products_imports = await runQuery(`SELECT 
    ID_CARPETA as import_id,
    COD_ARTICU as product_code,
    CANT_PEDID as ordered_quantity,
    CERRADO as closed,
    FEC_EMBARC as shipping_date,
    FEC_NACION as national_date,
    FEC_P_PUER as arrival_date,
    CANT_NACIO as national_quantity
    FROM CPA66`)
    // *************


    // **** Orders ****
    const orders = await runQuery(`SELECT
    NRO_PEDIDO as order_number,
    APRUEBA as approved_by,
    COD_CLIENT as client_code,
    FECHA_APRU as approval_date,
    FECHA_ENTR as delivery_date,
    FECHA_PEDI as order_date,
    FECHA_INGRESO as entry_date,
    N_REMITO as remito_number,
    ESTADO as state
    FROM GVA21`)

    const products_orders = await runQuery(`SELECT
    NRO_PEDIDO as order_number,
    COD_ARTICU as product_code,
    CANT_PEN_D as ordered_quantity
    FROM GVA03`)
    // *************



    // **** Clients ****
    const clients = await runQuery(`SELECT
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
    FROM GVA14`)
    // *************



    // **** Sold ****
    const sold = await runQuery(soldQuery)
    const products_sold = await runQuery(soldProductsQuery)
    // *************



    // **** CRM ****
    const budgets = await runQuery(`SELECT
    ID_Presupuesto as budget_id,
    ID_Cliente as client_id,
    ID_Categoria as category_id,
    Fecha_Entrega as date,
    FechaVigencia as validity_date,
    Finalizada as finished_date,
    Prox_Contacto as next_contact_date,
    FechaUltimoCambio as last_update,
    Comentarios as comments
    FROM CRM_PRESUPUESTOS`)

    const budget_products = await runQuery(`SELECT 
    ID_PresupuestoDetalle as budget_products_id,
    ID_Presupuesto as budget_id,
    Cod_Articu as product_code,
    Descripcion as description,
    Cantidad as quantity,
    CantidadPendiente as pending_quantity,
    FechaAltaRenglon as creation_date
    FROM CRM_PresupuestosDetalles`)

    const crm_clients = await runQuery(`SELECT
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
    FROM CRM_CLIENTES`)

    await connection.close()

    return {
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
        crm_clients
    }
}
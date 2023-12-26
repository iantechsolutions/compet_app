/* eslint-disable */

import dayjs from "dayjs";
import { sql } from "drizzle-orm";
import { getSetting } from "~/lib/settings";
import { Client, Import, Order, OrderProduct, Product, ProductAssembly, ProductImport, ProductProvider, ProductStockCommited, Provider } from "~/lib/types";
import { decodeData, getMonths } from "~/lib/utils";
import { DataExport } from "~/scripts/lib/read-from-tango-db";
import { db } from "~/server/db";
import { utapi } from "~/server/uploadthing";
import { api } from "~/trpc/server";

export async function queryBaseMRPData() {
    // const imports = (await db.execute(sql`select * from Import`)).rows as Import[]
    // const products_imports = (await db.execute(sql`select * from ProductImport`)).rows as ProductImport[]
    // const products = (await db.execute(sql`select * from Product`)).rows as Product[]
    // const products_stock_commited = (await db.execute(sql`select * from ProductStockCommited`)).rows as ProductStockCommited[]
    // const products_assemblies = (await db.execute(sql`select * from ProductAssembly`)).rows as ProductAssembly[]
    // const providers = (await db.execute(sql`select * from Provider`)).rows as Provider[]
    // const product_providers = (await db.execute(sql`select * from ProductProvider`)).rows as ProductProvider[]
    // const orders = (await db.execute(sql`select * from \`Order\``)).rows as Order[]
    // const products_orders = (await db.execute(sql`select * from OrderProduct`)).rows as OrderProduct[]
    // const clients = (await db.execute(sql`select * from Client`)).rows as Client[]

    const mrpExportFile = await getSetting<string>("mrp.export-file")

    if(!mrpExportFile) {
        throw new Error("No se encontró el archivo de exportación de datos. Se debe ejecutar el script `load-data`, asegurarse de configurar uploadthing correctamente.")
    }

    const dataInfo = await api.mrpData.mrpDataInfo.query()

    const exportURL = dataInfo.exportURL

    const dataEncoded = await fetch(exportURL).then(res => res.text())
    const data = decodeData(dataEncoded) as DataExport

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
        clients,
        sold,
        products_sold,
        budgets,
        budget_products,
        crm_clients
    } = data

    const productByCode: Map<string, Product> = new Map()
    for (const product of products) {
        productByCode.set(product.code, product)
    }

    const stockCommitedByProduct: Map<string, ProductStockCommited> = new Map()
    for (const stockCommited of products_stock_commited) {
        stockCommitedByProduct.set(stockCommited.product_code, stockCommited)
    }

    const productImportsByProduct: Map<string, ProductImport[]> = new Map()
    for (const productImport of products_imports) {
        const productImports = productImportsByProduct.get(productImport.product_code) ?? []
        productImports.push(productImport)
        productImportsByProduct.set(productImport.product_code, productImports)
    }

    const suppliesOfProduct: Map<string, (ProductAssembly & { product: Product })[]> = new Map()
    const suppliesOfOfProduct: Map<string, (ProductAssembly & { product: Product })[]> = new Map()
    for (const assembly of products_assemblies) {
        const supplies = suppliesOfProduct.get(assembly.product_code) ?? []
        let product = productByCode.get(assembly.supply_product_code)!
        supplies.push({ ...assembly, product })
        suppliesOfProduct.set(assembly.product_code, supplies)

        const suppliesOf = suppliesOfOfProduct.get(assembly.supply_product_code) ?? []
        product = productByCode.get(assembly.product_code)!
        suppliesOf.push({ ...assembly, product })
        suppliesOfOfProduct.set(assembly.supply_product_code, suppliesOf)
    }

    const productProivderOfProduct: Map<string, ProductProvider[]> = new Map()
    for (const productProvider of product_providers) {
        const productProviders = productProivderOfProduct.get(productProvider.product_code) ?? []
        productProviders.push(productProvider)
        productProivderOfProduct.set(productProvider.product_code, productProviders)
    }

    const ordersByOrderNumber: Map<string, Order> = new Map()
    for (const order of orders) {
        ordersByOrderNumber.set(order.order_number, order)
    }

    const months = getMonths(10)

    return {
        months,
        imports,
        productImports: products_imports,
        products: products.map(product => ({
            ...product,
            stock: stockCommitedByProduct.get(product.code)?.stock_quantity ?? 0,
            commited: stockCommitedByProduct.get(product.code)?.commited_quantity ?? 0,
            imports: productImportsByProduct.get(product.code) ?? [],
            supplies: suppliesOfProduct.get(product.code) ?? [],
            suppliesOf: suppliesOfOfProduct.get(product.code) ?? [],
            providers: productProivderOfProduct.get(product.code) ?? [],
        })),
        stockCommitedData: products_stock_commited,
        assemblies: products_assemblies,
        providers,
        orders,
        orderProducts: products_orders.filter(orderProduct => {
            const order = ordersByOrderNumber.get(orderProduct.order_number)
            if (!order) return false
            if (order.state != 2) return false
            if (order.delivery_date < dayjs("2020-01-01").toDate()) {
                return false
            }
            return true
        }),
        clients,
        dataExportUrl: exportURL,
        dataExportDate: dataInfo.exportDate,
    }
}

export type RawMRPData = Awaited<ReturnType<typeof queryBaseMRPData>>
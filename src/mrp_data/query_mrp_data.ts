/* eslint-disable */

import dayjs from "dayjs";
import { sql } from "drizzle-orm";
import { Client, Import, Order, OrderProduct, Product, ProductAssembly, ProductImport, ProductProvider, ProductStockCommited, Provider } from "~/lib/types";
import { getMonths } from "~/lib/utils";
import { db } from "~/server/db";

export async function queryBaseMRPData() {
    const imports = (await db.execute(sql`select * from Import`)).rows as Import[]
    const productImports = (await db.execute(sql`select * from ProductImport`)).rows as ProductImport[]
    const products = (await db.execute(sql`select * from Product`)).rows as Product[]
    const stockCommitedData = (await db.execute(sql`select * from ProductStockCommited`)).rows as ProductStockCommited[]
    const assemblies = (await db.execute(sql`select * from ProductAssembly`)).rows as ProductAssembly[]
    const providers = (await db.execute(sql`select * from Provider`)).rows as Provider[]
    const productProivder = (await db.execute(sql`select * from ProductProvider`)).rows as ProductProvider[]
    const orders = (await db.execute(sql`select * from \`Order\``)).rows as Order[]
    const orderProducts = (await db.execute(sql`select * from OrderProduct`)).rows as OrderProduct[]
    const clients = (await db.execute(sql`select * from Client`)).rows as Client[]

    const productByCode: Map<string, Product> = new Map()
    for (const product of products) {
        productByCode.set(product.code, product)
    }

    const stockCommitedByProduct: Map<string, ProductStockCommited> = new Map()
    for (const stockCommited of stockCommitedData) {
        stockCommitedByProduct.set(stockCommited.product_code, stockCommited)
    }

    const productImportsByProduct: Map<string, ProductImport[]> = new Map()
    for (const productImport of productImports) {
        const productImports = productImportsByProduct.get(productImport.product_code) ?? []
        productImports.push(productImport)
        productImportsByProduct.set(productImport.product_code, productImports)
    }

    const suppliesOfProduct: Map<string, (ProductAssembly & { product: Product })[]> = new Map()
    const suppliesOfOfProduct: Map<string, (ProductAssembly & { product: Product })[]> = new Map()
    for (const assembly of assemblies) {
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
    for (const productProvider of productProivder) {
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
        productImports,
        products: products.map(product => ({
            ...product,
            stock: stockCommitedByProduct.get(product.code)?.stock_quantity ?? 0,
            commited: stockCommitedByProduct.get(product.code)?.commited_quantity ?? 0,
            imports: productImportsByProduct.get(product.code) ?? [],
            supplies: suppliesOfProduct.get(product.code) ?? [],
            suppliesOf: suppliesOfOfProduct.get(product.code) ?? [],
            providers: productProivderOfProduct.get(product.code) ?? [],
        })),
        stockCommitedData,
        assemblies,
        providers,
        orders,
        orderProducts: orderProducts.filter(orderProduct => {
            const order = ordersByOrderNumber.get(orderProduct.order_number)
            if (!order) return false
            if (order.state != 2) return false
            if (order.delivery_date < dayjs("2020-01-01").toDate()) {
                return false
            }
            return true
        }),
        clients,
    }
}

export type RawMRPData = Awaited<ReturnType<typeof queryBaseMRPData>>
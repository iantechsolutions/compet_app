import { monthCodeFromDate } from "~/lib/utils";
// Es un archivo de cliente porque enviar todo como JSON del servidor va a generar problemas

// Importamos SOLO el tipo de dato
import type { ForecastData } from "~/mrp_data/query_mrp_forecast_data";
export type { RawMRPData, ForecastData }
import dayjs from "dayjs";
import { RawMRPData } from "~/mrp_data/query_mrp_data";

export type ProductEventType = 'import' | 'order' | 'supply' | 'forecast'

export type ProductEvent = {
    type: ProductEventType
    referenceId: number
    date: Date
    originalQuantity?: number
    quantity: number
    productCode: string
    parentEvent?: ProductEvent
    childEvents?: ProductEvent[]
    level?: number
    expired: boolean
    assemblyId?: number
    isForecast?: boolean
    productAccumulativeStock: number
}

// Transformamos los datos en el cliente para que sean faciles de consumir y mostrar
function _transformMRPData(rawData: RawMRPData, forecastData: ForecastData | undefined, forecastParams: ForecastParams | undefined) {
    const data = mapData(rawData, forecastData)


    const months = rawData.months

    const events = listAllEventsWithSupplyEvents(data)
    const eventsByProductCode = listProductsEvents(data, events)


    const stockOfProductsByMonth = new Map<string, Map<string, number>>()
    for (const product of data.products) {
        stockOfProductsByMonth.set(
            product.code,
            stockOfProductByMonth(product.stock, eventsByProductCode.get(product.code)!, months),
        )
    }

    const eventsOfProductsByMonth = new Map<string, Map<string, ProductEvent[]>>()
    for (const product of data.products) {
        eventsOfProductsByMonth.set(product.code, eventsOfProductByMonth(eventsByProductCode.get(product.code)!, months))
    }

    const importedQuantityOfProductsByMonth = new Map<string, Map<string, number>>()
    const orderedQuantityOfProductsByMonth = new Map<string, Map<string, number>>()
    const usedAsSupplyQuantityOfProductsByMonth = new Map<string, Map<string, number>>()
    const usedAsForecastQuantityOfProductsByMonth = new Map<string, Map<string, number>>()

    for (const product of data.products) {
        const events = eventsOfProductsByMonth.get(product.code)!

        for (const month of months) {
            importedQuantityOfProductsByMonth.set(product.code, importedQuantityOfProductsByMonth.get(product.code) ?? new Map())
            orderedQuantityOfProductsByMonth.set(product.code, orderedQuantityOfProductsByMonth.get(product.code) ?? new Map())
            usedAsSupplyQuantityOfProductsByMonth.set(product.code, usedAsSupplyQuantityOfProductsByMonth.get(product.code) ?? new Map())
            usedAsForecastQuantityOfProductsByMonth.set(product.code, usedAsForecastQuantityOfProductsByMonth.get(product.code) ?? new Map())

            importedQuantityOfProductsByMonth.get(product.code)!.set(month, 0)
            orderedQuantityOfProductsByMonth.get(product.code)!.set(month, 0)
            usedAsSupplyQuantityOfProductsByMonth.get(product.code)!.set(month, 0)
            usedAsForecastQuantityOfProductsByMonth.get(product.code)!.set(month, 0)

            for (const event of events.get(month) ?? []) {
                // Aunque solo el valor de quantity afecte a la variación de stock, queremos que los eventos musetren la cantidad original por más de que se hayan dividido en eventos de suministro
                const qty = (event.originalQuantity ?? event.quantity)

                if (event.type === 'import') {
                    importedQuantityOfProductsByMonth.get(product.code)!.set(month, importedQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty)
                } else if (event.type === 'forecast' || event.isForecast) {
                    usedAsForecastQuantityOfProductsByMonth.get(product.code)!.set(month, usedAsForecastQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty)
                } else if (event.type === 'order') {
                    orderedQuantityOfProductsByMonth.get(product.code)!.set(month, orderedQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty)
                } else if (event.type === 'supply') {
                    usedAsSupplyQuantityOfProductsByMonth.get(product.code)!.set(month, usedAsSupplyQuantityOfProductsByMonth.get(product.code)!.get(month)! + qty)
                }
            }
        }
    }

    const products = data.products.map(product => ({
        ...product,
        stock_at: stockOfProductsByMonth.get(product.code)!,
        imported_quantity_by_month: importedQuantityOfProductsByMonth.get(product.code)!,
        ordered_quantity_by_month: orderedQuantityOfProductsByMonth.get(product.code)!,
        used_as_supply_quantity_by_month: usedAsSupplyQuantityOfProductsByMonth.get(product.code)!,
        used_as_forecast_quantity_by_month: usedAsForecastQuantityOfProductsByMonth.get(product.code)!,
        events_by_month: eventsOfProductsByMonth.get(product.code)!,
        events: eventsByProductCode.get(product.code)!,
    }))



    return {
        ...data,
        products,
        events,
        eventsByProductCode,
        stockOfProductsByMonth,
        eventsOfProductsByMonth,
    }
}

export type ForecastParams = {
    incrementFactor: number
}

export function transformMRPData(rawData: RawMRPData, forecastData: ForecastData | undefined, forecastParams: ForecastParams | undefined) {
    console.log(">>>", forecastParams)
    if (!forecastData) throw new Error('No forecast data')
    const data = _transformMRPData(rawData, forecastData, forecastParams)
    const productsByCode = new Map<string, ReturnType<typeof _transformMRPData>['products'][number]>()
    for (const product of data.products) {
        productsByCode.set(product.code, product)
    }

    return {
        ...data,
        productsByCode,
    }
}

export type MRPData = ReturnType<typeof transformMRPData>
export type MRPProduct = MRPData['products'][number]

// Generamos una lista de eventos generales ordenados por fecha
function listAllEvents(data: MappedData) {
    const events: ProductEvent[] = []

    const today = dayjs().startOf('day').toDate()


    if (data.forecastData) {
        for (const event of data.forecastData.events) {
            events.push({
                type: 'forecast',
                referenceId: -1,
                date: event.date,
                quantity: event.quantity,
                productCode: event.product_code,
                expired: event.date < today,
                productAccumulativeStock: 0,
                isForecast: true,
            })
        }
    }


    for (const productImport of data.productImports) {
        const date = dayjs(productImport.arrival_date).add(15, 'day').toDate()
        events.push({
            type: 'import',
            referenceId: productImport.id,
            //! 15 días después de la fecha de llegada para estar seguro
            date,
            quantity: productImport.ordered_quantity,
            productCode: productImport.product_code,
            expired: date < today,
            productAccumulativeStock: 0,
        })
    }

    for (const orderProduct of data.orderProducts) {
        const date = data.ordersByOrderNumber.get(orderProduct.order_number)!.delivery_date

        events.push({
            type: 'order',
            referenceId: orderProduct.id,
            date,
            quantity: orderProduct.ordered_quantity,
            productCode: orderProduct.product_code,
            expired: date < today,
            productAccumulativeStock: 0,
        })
    }

    return events.sort((a, b) => {    
        return (new Date(a.date)).getTime() - (new Date(b.date)).getTime()
    })
}

// Generamos una lista de eventos generales ordenados por fecha
// Les agregamos eventos de suministro para poder calcular el stock de forma correcta
// Esto sucita cuando se agotan los productos que son armados y se tienen que crear nuevos armados,
// en estos casos se asocia al pedido la materia prima necesaria para armar el producto
function listAllEventsWithSupplyEvents(data: MappedData) {
    let events = [...listAllEvents(data)]

    const stockOfProductTmp = new Map<string, number>()

    for (const product of data.products) {
        stockOfProductTmp.set(product.code, product.stock)
    }

    let index = 0
    // Usamos while porque vamos a modificar el array
    while (index < events.length) {
        const event = events[index]!
        // const list = listOf(event.productCode)

        if (event.type === 'import') {
            // Si es un import no se van a agentar eventos de supply
            const stock = stockOfProductTmp.get(event.productCode)! + event.quantity
            stockOfProductTmp.set(event.productCode, stock)
            // Actualizamos el stock en el evento
            event.productAccumulativeStock = stock
        } else if (event.type === 'order' || event.type === 'forecast' || event.type === 'supply') {
            let newStockAmount = stockOfProductTmp.get(event.productCode)! - event.quantity

            // Datos del producto
            const product = data.productsByCode.get(event.productCode)!

            // Cantidad de unidades que faltan para poder completar el pedido
            let overflow = 0

            // Si estamos vendiendo más unidades de las que tenemos en stock y es un armado,
            // significa que podemos armar más unidades
            if (newStockAmount < 0 && product.supplies.length > 0) {
                // Cantidad de unidades que tenemos que armar
                overflow = -newStockAmount
                // Si ya había stock negativo
                if (overflow > event.quantity) overflow = event.quantity

                // Stock de la unidad ya armada (que agotamos)
                newStockAmount += overflow

                // Nos guardamos la cantidad original de unidades que teníamos que armar
                event.originalQuantity = event.quantity

                // Restamos la cantidad de unidades que armamos (ya que estas cuentan para otro producto)
                event.quantity -= overflow

                // Nuevos eventos de summistro
                const newSupplyEvents: ProductEvent[] = []

                // Por cada producto que se necesita para armar el producto
                for (const supply of product.supplies) {
                    newSupplyEvents.push({
                        type: 'supply',
                        level: event.type === 'supply' ? event.level! + 1 : 0,
                        date: event.date, // La fecha es la misma
                        productCode: supply.supply_product_code, // Código del suministro
                        quantity: supply.quantity * overflow, // Cantidad por armado por cantidad a armar
                        assemblyId: supply.id,
                        parentEvent: event,
                        referenceId: event.referenceId, // Referencia al producto de la orden original
                        expired: event.expired,
                        isForecast: event.isForecast,
                        productAccumulativeStock: 0,
                    })
                }

                // Referenciamos el evento original a los nuevos eventos de suministro
                event.childEvents = newSupplyEvents

                // Agregamos los nuevos eventos de suministro a la lista de eventos
                // ES MUY IMPORTANTE RESPETAR EL ORDEN POR FECHA
                events = [...events.slice(0, index + 1), ...newSupplyEvents, ...events.slice(index + 1)]
            }

            // Actualizamos el stock del producto
            stockOfProductTmp.set(event.productCode, newStockAmount)

            // Actualizamos el stock en el evento
            event.productAccumulativeStock = newStockAmount
        }

        index++
    }

    return events
}

function listProductsEvents(data: MappedData, events: ProductEvent[]) {

    const eventsByProductCode = new Map<string, ProductEvent[]>()

    for (const product of data.products) {
        eventsByProductCode.set(product.code, [])
    }

    const listOf = (code: string) => eventsByProductCode.get(code) ?? []

    for (const event of events) {
        listOf(event.productCode).push(event)
    }

    return eventsByProductCode
}

function stockOfProductByMonth(initialStock: number, productEvents: ProductEvent[], months: string[]) {
    const stockByMonth = new Map<string, number>()

    let stock = initialStock

    const eventsBeforeToday = productEvents.filter(event => event.expired)
    const eventFromToday = productEvents.filter(event => !event.expired)


    for (const event of eventsBeforeToday) {
        if (event.type === 'import') {
            stock += event.quantity
        } else if (event.type === 'order' || event.type === 'forecast') {
            stock -= event.quantity
        } else if (event.type === 'supply') {
            stock -= event.quantity
        }
    }

    const eventsByMonth = new Map<string, ProductEvent[]>()

    for (const month of months) {
        eventsByMonth.set(month, [])
    }

    for (const event of eventFromToday) {
        const monthCode = monthCodeFromDate(event.date)
        eventsByMonth.get(monthCode)?.push(event)
    }

    let stockCarry = stock
    for (const month of months) {
        const events = eventsByMonth.get(month)!

        for (const event of events) {
            if (event.type === 'import') {
                stockCarry += event.quantity
            } else if (event.type === 'order' || event.type === 'forecast') {
                stockCarry -= event.quantity
            } else if (event.type === 'supply') {
                stockCarry -= event.quantity
            }
        }

        stockByMonth.set(month, stockCarry)
    }

    return stockByMonth
}

function eventsOfProductByMonth(productEvents: ProductEvent[], months: string[]) {
    const eventsByMonth = new Map<string, ProductEvent[]>()

    for (const event of productEvents) {
        const monthCode = monthCodeFromDate(event.date)
        eventsByMonth.set(monthCode, [...(eventsByMonth.get(monthCode) ?? []), event])
    }

    // Fill missing months with empty array
    for (const monthCode of months) {
        if (!eventsByMonth.has(monthCode)) {
            eventsByMonth.set(monthCode, [])
        }
    }

    return eventsByMonth
}


// Generamos mapas para acceder a los datos de forma más eficiente
function mapData(rawData: RawMRPData, forecastData?: ForecastData) {
    // Productos y provedores por código
    const productsByCode = new Map(rawData.products.map(product => [product.code, product]))
    const providersByCode = new Map(rawData.providers.map(provider => [provider.code, provider]))

    // Imports por su identificador
    const importsById = new Map(rawData.imports.map(imported => [imported.id, imported]))

    // Importaciones de productos por su identificador y código de producto
    const productImportsById = new Map(rawData.productImports.map(productImport => [productImport.id, productImport]))
    const productImportsByProductCode = new Map(rawData.productImports.map(productImport => [productImport.product_code, productImport]))

    // Ordenes por su número de orden
    const ordersByOrderNumber = new Map(rawData.orders.map(order => [order.order_number, order]))

    // Ordenes de productos por su número de orden y código de producto
    const orderProductsByOrderNumber = new Map<string, { id: number; order_number: string; product_code: string; ordered_quantity: number }[]>()
    rawData.orderProducts.forEach(order => {
        orderProductsByOrderNumber.set(order.order_number, [...(orderProductsByOrderNumber.get(order.order_number) ?? []), order])
    })
    const orderProductsByProductCode = new Map<string, { id: number; order_number: string; product_code: string; ordered_quantity: number }[]>()
    rawData.orderProducts.forEach(order => {
        orderProductsByProductCode.set(order.product_code, [...(orderProductsByProductCode.get(order.product_code) ?? []), order])
    })
    const orderProductsById = new Map(rawData.orderProducts.map(order => [order.id, order]))

    const clientsByCode = new Map(rawData.clients.map(client => [client.code, client]))

    const assemblyById = new Map(rawData.assemblies.map(assembly => [assembly.id, assembly]))

    return {
        ...rawData,
        forecastData,

        productsByCode,
        providersByCode,

        importsById,

        productImportsById,
        productImportsByProductCode,

        ordersByOrderNumber,

        orderProductsByOrderNumber,
        orderProductsByProductCode,
        orderProductsById,
        clientsByCode,
        assemblyById,
    }
}

type MappedData = ReturnType<typeof mapData>
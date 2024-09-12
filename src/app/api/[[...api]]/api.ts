import { Hono } from 'hono'
import { forecastProfiles } from '~/server/db/schema'
import { useContext } from 'react'
import { dataProviderContext } from '~/components/mrp-data-provider'
import { queryBaseMRPData, RawMRPData } from '~/mrp_data/query_mrp_data'
import { CronJob } from 'cron';
import { readDataFromDB } from '~/scripts/lib/read-from-tango-db'
import { api } from '~/trpc/server';
import { getServerAuthSession } from '~/server/auth';
import { Resend } from 'resend';
import { env } from 'process'
import { EmailTemplate } from '~/components/email-template';
import { ForecastData, ForecastProfile, ProductEvent } from '~/mrp_data/transform_mrp_data';
import dayjs from 'dayjs';
import { queryForecastData } from '~/mrp_data/query_mrp_forecast_data';
import { getUserSetting } from '~/lib/settings';
import { db } from '~/server/db';
import { eq } from 'drizzle-orm';
import { nullProfile } from '~/lib/nullForecastProfile';
import { getMonths, monthCodeFromDate } from '~/lib/utils'
const resend = new Resend(env.RESEND_API_KEY);
export const app = new Hono().basePath('/api')

app.get('/hello', (c) => {
    return c.json({ message: 'Hello, World!' })
})


app.get('/products',async (c)=>{
    const data = await queryBaseMRPData();
    const products = data.products;
    return c.json(products);
})


app.get("/startmailchain", async (c) => {
    type MappedData = ReturnType<typeof mapData>

    function mapData(rawData: RawMRPData, forecastData?: ForecastData) {
        // Productos y provedores por código
        const productsByCode = new Map(rawData.products.map((product) => [product.code, product]))
        const providersByCode = new Map(rawData.providers.map((provider) => [provider.code, provider]))
    
        // Imports por su identificador
        const importsById = new Map(rawData.imports.map((imported) => [imported.id, imported]))
    
        // Importaciones de productos por su identificador y código de producto
        const productImportsById = new Map(rawData.productImports.map((productImport) => [productImport.id, productImport]))
        const productImportsByProductCode = new Map(rawData.productImports.map((productImport) => [productImport.product_code, productImport]))
    
        // Ordenes por su número de orden
        const ordersByOrderNumber = new Map(rawData.orders.map((order) => [order.order_number, order]))
    
        // Ordenes de productos por su número de orden y código de producto
        const orderProductsByOrderNumber = new Map<
            string,
            {
                id: number
                order_number: string
                product_code: string
                ordered_quantity: number
            }[]
        >()
        rawData.orderProducts.forEach((order) => {
            orderProductsByOrderNumber.set(order.order_number, [...(orderProductsByOrderNumber.get(order.order_number) ?? []), order])
        })
        const orderProductsByProductCode = new Map<
            string,
            {
                id: number
                order_number: string
                product_code: string
                ordered_quantity: number
            }[]
        >()
        rawData.orderProducts.forEach((order) => {
            orderProductsByProductCode.set(order.product_code, [...(orderProductsByProductCode.get(order.product_code) ?? []), order])
        })
        const orderProductsById = new Map(rawData.orderProducts.map((order) => [order.id, order]))
    
        const clientsByCode = new Map(rawData.clients.map((client) => [client.code, client]))
    
        const assemblyById = new Map(rawData.assemblies.map((assembly) => [assembly.id, assembly]))
    
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

    function listAllEvents(data: MappedData) {
        const events: ProductEvent[] = []
    
        const today = dayjs().startOf('day').toDate()
    
        // Take forecast data and transform it into events that the MRP can understand
        if (data.forecastData) {
            for (const event of data.forecastData.events) {
                // Transform ForecastDataEvent to ProductEvent
                events.push({
                    type: 'forecast', // It indicates that it is a forecast event (not a real life event)
                    forecastType: event.type,
                    referenceId: -1,
                    date: event.date,
                    quantity: event.quantity,
                    productCode: event.product_code,
                    expired: new Date(event.date) < today,
                    productAccumulativeStock: 0,
                    originalQuantity: event.originalQuantity,
                    isForecast: true,
                })
            }
        }
    
        // Events from imports
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
    
        // Events from orders
        for (const orderProduct of data.orderProducts) {
            const date = new Date(data.ordersByOrderNumber.get(orderProduct.order_number)!.delivery_date)
    
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
            return new Date(a.date).getTime() - new Date(b.date).getTime()
        })
    }


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
                            forecastType: event.forecastType,
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
    
        const eventsBeforeToday = productEvents.filter((event) => event.expired)
        const eventFromToday = productEvents.filter((event) => !event.expired)
    
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
    async function sendMails(){
        console.log("empieza", new Date());
        // const session = await getServerAuthSession();
        const sessions = await db.query.sessions.findMany();
        sessions.forEach(async (session)=>{
        const mails = await api.mail.getMails.query({
            userId: session?.userId ?? ""
        });
        if (mails && mails.length > 0) {
        const {BelowNMonths,firstCheck,secondCheck} = await api.mail.getMailsConfig.query({
            userId: session?.userId ?? ""
        })
        const rawdata = await queryBaseMRPData();
        const forecastProfileId = await getUserSetting<number>('mrp.current_forecast_profile', session?.userId ?? "")
        let forecastProfile: ForecastProfile | null =
        forecastProfileId != null
                ? (await db.query.forecastProfiles.findFirst({
                    where: eq(forecastProfiles.id, forecastProfileId),
                })) ?? null
                : null

        if (!forecastProfile) {
            forecastProfile = nullProfile
        }
        const forecastData = await queryForecastData(forecastProfile, rawdata)
        const data = mapData(rawdata, forecastData)
        const events = listAllEventsWithSupplyEvents(data);
        const eventsByProductCode = listProductsEvents(data, events)
        // console.log("eventsByProductCode",eventsByProductCode);
        const splicedMonths = getMonths(firstCheck ?? 2);
        const months = getMonths(secondCheck ?? 12);
                console.log("months",months);
        const _stockOfProductsByMonth = new Map<string, Map<string, number>>()
        for (const product of data.products) {
            _stockOfProductsByMonth.set(product.code, stockOfProductByMonth(product.stock, eventsByProductCode.get(product.code)!, months))
        }
        const finalList: {productCode:string, quantity: number, date:string, regularizationDate: string }[] = [];
        // console.log(_stockOfProductsByMonth);

        for (const product of data.products){
            const stockByMonth = _stockOfProductsByMonth.get(product.code) ?? new Map<string, number>();
            let critical = false;
            let quantity = 0;
            let criticalMonth = "";
            let fixedMonth = null;
            // console.log("product",product.code);
            splicedMonths.map((month, index)=>{
                if((stockByMonth.get(month) ?? 0) < 0){
                    quantity = stockByMonth.get(month) ?? 0;
                    criticalMonth = month;
                    critical = true;
                }
            })
            const reversedMonths = months.toReversed();
            if(critical){
                let reversedMonths = months.toReversed();
                if(months.includes(criticalMonth)){
                    reversedMonths = months.slice(months.indexOf(criticalMonth)).toReversed();
                }
                reversedMonths.forEach((month, index)=>{
                    if((stockByMonth.get(month) ?? 0) >= 0){
                        fixedMonth = month;
                    }
                })
                if(fixedMonth){
                    if(dayjs(criticalMonth).diff(dayjs(fixedMonth), 'month') > (BelowNMonths ?? 0)){
                        finalList.push({productCode: product.code, quantity, date: criticalMonth, regularizationDate: fixedMonth});
                    }
                }
                else{
                    finalList.push({productCode: product.code, quantity, date: criticalMonth, regularizationDate: 'No hay fecha de regularización en los proximos ' + (secondCheck ?? 12) + ' meses'});
                }
                
            }
        }
        const { data:emailData, error } = await resend.emails.send({
            from: 'desarrollo <desarrollo@resend.dev>',
            to: mails ?? "",
            subject: 'Productos faltantes',
            react: EmailTemplate({
                productList: finalList
            }),
        });
          console.log(emailData);
        console.log("termina", new Date());
        }
        })
    }
    console.log("llega");

    const job = new CronJob(
        '0 0 18 * * 4', // cronTime
        function () {
            console.log('You will see this message every second');
            sendMails();
        }, // onTick
        onComplete, // onComplete
        true, // start
        'UTC' // timeZone
    );
      job.start();

      function onComplete() {
        console.error("Cron Job Complete");
      };

})
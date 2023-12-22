/* eslint-disable */

import dayjs from "dayjs"
import { monthCodeFromDate } from "~/lib/utils"
import { db } from "~/server/db"
import { sql } from "drizzle-orm"
import { OrderProductSold, OrderSold } from "~/lib/types"
import { ForecastParams } from "./transform_mrp_data"

type ForecastDataEvent = {
    product_code: string
    date: Date
    quantity: number
}


export async function queryForecastData(forecastParams: ForecastParams) {

    // const budgetProducts = await prisma.cRMBudgetProduct.findMany({
    //     where: {
    //         budget: {
    //             date: {
    //                 gte: dayjs().startOf('month').toDate()
    //             }
    //         }
    //     },
    //     include: {
    //         budget: true,
    //     }
    // })

    // const soldProducts = await prisma.orderProductSold.findMany({
    //     include: {
    //         order: {
    //             select: {
    //                 emission_date: true
    //             }
    //         }
    //     }
    // })

    const soldProductsBase = (await db.execute(sql`select * from OrderProductSold`)).rows as OrderProductSold[]
    const ordersSold = (await db.execute(sql`select * from OrderSold`)).rows as OrderSold[]

    const ordersSoldByN_COMP: Map<string, OrderSold> = new Map()
    for (const orderSold of ordersSold) {
        ordersSoldByN_COMP.set(orderSold.N_COMP, orderSold)
    }

    const soldProducts = soldProductsBase.map((soldProduct) => {
        const order = ordersSoldByN_COMP.get(soldProduct.N_COMP)!
        return {
            ...soldProduct,
            order,
        }
    })

    const productsSoldMonthlyByCode = new Map<string, Map<string, number>>()

    for (const soldProduct of soldProducts) {
        const date = dayjs(soldProduct.order.emission_date).startOf('month').toDate()
        const date_key = monthCodeFromDate(date)

        const code = soldProduct.product_code
        const quantity = soldProduct.CANTIDAD

        if (!productsSoldMonthlyByCode.has(code)) {
            productsSoldMonthlyByCode.set(code, new Map())
        }

        const productSoldMonthly = productsSoldMonthlyByCode.get(code)!

        if (!productSoldMonthly.has(date_key)) {
            productSoldMonthly.set(date_key, 0)
        }

        const currentQuantity = productSoldMonthly.get(date_key)!

        productSoldMonthly.set(date_key, currentQuantity + quantity)
    }

    const last6MonthsCodes = [
        monthCodeFromDate(dayjs().subtract(5, 'month').toDate()),
        monthCodeFromDate(dayjs().subtract(4, 'month').toDate()),
        monthCodeFromDate(dayjs().subtract(3, 'month').toDate()),
        monthCodeFromDate(dayjs().subtract(2, 'month').toDate()),
        monthCodeFromDate(dayjs().subtract(1, 'month').toDate()),
        monthCodeFromDate(dayjs().toDate()),
    ]

    const productSoldAverageMonthlyByCode = new Map<string, number>()

    for (const [code, soldMonthly] of productsSoldMonthlyByCode.entries()) {
        let total = 0

        for (const code of last6MonthsCodes) {
            total += soldMonthly.get(code) ?? 0
        }

        productSoldAverageMonthlyByCode.set(code, total / 6)
    }

    const events: ForecastDataEvent[] = [
        // {
        //     product_code: '01014040 CON AD',
        //     date: new Date(2023, 11, 1),
        //     quantity: 1500,
        // },
        // {
        //     product_code: '03103EPE201593',
        //     date: new Date(2023, 11, 2),
        //     quantity: 880,
        // }
    ]

    // for next 12 months
    for (let i = 0; i < 12; i++) {
        const date = dayjs().startOf('month').add(6, 'hours').add(i + 1, 'month').toDate()

        for(const product_code of productSoldAverageMonthlyByCode.keys()) {

            const quantity = productSoldAverageMonthlyByCode.get(product_code)!
            events.push({
                product_code,
                date,
                quantity: quantity * (1 + i * forecastParams.incrementFactor),
            })
        }
    }

    return {
        // soldProducts,
        productsSoldMonthlyByCode,
        productSoldAverageMonthlyByCode,
        events,
        forecastParams,
    }
}

export type ForecastData = Awaited<ReturnType<typeof queryForecastData>>
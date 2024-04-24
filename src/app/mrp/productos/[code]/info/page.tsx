'use client'

import { useMemo } from 'react'
import { useMRPData } from '~/components/mrp-data-provider'
import { useCurrentProduct } from '../product_provider'
import ClientsOrdersQuantityPieChart from './clients-orders-pie-chart'

export default function ProductInfoPage() {
    const product = useCurrentProduct()

    const data = useMRPData()

    const orders = useMemo(() => {
        const orderProducts = data.orderProductsByProductCode.get(product.code) || []

        return orderProducts.map((orderProduct) => {
            const order = data.ordersByOrderNumber.get(orderProduct.order_number)!
            return {
                ...orderProduct,
                order,
            }
        })
    }, [data])

    return (
        <>
            <ClientsOrdersQuantityPieChart
                orders={orders.map((o) => ({ quantity: o.ordered_quantity, client_code: o.order.client_code }))}
            />
        </>
    )
}

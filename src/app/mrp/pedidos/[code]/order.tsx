"use client"
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { useMRPData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion"
import { Button } from "~/components/ui/button";
import { cn, formatStockWithDecimals } from "~/lib/utils";
import { ProductEvent } from "~/mrp_data/transform_mrp_data";


function useProductRef() {
    const params = useSearchParams()
    return params?.get('product_ref') || null
}

export default function OrderPage(props: { user?: NavUserData }) {
    const data = useMRPData()

    const params = useParams<{ code: string }>()

    const orderNumber = decodeURIComponent(params?.code ?? '')

    const order = data.ordersByOrderNumber.get(orderNumber)

    if (!order) {
        return <AppLayout
            title={<h1>Error 404</h1>}
            user={props?.user}
            sidenav={<AppSidenav />}
        >
            <Title>No se encontró el pedido</Title>
            <p>No encontramos ningún pedido con el número "{orderNumber}".</p>
        </AppLayout>
    }


    const orderProducts = data.orderProductsByOrderNumber.get(orderNumber) ?? []

    const eventsByOrderProductId = new Map<number, ProductEvent[]>()

    for (const orderProduct of orderProducts) {
        let events = data.eventsByProductCode.get(orderProduct.product_code) ?? []

        events = events.filter(event => event.referenceId === orderProduct.id)

        if (events) {
            eventsByOrderProductId.set(orderProduct.id, events)
        }
    }


    const client = data.clientsByCode.get(order.client_code)

    const productRef = useProductRef()

    return <AppLayout
        title={<h1>Pedido N°: {order.order_number}</h1>}
        user={props?.user}
        sidenav={<AppSidenav />}
    >
        <div className="border-b px-3 pb-5">
            <h1 className="font-medium text-lg">Pedido de {client?.name ?? order.client_code}</h1>
            <p className="text-xs">{client?.address}</p>
            <p>Fecha de creacion: {dayjs(order.entry_date).format('DD/MM/YYYY')}</p>
            <p>Fecha de aprobación: {dayjs(order.approval_date).format('DD/MM/YYYY')}</p>
            <p>Fecha de entrega: {dayjs(order.delivery_date).format('DD/MM/YYYY')}</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
            {orderProducts.map(orderProduct => {
                const product = data.productsByCode.get(orderProduct.product_code)

                if (!product) return <></>

                return <AccordionItem value={orderProduct.id.toString()} key={orderProduct.id} id={`accordion-${orderProduct.id}`}>
                    <AccordionTrigger className="px-3">
                        <div className="text-left">
                            <p className={cn("text-lg", {
                                'bg-yellow-500': productRef === product.code
                            })}>{orderProduct.ordered_quantity} x {product.code}</p>
                            <p className="text-xs">{product.description} - {product.additional_description}</p>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3">
                        {eventsByOrderProductId.get(orderProduct.id)?.map((event, i) => {
                            return <EventRenderer key={i} event={event} top />
                        })}
                    </AccordionContent>
                </AccordionItem>
            })}
        </Accordion>
    </AppLayout>
}

function EventRenderer(props: { event: ProductEvent, top: boolean }) {
    const event = props.event

    const data = useMRPData()

    const product = data.productsByCode.get(event.productCode)

    const assembly = event.assemblyId && data.assemblyById.get(event.assemblyId)

    if (!product) return <></>

    const assembliesQuantities = (event.parentEvent && event.parentEvent.originalQuantity) && (event.parentEvent.originalQuantity - event.parentEvent.quantity)

    const productRef = useProductRef()

    return <div className="py-2 bg-stone-500 bg-opacity-10 px-2">
        {!props.top && <Link href={`/producto/${event.productCode}`} className={cn("text-sm underline", {
            'bg-yellow-500': product.code === productRef
        })}>{event.productCode}</Link>}
        {(!props.top && event.originalQuantity != undefined) && <p>Cantidad pedida: {formatStockWithDecimals(event.originalQuantity)}</p>}
        {event.originalQuantity != undefined && <p className="font-medium">Stock disponible a utilizar: {formatStockWithDecimals(event.quantity)}</p>}
        {event.originalQuantity == undefined && <p className="font-medium">
            Cantidad: {formatStockWithDecimals(event.quantity)}
            {assembly && <span className="text-xs"> (armado: {formatStockWithDecimals(assembly.quantity)} * {formatStockWithDecimals(assembliesQuantities ?? 1)})</span>}
        </p>}
        {(event.childEvents?.length ?? 0) > 0 && <p className="mt-2 font-semibold">Necesidad de insumos:</p>}
        {event.childEvents?.map((childEvent, i) => {
            return <div className="m-3" key={i}>
                <EventRenderer event={childEvent} top={false} />
            </div>
        })}
    </div>
}
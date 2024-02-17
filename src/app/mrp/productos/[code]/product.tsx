"use client"
import { useParams } from "next/navigation";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { useMRPData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { MRPData } from "~/mrp_data/transform_mrp_data";
import { useProductPageData } from "./use_product_page_data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import dayjs from "dayjs";
import { ForecastSupplyEventsRow } from "./forecast_supply_events_row";
import { ProductEventRow } from "./event_row";
import { ProductEventsChart } from "./chart";
import { Title } from "~/components/title";
import { formatStock } from "~/lib/utils";
import { Fragment } from 'react'

export default function ProductPage(props: { user?: NavUserData }) {

    const data: MRPData = useMRPData()

    const params = useParams<{ code: string }>()

    const productCode = decodeURIComponent(params?.code ?? '')

    const product = data.productsByCode.get(productCode)


    if (!product) {
        return (
            <AppLayout
                title={<h1>Error 404</h1>}
                user={props?.user}
                sidenav={<AppSidenav />}
            >
                <Title>No se encontró el pedido</Title>
                <p>No encontramos ningún producto con el número "{productCode}".</p>
            </AppLayout>
        );
    }

    const productData = useProductPageData(product)

    return <AppLayout
        title={<h1>{product.description}</h1>}
        user={props?.user}
        sidenav={<AppSidenav />}
    >
        <div className="">
            <Badge>
                {product.description} - {product.additional_description}
            </Badge>
            <Badge className="ml-2">Stock: {product.stock}</Badge>
            <Badge className="ml-2">Comprometido: {product.commited}</Badge>
        </div>
        <div className="py-2">
            {product?.providers.map((provider, i) => {
                return <Badge key={i} variant="secondary" className="mr-2">{data.providersByCode.get(provider.provider_code)?.name ?? provider.provider_code}</Badge>
            })}
        </div>
        <ProductEventsChart key={product.code} product={product} months={data.months} />
        <div className="max-w-full overflow-x-auto">
            <Table className="min-w-[600px]">
                {/* <TableCaption>Lista de importaciones pedidos y armados</TableCaption> */}
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Cantidad</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>

                    <TableRow key={`table_top`}>
                        <TableCell colSpan={6} className="font-medium pt-7">
                            <div className="flex items-center">
                                {dayjs().format('DD [de] MMMM').toUpperCase()}
                                <span className="ml-3 text-xs">
                                    Stock inicial: {formatStock(product.stock)} - Stock comprometido: {formatStock(product.commited)} = Stock disponible: {formatStock(product.stock - product.commited)}
                                </span>
                            </div>
                        </TableCell>
                    </TableRow>

                    {Array.from(productData.entries()).map(([month, p], i) => {

                        const forecastEvents = p.events.filter(e => e.isForecast)

                        const nonForecastEvents = p.events.filter(e => !e.isForecast)

                        // const supplyForecastEventsSum = p.supplyForecastEvents.reduce((acc, e) => acc + e.quantity, 0)

                        // Variación de stock
                        const stockVariation = product.stock_variation_by_month.get(month) ?? 0
                        // Stock al final del mes
                        const finalStock = product.stock_at.get(month) ?? 0
                        // Stock inicial del mes
                        const initialStock = finalStock - stockVariation

                        // Usado como forecast (no insumo, facturación y presupuesto)
                        // const usedAsForecast = product.used_as_forecast_quantity_by_month.get(month) ?? 0
                        // const usedAsSoldForecast = product.used_as_forecast_type_sold_quantity_by_month.get(month) ?? 0
                        // const usedAsBudgetForecast = product.used_as_forecast_type_budget_quantity_by_month.get(month) ?? 0


                        return <Fragment key={i}>
                            <TableRow key={`header:${month}`}>
                                <TableCell colSpan={6} className="font-medium pt-7">
                                    <div className="flex items-center">
                                        {dayjs(month).format('MMMM YYYY').toUpperCase()}
                                        <span className="ml-3 text-xs">
                                            Stock inicial: {formatStock(initialStock)}, Variación stock: {formatStock(stockVariation)}, stock final: {formatStock(finalStock)}
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                            {forecastEvents.map((event, i) => {
                                return <ProductEventRow key={`row:${month}:f_${i}`} event={event} productCode={productCode} nostock />
                            })}
                            <ForecastSupplyEventsRow events={p.supplyForecastEvents} month={month} key={`forecast_supply_event_row:${month}`} />
                            {nonForecastEvents.map((event, i) => {
                                return <ProductEventRow key={`row:${month}:nf_${i}`} event={event} productCode={productCode} />
                            })}
                        </Fragment>
                    })}
                </TableBody >
            </Table>
        </div>
    </AppLayout>
}

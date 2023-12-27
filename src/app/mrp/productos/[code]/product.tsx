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
import { ForecastBudgetEventsRow } from "./forecast_budget_events_row";

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
                    {Array.from(productData.entries()).map(([month, p], i) => {

                        const forecastEvents = p.events.filter(e => e.isForecast)
                        const budgetForecastEvents = p.events.filter(e => e.isForecast && e.forecastType === 'budget')

                        const nonForecastEvents = p.events.filter(e => !e.isForecast)

                        const lastStock = forecastEvents[forecastEvents.length - 1]?.productAccumulativeStock ?? 0

                        const supplyForecastEventsSum = p.supplyForecastEvents.reduce((acc, e) => acc + e.quantity, 0)

                        return <>
                            <TableRow key={`header:${month}`}>
                                <TableCell colSpan={6} className="font-medium pt-7">
                                    {dayjs(month).format('MMMM YYYY').toUpperCase()}
                                </TableCell>
                            </TableRow>
                            {forecastEvents.map((event, i) => {
                                return <ProductEventRow key={`row:${month}:f_${i}`} event={event} productCode={productCode} />
                            })}
                            <ForecastSupplyEventsRow events={p.supplyForecastEvents} month={month} key={`forecast_supply_event_row:${month}`} stock={lastStock} />
                            {/* <ForecastBudgetEventsRow events={budgetForecastEvents} month={month} key={`forecast_budget_event_row:${month}`} stock={lastStock - supplyForecastEventsSum} /> */}
                            {nonForecastEvents.map((event, i) => {
                                return <ProductEventRow key={`row:${month}:nf_${i}`} event={event} productCode={productCode} />
                            })}
                        </>
                    })}
                </TableBody >
            </Table>
        </div>
    </AppLayout>
}

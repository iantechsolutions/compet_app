"use client";
import dayjs from "dayjs";
import { useParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { formatStock } from "~/lib/utils";
import type { ProductEvent } from "~/mrp_data/transform_mrp_data";
import { ProductEventsChart } from "./chart";
import { ProductEventRow } from "./event_row";
import { ForecastSupplyEventsRow } from "./forecast_supply_events_row";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { api } from "~/trpc/react";
import AppLayout from "~/components/applayout";
import { Title } from "~/components/title";
import AppSidenav from "~/components/app-sidenav";
import { useSession } from "next-auth/react";

export default function ProductPage() {
  const { data: eventsByProductCode, isLoading: isLoadingEvts } = api.db.getMEventsByProductCode.useQuery()
  const { data: products, isLoading: isLoadingProds } = api.db.getMProductsDefault.useQuery();
  const { data: providersByCode, isLoading: isLoadingProvC } = api.db.getMProvidersByCode.useQuery();
  const { data: orderProductsById, isLoading: isLoadingOrderProds } = api.db.getMOrderProductsById.useQuery();
  const { data: ordersByOrderNumber, isLoading: isLoadingOrderNums } = api.db.getMOrdersByOrderNumber.useQuery();
  const { data: productImportsById, isLoading: isLoadingProdImports } = api.db.getMProductImportsById.useQuery();
  const { data: importsById, isLoading: isLoadingImports } = api.db.getMImportsById.useQuery();
  const { data: months, isLoading: isLoadingMonths } = api.db.getMonths.useQuery();
  const isLoadingData = isLoadingMonths || isLoadingProvC || isLoadingOrderProds || isLoadingOrderNums || isLoadingProdImports || isLoadingImports || isLoadingProds || isLoadingEvts;

  const params = useParams<{ code: string }>();
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  const productCode = decodeURIComponent(params?.code ?? "");
  const product = products?.find(v => v.code === productCode);
  const auth = useSession();

  const productData = useMemo(() => {
    if (!product) {
      return null;
    }

    const events = eventsByProductCode?.get(product.code) ?? [];

    const dataByMonth = new Map<string, { events: ProductEvent[]; supplyForecastEvents: ProductEvent[] }>();

    for (const event of events) {
      const month = dayjs(event.date).format("YYYY-MM");

      const data = dataByMonth.get(month) ?? {
        events: [],
        supplyForecastEvents: [],
      };

      if (event.type === "supply" && event.isForecast) {
        data.supplyForecastEvents.push(event);
      } else {
        data.events.push(event);
      }

      dataByMonth.set(month, data);
    }

    return dataByMonth;
  }, [product]);

  if (isLoadingData || !eventsByProductCode) {
    return <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
      <Button variant="secondary" disabled>
        <Loader2Icon className="mr-2 animate-spin" /> {isLoadingStats ? 'Cargando estadísticas' : 'Cargando datos'}
      </Button>
    </div>;
  } else if (!product) {
    return (
      <AppLayout title={<h1>Error 404</h1>} user={auth.data?.user} sidenav={<AppSidenav />}>
        <Title>No se encontró el producto</Title>
        <p>No encontramos ningún producto con el código "{productCode}".</p>
      </AppLayout>
    );
  }

  return (
    <>
      <div className="flex flex-row justify-between">
        <div>
          <div className="">
            <Badge>
              {product.description} - {product.additional_description}
            </Badge>
            <Badge className="ml-2">Stock: {Math.round(product.stock)}</Badge>
            <Badge className="ml-2">Comprometido: {Math.round(product.commited)}</Badge>
          </div>
          <div className="py-2">
            {product?.providers.map((provider, i) => {
              return (
                <Badge key={i} variant="secondary" className="mr-2">
                  {providersByCode?.get(provider.provider_code)?.name ?? provider.provider_code}
                </Badge>
              );
            })}
          </div>
        </div>
        <Link href={"/mrp/estadisticas/" + productCode} onClick={() => setIsLoadingStats(true)}>
          <Button variant="outline">Ver estadisticas</Button>
        </Link>
      </div>
      <ProductEventsChart key={product.code} product={product} months={months!} />
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
              <TableCell colSpan={6} className="pt-7 font-medium">
                <div className="flex items-center">
                  {dayjs().format("DD [de] MMMM").toUpperCase()}
                  <span className="ml-3 text-xs">
                    Stock inicial: {formatStock(product.stock)} - Stock comprometido: {formatStock(product.commited)} = Stock disponible:{" "}
                    {formatStock(product.stock - product.commited)}
                  </span>
                </div>
              </TableCell>
            </TableRow>

            {Array.from(productData?.entries() ?? []).map(([month, p], i) => {
              const forecastEvents = p.events.filter((e) => e.isForecast);

              const nonForecastEvents = p.events.filter((e) => !e.isForecast);

              // const supplyForecastEventsSum = p.supplyForecastEvents.reduce((acc, e) => acc + e.quantity, 0)

              // Variación de stock
              const stockVariation = product.stock_variation_by_month.get(month) ?? 0;
              // Stock al final del mes
              const finalStock = product.stock_at.get(month) ?? 0;
              // Stock inicial del mes
              const initialStock = finalStock - stockVariation;

              // Usado como forecast (no insumo, facturación y presupuesto)
              // const usedAsForecast = product.used_as_forecast_quantity_by_month.get(month) ?? 0
              // const usedAsSoldForecast = product.used_as_forecast_type_sold_quantity_by_month.get(month) ?? 0
              // const usedAsBudgetForecast = product.used_as_forecast_type_budget_quantity_by_month.get(month) ?? 0

              return (
                <Fragment key={i}>
                  <TableRow key={`header:${month}`}>
                    <TableCell colSpan={6} className="pt-7 font-medium">
                      <div className="flex items-center">
                        {dayjs(month).format("MMMM YYYY").toUpperCase()}
                        <span className="ml-3 text-xs">
                          Stock inicial: {formatStock(initialStock)}, Variación stock: {formatStock(stockVariation)}, stock final:{" "}
                          {formatStock(finalStock)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {forecastEvents.map((event, i) => {
                    return <ProductEventRow importsById={importsById!} orderProductsById={orderProductsById!} ordersByOrderNumber={ordersByOrderNumber!} productImportsById={productImportsById!} key={`row:${month}:f_${i}`} event={event} productCode={productCode} nostock />;
                  })}
                  <ForecastSupplyEventsRow importsById={importsById!} orderProductsById={orderProductsById!} ordersByOrderNumber={ordersByOrderNumber!} productImportsById={productImportsById!} events={p.supplyForecastEvents} month={month} key={`forecast_supply_event_row:${month}`} />
                  {nonForecastEvents.map((event, i) => {
                    return <ProductEventRow importsById={importsById!} orderProductsById={orderProductsById!} ordersByOrderNumber={ordersByOrderNumber!} productImportsById={productImportsById!} key={`row:${month}:nf_${i}`} event={event} productCode={productCode} />;
                  })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

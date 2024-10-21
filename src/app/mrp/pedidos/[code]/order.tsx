"use client";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { useMRPData } from "~/components/mrp-data-provider";
import type { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { cn, formatStockWithDecimals } from "~/lib/utils";
import type { ProductEvent } from "~/mrp_data/transform_mrp_data";
import type { Monolito } from "~/server/api/routers/db";

function useProductRef() {
  const params = useSearchParams();
  return params?.get("product_ref") ?? null;
}

export default function OrderPage(props: { user?: NavUserData }) {
  /* const { data: eventsByProductCode, isLoading: isLoadingEvts } = api.db.getMEventsByProductCode.useQuery();
  const { data: ordersByOrderNumber, isLoading: isLoadingOrdNum } = api.db.getMOrdersByOrderNumber.useQuery();
  const { data: orderProductsByOrderNumber, isLoading: isLoadingOrdProd } = api.db.getMOrderProductsByOrderNumber.useQuery();
  const { data: clientsByCode, isLoading: isLoadingClients } = api.db.getMClientsByCode.useQuery();
  const { data: productsByCode, isLoading: isLoadingProd } = api.db.getMProductsByCode.useQuery();
  const { data: assemblyById, isLoading: isLoadingAssembly } = api.db.getMAssemblyById.useQuery();
  const isLoadingData = isLoadingAssembly || isLoadingProd || isLoadingClients || isLoadingOrdProd || isLoadingOrdNum || isLoadingEvts; */
  const mrpData = useMRPData();
  const { assemblyById, productsByCode, clientsByCode, orderProductsByOrderNumber, ordersByOrderNumber, eventsByProductCode } = mrpData;
  const indexedEvents = mrpData.events ?? [];

  const params = useParams<{ code: string }>();
  const orderNumber = decodeURIComponent(params?.code ?? "");
  const productRef = useProductRef();

  const order = ordersByOrderNumber?.[orderNumber];
  if (!order) {
    return (
      <AppLayout title={<h1>Error 404</h1>} user={props?.user} sidenav={<AppSidenav />}>
        <Title>No se encontró el pedido</Title>
        <p>No encontramos ningún pedido con el número "{orderNumber}".</p>
      </AppLayout>
    );
  }

  const orderProducts = orderProductsByOrderNumber?.[orderNumber] ?? [];

  const eventsByOrderProductId = new Map<number, ProductEvent<number>[]>();

  for (const orderProduct of orderProducts) {
    let events = eventsByProductCode?.[orderProduct.product_code] ?? [];

    events = events.filter((event) => event.referenceId === orderProduct.id);

    if (events) {
      eventsByOrderProductId.set(orderProduct.id, events);
    }
  }

  const client = clientsByCode?.[order.client_code];

  return (
    <AppLayout title={<h1>Pedido N°: {order.order_number}</h1>} user={props?.user} sidenav={<AppSidenav />}>
      <div className="border-b px-3 pb-5">
        <h1 className="text-lg font-medium">Pedido de {client?.name ?? order.client_code}</h1>
        <p className="text-xs">{client?.address}</p>
        <p>Fecha de creacion: {dayjs(order.entry_date).format("DD/MM/YYYY")}</p>
        <p>Fecha de aprobación: {dayjs(order.approval_date).format("DD/MM/YYYY")}</p>
        <p>Fecha de entrega: {dayjs(order.delivery_date).format("DD/MM/YYYY")}</p>
      </div>
      <Accordion type="single" collapsible className="w-full">
        {orderProducts.map((orderProduct) => {
          const product = productsByCode?.[orderProduct.product_code];

          if (!product) return <></>;

          return (
            <AccordionItem value={orderProduct.id.toString()} key={orderProduct.id} id={`accordion-${orderProduct.id}`}>
              <AccordionTrigger className="px-3">
                <div className="text-left">
                  <p
                    className={cn("text-lg", {
                      "bg-yellow-500": productRef === product.code,
                    })}
                  >
                    {orderProduct.ordered_quantity} x {product.code}
                  </p>
                  <p className="text-xs">
                    {product.description} - {product.additional_description}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3">
                {eventsByOrderProductId.get(orderProduct.id)?.map((event, i) => {
                  return <EventRenderer indexedEvents={indexedEvents} key={i} event={event} top assemblyById={assemblyById} productsByCode={productsByCode} />;
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </AppLayout>
  );
}

function EventRenderer(props: {
  event: ProductEvent<number> | null;
  indexedEvents: ProductEvent<number>[];
  top: boolean;
  productsByCode: NonNullable<Monolito['productsByCode']>;
  assemblyById: NonNullable<Monolito['assemblyById']>;
}) {
  const event = props.event;
  if (!event) {
    return <></>;
  }

  const product = props.productsByCode[event.productCode];
  const assembly = event.assemblyId && props.assemblyById[event.assemblyId];

  if (!product) return <></>;

  const parentEvent = event.parentEventIndex !== undefined ? props.indexedEvents[event.parentEventIndex]! : undefined;
  const assembliesQuantities =
    parentEvent?.originalQuantity && parentEvent.originalQuantity - parentEvent.quantity;

  const productRef = useProductRef();

  return (
    <div className="bg-stone-500 bg-opacity-10 px-2 py-2">
      {!props.top && (
        <Link
          href={`/producto/${event.productCode}`}
          className={cn("text-sm underline", {
            "bg-yellow-500": product.code === productRef,
          })}
        >
          {event.productCode}
        </Link>
      )}
      {!props.top && event.originalQuantity != undefined && <p>Cantidad pedida: {formatStockWithDecimals(event.originalQuantity)}</p>}
      {event.originalQuantity != undefined && (
        <p className="font-medium">Stock disponible a utilizar: {formatStockWithDecimals(event.quantity)}</p>
      )}
      {event.originalQuantity == undefined && (
        <p className="font-medium">
          Cantidad: {formatStockWithDecimals(event.quantity)}
          {assembly && (
            <span className="text-xs">
              {" "}
              (armado: {formatStockWithDecimals(assembly.quantity)} * {formatStockWithDecimals(assembliesQuantities ?? 1)})
            </span>
          )}
        </p>
      )}
      {(event.childEventsIndexes?.length ?? 0) > 0 && <p className="mt-2 font-semibold">Necesidad de insumos:</p>}
      {event.childEventsIndexes?.map((childEventIndex, i) => {
        return (
          <div className="m-3" key={i}>
            <EventRenderer indexedEvents={props.indexedEvents} event={props.indexedEvents[childEventIndex]!} top={false} assemblyById={props.assemblyById} productsByCode={props.productsByCode} />
          </div>
        );
      })}
    </div>
  );
}
"use client";
import dayjs from "dayjs";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import type { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { cn, formatStockWithDecimals } from "~/lib/utils";
import type { ProductEvent } from "~/mrp_data/transform_mrp_data";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";

function useProductRef() {
  const params = useSearchParams();
  return params?.get("product_ref") ?? null;
}

export default function OrderPage(props: { user?: NavUserData }) {
  const { data: monolito, isLoading: isLoadingData } = api.db.getMonolito.useQuery({
    data: {
      ordersByOrderNumber: true,
      orderProductsByOrderNumber: true,
      eventsByProductCode: true,
      clientsByCode: true,
      productsByCode: true,
      assemblyById: true
    }
  });

  const params = useParams<{ code: string }>();
  const orderNumber = decodeURIComponent(params?.code ?? "");
  const productRef = useProductRef();

  if (isLoadingData || !monolito) {
    return <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
      <Button variant="secondary" disabled>
        <Loader2Icon className="mr-2 animate-spin" /> Cargando datos
      </Button>
    </div>;
  }

  const order = monolito.data.ordersByOrderNumber?.get(orderNumber);
  if (!order) {
    return (
      <AppLayout title={<h1>Error 404</h1>} user={props?.user} sidenav={<AppSidenav />}>
        <Title>No se encontró el pedido</Title>
        <p>No encontramos ningún pedido con el número "{orderNumber}".</p>
      </AppLayout>
    );
  }

  const orderProducts = monolito.data.orderProductsByOrderNumber?.get(orderNumber) ?? [];

  const eventsByOrderProductId = new Map<number, ProductEvent[]>();

  for (const orderProduct of orderProducts) {
    let events = monolito.data.eventsByProductCode?.get(orderProduct.product_code) ?? [];

    events = events.filter((event) => event.referenceId === orderProduct.id);

    if (events) {
      eventsByOrderProductId.set(orderProduct.id, events);
    }
  }

  const client = monolito.data.clientsByCode?.get(order.client_code);
  console.log(eventsByOrderProductId);

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
          const product = monolito.data.productsByCode?.get(orderProduct.product_code);

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
                  return <EventRenderer key={i} event={event} top monolito={monolito} />;
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </AppLayout>
  );
}

function EventRenderer(props: { event: ProductEvent | null; top: boolean; monolito: RouterOutputs['db']['getMonolito']; }) {
  const event = props.event;
  if (!event) {
    return <></>;
  }

  const data = props.monolito.data;

  const product = data.productsByCode!.get(event.productCode);
  const assembly = event.assemblyId && data.assemblyById!.get(event.assemblyId);

  if (!product) return <></>;

  const assembliesQuantities =
    event.parentEvent?.originalQuantity && event.parentEvent.originalQuantity - event.parentEvent.quantity;

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
      {(event.childEvents?.length ?? 0) > 0 && <p className="mt-2 font-semibold">Necesidad de insumos:</p>}
      {event.childEvents?.map((childEvent, i) => {
        return (
          <div className="m-3" key={i}>
            <EventRenderer event={childEvent} top={false} monolito={props.monolito} />
          </div>
        );
      })}
    </div>
  );
}

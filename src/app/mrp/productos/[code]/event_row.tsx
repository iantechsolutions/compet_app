import dayjs from "dayjs";
import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { TableCell, TableRow } from "~/components/ui/table";
import { cn, formatStock } from "~/lib/utils";
import type { ProductEvent } from "~/mrp_data/transform_mrp_data";
import type { Monolito } from "~/server/api/routers/db";

export function ProductEventRow(props: {
  event: ProductEvent<number>;
  indexedEvents: ProductEvent<number>[];
  productCode: string;
  nobg?: boolean;
  nostate?: boolean;
  nodate?: boolean;
  nostock?: boolean;
  orderProductsById: NonNullable<Monolito['orderProductsById']>;
  ordersByOrderNumber: NonNullable<Monolito['ordersByOrderNumber']>;
  productImportsById: NonNullable<Monolito['productImportsById']>;
  importsById: NonNullable<Monolito['importsById']>;
}) {
  const { event, indexedEvents, productCode } = props;

  const orderProducts = event.type === "order" ? props.orderProductsById[event.referenceId] : undefined;
  const order = orderProducts ? props.ordersByOrderNumber[orderProducts.order_number] : undefined;

  const productImport = event.type === "import" ? props.productImportsById[event.referenceId] : undefined;
  const importation = productImport ? props.importsById[productImport.import_id] : undefined;

  const hasChildren = (event.childEventsIndexes?.length ?? 0) > 0;

  let childrenHasChildren = false;

  if (hasChildren) {
    for (const e of event.childEventsIndexes!) {
      const childEvent = indexedEvents[e];
      if ((childEvent?.childEventsIndexes?.length ?? 0) > 0) {
        childrenHasChildren = true;
        break;
      }
    }
  }

  const parentEvent = event.parentEventIndex !== undefined ? indexedEvents[event.parentEventIndex]! : undefined;
  const parentProductCode = parentEvent?.productCode;

  const parentParentEvent = parentEvent?.parentEventIndex !== undefined ? indexedEvents[parentEvent.parentEventIndex]! : undefined;
  const parentParentProductCode = parentParentEvent?.productCode;

  let typeName: React.ReactNode = "";

  let supplyName = "Insumo";

  if (event.isForecast) {
    if (event.forecastType === "sold") {
      supplyName = "Ins. forecast fact.";
    } else if (event.forecastType === "budget") {
      supplyName = "Ins. forecast presup.";
    }
  }

  if (event.type === "import") {
    typeName = "Importación";
  } else if (event.type === "order") {
    typeName = "Pedido";
  } else if (event.type === "forecast") {
    typeName = "Forecast";

    if (event.forecastType === "sold") {
      typeName = "Forecast (facturación)";
    } else if (event.forecastType === "budget") {
      typeName = "Forecast (presupuestos)";
    }
  } else if (event.type === "supply") {
    typeName = "Insumo para armado";

    if (parentProductCode && !hasChildren) {
      typeName = (
        <>
          <span className="font-medium underline">{supplyName}</span>
          {" -> Armado"}
        </>
      );
    }

    if (parentProductCode && hasChildren) {
      typeName = (
        <>
          {supplyName}
          {" -> "}
          <span className="font-medium underline">Semielaborado</span>
          {" -> Armado"}
        </>
      );
    }

    if (parentEvent?.parentEventIndex !== undefined) {
      typeName = (
        <>
          <span className="font-medium underline">{supplyName}</span>
          {" -> Semielaborado -> Armado"}
        </>
      );
    }

    if (!parentProductCode && hasChildren) {
      typeName = (
        <>
          {supplyName}
          {" -> "}
          <span className="font-medium underline">Armado</span>
        </>
      );
    }
  }

  if (!parentProductCode && hasChildren) {
    typeName = (
      <>
        {supplyName}
        {" -> "}
        <span className="font-medium underline">Pedido (armado)</span>
      </>
    );
  }

  if (!parentProductCode && hasChildren && childrenHasChildren) {
    typeName = (
      <>
        {supplyName}
        {" -> Semielaborado -> "}
        <span className="font-medium underline">Pedido (armado)</span>
      </>
    );
  }

  let orderNumber: string | undefined;
  if (event.type === "order") {
    orderNumber = order?.order_number;
  }
  if (event.type === "supply") {
    orderNumber = props.orderProductsById[event.referenceId]?.order_number;
  }
  if (event.type === "forecast") {
    orderNumber = "forecast";
  }

  let stockComp: React.ReactNode = formatStock(event.quantity);

  if (event.originalQuantity && Math.round(event.originalQuantity) != Math.round(event.quantity)) {
    stockComp = (
      <>
        {formatStock(event.quantity)}{" "}
        <span className="bg-stone-700 bg-opacity-10 px-1 opacity-60">
          {`<-`} {formatStock(event.originalQuantity)}
        </span>
      </>
    );
  }

  return (
    <TableRow
      className={cn({
        // 'bg-green-100': event.type === 'order' || (event.type === 'supply' && !event.isForecast),
        // 'bg-blue-100': event.type === 'import',
        "bg-yellow-100": (event.type === "forecast" || event.isForecast) && !props.nobg,
      })}
    >
      <TableCell className="whitespace-nowrap">
        {stockComp}

        {/* {formatStock(event.originalQuantity ?? event.quantity)}
            {event.forecastType === 'budget' && (
                event.originalQuantity && <span className="text-xs ml-2">
                    {`(${(data.forecastData!.forecastProfile.budgetsInclusionFactor * 100).toFixed(1)}% de ${formatStock(event.originalQuantity)})`}
                </span>
            )} */}
      </TableCell>
      <TableCell className="whitespace-nowrap">{typeName}</TableCell>
      {!props.nodate && <TableCell className="whitespace-nowrap">{dayjs(event.date).format("YYYY-MM-DD")}</TableCell>}
      <TableCell className="whitespace-nowrap">
        <EventHoverCard event={event} indexedEvents={indexedEvents}>
          <div className="inline-block">
            <ReferenceComponent orderNumber={event.isForecast ? "forecast" : orderNumber} productCode={productCode} />
            {event.type === "import" && importation?.id}
            {parentProductCode && (
              <>
                {" -> "}
                <Link
                  // state={{ allowBack: true }}
                  className="underline"
                  href={{
                    pathname: `/mrp/productos/${encodeURIComponent(parentProductCode)}`,
                    search: `?product_ref=${encodeURIComponent(productCode)}`,
                  }}
                >
                  Insumo de {parentProductCode}
                </Link>
              </>
            )}
            {parentParentProductCode && (
              <>
                {" -> "}
                <Link
                  // state={{ allowBack: true }}
                  className="underline"
                  href={{
                    pathname: `/mrp/productos/${encodeURIComponent(parentParentProductCode)}`,
                    search: `?product_ref=${encodeURIComponent(productCode)}`,
                  }}
                >
                  Insumo de {parentParentProductCode}
                </Link>
              </>
            )}
          </div>
        </EventHoverCard>
      </TableCell>
      <TableCell
        className={cn("font-medium", {
          "font-medium text-red-500": event.productAccumulativeStock < 0,
        })}
      >
        {!props.nostock && formatStock(event.productAccumulativeStock)}
      </TableCell>
      {!props.nostate && <TableCell>{event.expired && "Comprometido"}</TableCell>}
    </TableRow>
  );
}

function EventHoverCard(props: { event: ProductEvent<number>; indexedEvents: ProductEvent<number>[]; children: React.ReactNode }) {
  const { event, indexedEvents } = props;
  const childEvents = (event.childEventsIndexes ?? []).map(idx => indexedEvents[idx]!);
  const parentEvent = event.parentEventIndex ? indexedEvents[event.parentEventIndex]! : undefined;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{props.children}</HoverCardTrigger>
      <HoverCardContent className="w-[300px]">
        {parentEvent && <p className="mb-2 font-medium">Insumo de</p>}
        {parentEvent && (
          <Link
            // state={{ allowBack: true }}
            className="block underline"
            href={`/mrp/productos/${encodeURIComponent(parentEvent.productCode)}`}
          >
            {parentEvent.productCode} (cant. original: {formatStock(parentEvent.originalQuantity ?? 0)})
          </Link>
        )}

        {parentEvent && childEvents.length > 0 && <div className="h-2" />}
        {childEvents.length > 0 && (
          <>
            <p className="mb-2 font-medium">Consumo de insumos</p>
            {childEvents?.map((childEvent, i) => {
              return (
                <Link
                  key={i}
                  // state={{ allowBack: true }}
                  className="block underline"
                  href={`/mrp/productos/${encodeURIComponent(childEvent.productCode)}`}
                >
                  {childEvent.productCode} (cant: {formatStock(childEvent.quantity)})
                </Link>
              );
            })}
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function ReferenceComponent(props: { orderNumber?: string; productCode: string }) {
  if (!props.orderNumber) return <></>;

  if (props.orderNumber === "forecast") {
    return <span className="underline">Forecast</span>;
  }

  return (
    <Link
      href={{
        pathname: `/mrp/pedidos/${props.orderNumber}`,
        search: `?product_ref=${encodeURIComponent(props.productCode)}`,
      }}
      className="underline"
    >
      {props.orderNumber}
    </Link>
  );
}
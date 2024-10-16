"use client";

import { useMemo } from "react";
import { useCurrentProduct } from "../product_provider";
import ClientsOrdersQuantityPieChart from "./clients-orders-pie-chart";
import { Button } from "~/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { api } from "~/trpc/react";

export default function ProductInfoPage() {
  const product = useCurrentProduct();

  const { data: orderProductsByProductCode, isLoading: isLoadingOrdProd } = api.db.getMOrderProductsByProductCode.useQuery()
  const { data: ordersByOrderNumber, isLoading: isLoadingOrdNum } = api.db.getMOrdersByOrderNumber.useQuery();
  const { data: clientsByCode, isLoading: isLoadingClients } = api.db.getMClientsByCode.useQuery();
  const isLoading = isLoadingClients || isLoadingOrdNum || isLoadingOrdProd;

  const orders = useMemo(() => {
    if (!orderProductsByProductCode || !ordersByOrderNumber) {
      return null;
    }

    const orderProducts = orderProductsByProductCode?.get(product.code) ?? [];

    return orderProducts.map((orderProduct) => {
      const order = ordersByOrderNumber?.get(orderProduct.order_number);
      return {
        ...orderProduct,
        order,
      };
    });
  }, [ordersByOrderNumber, orderProductsByProductCode]);

  if (isLoading || !orders) {
    return <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
      <Button variant="secondary" disabled>
        <Loader2Icon className="mr-2 animate-spin" /> Cargando datos
      </Button>
    </div>;
  }

  return (
    <>
      <ClientsOrdersQuantityPieChart
        clientsByCode={clientsByCode!}
        orders={orders.map((o) => ({
          quantity: o.ordered_quantity,
          client_code: o.order!.client_code,
        }))}
      />
    </>
  );
}

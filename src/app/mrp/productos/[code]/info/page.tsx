"use client";

import { useMemo } from "react";
import { useCurrentProduct } from "../product_provider";
import ClientsOrdersQuantityPieChart from "./clients-orders-pie-chart";
import { Button } from "~/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { api } from "~/trpc/react";

export default function ProductInfoPage() {
  const product = useCurrentProduct();

  const { data: monolito, isLoading: isLoadingData } = api.db.getMonolito.useQuery({
    data: {
      orderProductsByProductCode: true,
      ordersByOrderNumber: true,
      clientsByCode: true
    }
  });

  const orders = useMemo(() => {
    if (!monolito) {
      return null;
    }

    const data = monolito.data;
    const orderProducts = data.orderProductsByProductCode?.get(product.code) ?? [];

    return orderProducts.map((orderProduct) => {
      const order = data.ordersByOrderNumber?.get(orderProduct.order_number);
      return {
        ...orderProduct,
        order,
      };
    });
  }, [monolito]);

  if (isLoadingData || !monolito || !orders) {
    return <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
      <Button variant="secondary" disabled>
        <Loader2Icon className="mr-2 animate-spin" /> Cargando datos
      </Button>
    </div>;
  }

  return (
    <>
      <ClientsOrdersQuantityPieChart
        monolito={monolito}
        orders={orders.map((o) => ({
          quantity: o.ordered_quantity,
          client_code: o.order!.client_code,
        }))}
      />
    </>
  );
}

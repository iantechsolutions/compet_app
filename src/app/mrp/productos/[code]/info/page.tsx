"use client";

import { useMemo } from "react";
import { useCurrentProduct } from "../product_provider";
import ClientsOrdersQuantityPieChart from "./clients-orders-pie-chart";
import { useMRPData } from "~/components/mrp-data-provider";

export default function ProductInfoPage() {
  const product = useCurrentProduct();

  const { orderProductsByProductCode, ordersByOrderNumber, clientsByCode } = useMRPData();
  /* const { data: orderProductsByProductCode, isLoading: isLoadingOrdProd } = api.db.getMOrderProductsByProductCode.useQuery()
  const { data: ordersByOrderNumber, isLoading: isLoadingOrdNum } = api.db.getMOrdersByOrderNumber.useQuery();
  const { data: clientsByCode, isLoading: isLoadingClients } = api.db.getMClientsByCode.useQuery();
  const isLoading = isLoadingClients || isLoadingOrdNum || isLoadingOrdProd; */

  const orders = useMemo(() => {
    const orderProducts = orderProductsByProductCode?.get(product.code) ?? [];

    return orderProducts.map((orderProduct) => {
      const order = ordersByOrderNumber?.get(orderProduct.order_number);
      return {
        ...orderProduct,
        order,
      };
    });
  }, [ordersByOrderNumber, orderProductsByProductCode]);

  return (
    <>
      <ClientsOrdersQuantityPieChart
        clientsByCode={clientsByCode}
        orders={orders.map((o) => ({
          quantity: o.ordered_quantity,
          client_code: o.order!.client_code,
        }))}
      />
    </>
  );
}
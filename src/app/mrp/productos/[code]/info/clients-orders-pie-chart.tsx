import React from "react";
import { Chart } from "react-google-charts";
import type { RouterOutputs } from "~/trpc/shared";

type Order = {
  client_code: string;
  quantity: number;
};

export default function ClientsOrdersQuantityPieChart({ orders, monolito }: { orders: Order[]; monolito: RouterOutputs['db']['getMonolito']; }) {
  const mrpData = monolito.data;

  const data: [string, string | number][] = [["Clientes", "Cantidad adquirida"]];

  for (const order of orders) {
    const client = mrpData.clientsByCode!.get(order.client_code);
    if (client) {
      data.push([client.name, order.quantity]);
    }
  }

  return <Chart data={data} chartType="PieChart" options={{ title: "Vendido por cliente" }} />;
}

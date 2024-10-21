import React from "react";
import { Chart } from "react-google-charts";
import type { Monolito } from "~/server/api/routers/db";

type Order = {
  client_code: string;
  quantity: number;
};

export default function ClientsOrdersQuantityPieChart({ orders, clientsByCode }: { orders: Order[]; clientsByCode: NonNullable<Monolito['clientsByCode']>; }) {
  const data: [string, string | number][] = [["Clientes", "Cantidad adquirida"]];

  for (const order of orders) {
    const client = clientsByCode[order.client_code];
    if (client) {
      data.push([client.name, order.quantity]);
    }
  }

  return <Chart data={data} chartType="PieChart" options={{ title: "Vendido por cliente" }} />;
}
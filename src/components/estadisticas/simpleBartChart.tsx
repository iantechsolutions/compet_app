/* eslint-disable @typescript-eslint/no-unsafe-member-access */
"use client";
import { type TooltipProps } from 'recharts';
import {
  type ValueType,
  type NameType,
} from 'recharts/types/component/DefaultTooltipContent';
import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import CustomLegend from "./custom-legend";
type ClientSales = {
  name?: string;
  totalSales: number;
  amountOfSales: number;
}
interface graphicProps {
  data: ClientSales[];
}
export default function SimpleBartChart({ data }: graphicProps) {

  function getAmountOfSales(data: ClientSales[], label: string): number {
    for (const client of data) {
      if (client.name === label) {
        return client.amountOfSales;
      }
    }
    return 0;
  }



  const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (active && payload) {
      return (
        <div className="bg-white opacity-70 p-3">
          <p className="font-bold">{`${label}`}</p>
          <p className="">{`Cantidad de Unidades vendidas: ${(payload[0]?.value ?? 0) as number}`} </p>
          <p className="">{`Cantidad de Ventas: ${getAmountOfSales(data, label as string)}`} </p>
        </div>
      );
    }

    return null;
  };

  return (
    <ResponsiveContainer width="48%" height="48%" aspect={2}>
      <>
        <BarChart
          width={500}
          height={400}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          {
            data.length === 0 ? null : (<Tooltip accessibilityLayer={false} content={<CustomTooltip />} />)
          }

          <Legend content={<CustomLegend textContent="Cantidad de unidades vendidas a clientes" />} />
          <Bar dataKey="totalSales" fill="#8884d8" activeBar={<Rectangle fill="pink" stroke="blue" />} />

        </BarChart>
      </>
    </ResponsiveContainer>
  );
}


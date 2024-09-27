"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import CustomLegend from "./custom-legend";
import { format, parse } from "date-fns";
import LegendContent from "./custom-legend";
interface GraphicProps {
  data: { date: string; motive: string; amount: number }[];
}
export default function StackedAreaChart({ data }: GraphicProps) {
  const uniqueMotives = new Set(data.map((stat) => stat.motive));
  const dateMap = new Map<string, { motive: string; amount: number }[]>();
  for (const stat of data) {
    if (dateMap.has(stat.date)) {
      dateMap.get(stat.date)?.push({ motive: stat.motive, amount: Math.round(stat.amount) });
    } else {
      dateMap.set(stat.date, [{ motive: stat.motive, amount: Math.round(stat.amount) }]);
    }
  }

  // const allFields = new Set<string>();
  const result: Record<string, unknown>[] = [];

  // // Recolectar todos los campos generados
  for (const [date, value] of dateMap) {
    const transformedValue: Record<string, unknown> = {};
    transformedValue.name = date;
    for (const field of value) {
      transformedValue[field.motive] = field.amount;
    }
    result.push(transformedValue);
  }
  // // Asegurarse de que cada objeto tenga todos los campos, asignando 0 a los campos faltantes
  // for (const obj of transformedArray) {
  //     for (const field of allFields) {
  //         if (!(field in obj)) {
  //             obj[field] = 0;
  //         }
  //     }
  // }
  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#d0ed57", "#a4de6c", "#8dd1e1", "#83a6ed", "#8e4585", "#ff8042"];

  // if (result.length === 0) {
  //     return <div>No hay datos para mostrar</div>
  // }
  return (
    <ResponsiveContainer width="48%" height="48%" aspect={2}>
      <>
        <AreaChart
          width={500}
          height={400}
          data={result}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tickFormatter={(tick: string) => {
              const date = parse(tick, "yyyy-MM-dd", new Date());
              return format(date, "MM/yyyy");
            }}
            interval={"preserveStartEnd"}
          />
          <YAxis />
          <Tooltip />
          <Legend  content={<LegendContent textContent="Consumo del insumo a traves del tiempo"/>}/>
          {Array.from(uniqueMotives).map((motive, index) => (
            <Area
              key={index}
              type="monotone"
              dataKey={motive}
              stackId="1"
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
            />
          ))}
        </AreaChart>
      </>
    </ResponsiveContainer>
  );
}


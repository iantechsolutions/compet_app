"use client"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
interface GraphicProps {
    data: { date: string, motive: string, amount: number }[];
}
export default function StackedAreaChart({ data }: GraphicProps) {


    const uniqueMotives = new Set(data.map((stat) => stat.motive));
    const dateMap = new Map<string, { motive: string, amount: number }[]>()
    for (const stat of data) {
        if (dateMap.has(stat.date)) {
            dateMap.get(stat.date)?.push({ motive: stat.motive, amount: Math.round(stat.amount) });
        } else {
            dateMap.set(stat.date, [{ motive: stat.motive, amount: Math.round(stat.amount) }]);
        }
    };

    // const transformedArray: Record<string, string | number>[] = [];
    // const allFields = new Set<string>();
    const result: {}[] = [];

    // // Recolectar todos los campos generados
    for (const [date, value] of dateMap) {
        const transformedValue: { [key: string]: any } = {};
        transformedValue["name"] = date;
        for (const field of value) {
            transformedValue[field.motive] = field.amount;
        }
        console.log("transformedValue", transformedValue)
        result.push(transformedValue);
    }
    console.log("result", result)
    // // Asegurarse de que cada objeto tenga todos los campos, asignando 0 a los campos faltantes
    // for (const obj of transformedArray) {
    //     for (const field of allFields) {
    //         if (!(field in obj)) {
    //             obj[field] = 0;
    //         }
    //     }
    // }
    const colors = [
        "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#d0ed57", "#a4de6c", "#8dd1e1", "#83a6ed", "#8e4585", "#ff8042"
    ];

    if (result.length === 0) {
        return <div>No hay datos para mostrar</div>
    }
    console.log("transformedArray", result)
    return (
        <ResponsiveContainer width="48%" aspect={2}>
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
                <XAxis dataKey="name"
                />
                <YAxis />
                <Tooltip />

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
        </ResponsiveContainer>
    )
}
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
    const dateMap = new Map<string, { motive: string, amount: number }[]>()
    for (const stat of data) {
        if (dateMap.has(stat.date)) {
            dateMap.get(stat.date)!.push({ motive: stat.motive, amount: stat.amount });
        } else {
            dateMap.set(stat.date, [{ motive: stat.motive, amount: stat.amount }]);
        }
    };

    const transformedArray: Record<string, string | number>[] = [];
    const allFields = new Set<string>();

    // Recolectar todos los campos generados
    for (const [key, value] of dateMap) {
        const arrayFields = value;
        const objFields = arrayFields.reduce((acc, field) => {
            allFields.add(field.motive);
            return { ...acc, [field.motive]: field.amount };
        }, {});
        transformedArray.push({
            name: key,
            ...objFields
        });
    }

    // Asegurarse de que cada objeto tenga todos los campos, asignando 0 a los campos faltantes
    for (const obj of transformedArray) {
        for (const field of allFields) {
            if (!(field in obj)) {
                obj[field] = 0;
            }
        }
    }
    const colors = [
        "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#d0ed57", "#a4de6c", "#8dd1e1", "#83a6ed", "#8e4585", "#ff8042"
    ];

    if (transformedArray.length === 0) {
        return <div>No hay datos para mostrar</div>
    }
    console.log("transformedArray", transformedArray)
    return (
        <ResponsiveContainer width="48%" aspect={2}>
            <AreaChart
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
                <XAxis dataKey="name"
                />
                <YAxis />
                <Tooltip />

                {Array.from(allFields).map((field, index) => (
                    <Area
                        key={field}
                        type="monotone"
                        dataKey={field}
                        stackId="1"
                        stroke={colors[index % colors.length]}
                        fill={colors[index % colors.length]}
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    )
}
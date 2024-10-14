import { Bar, BarChart, CartesianGrid, Legend, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CustomLegend from "./custom-legend";

interface RecutsProps{
    data?: Map<string, number>
}
export default function SimpleBartChartRecuts(props: RecutsProps) {
    const data = formatData(props.data);
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
                    {/* <Tooltip /> */}
                    <Legend content={<CustomLegend textContent="Cantidad de recortes por medida" />} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Bar dataKey="cantidad" fill="#8884d8" activeBar={<Rectangle fill="pink" stroke="blue" />} />
                </BarChart>
            </>
        </ResponsiveContainer>
    )
}


function formatData(data?: Map<string, number>) {
    const dataArray= Array.from(data ?? [], ([name, cantidad]) => ({
        name,
        cantidad,
    }));
    return dataArray.filter((item)=> item.cantidad > 0);
}
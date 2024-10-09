import { Bar, BarChart, CartesianGrid, Legend, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SimpleBartChartRecuts() {
    const data = [
        {
            name: '24 mm',
            cantidad: 12,
            pv: 2400,
        },
        {
            name: '45 mm',
            cantidad: 3000,
            pv: 1398,
        },
        {
            name: '234 mm',
            cantidad: 2000,
            pv: 9800,
        },
        {
            name: '0.3 m',
            cantidad: 2780,
            pv: 3908,
        },
        {
            name: '23cm',
            cantidad: 1890,
            pv: 4800,
        },
        {
            name: '12 cm ',
            cantidad: 2390,
            pv: 3800,
        },
        {
            name: '55mm',
            cantidad: 3490,
            pv: 4300,
        },
    ];
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
                    <Tooltip />
                    <Legend />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Bar dataKey="cantidad" fill="#8884d8" activeBar={<Rectangle fill="pink" stroke="blue" />} />
                </BarChart>
            </>
        </ResponsiveContainer>
    )
}


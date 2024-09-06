"use client"
import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
interface graphicProps {
    data: { name?: string, totalSales: number, amountOfSales: number }[];
}
export default function SimpleBartChart({ data }: graphicProps) {
    return (
        <ResponsiveContainer width="48%" height="48%" aspect={2}>
            <>
            <p className=" py-2 pl-6">●  Cantidad de unidades vendidas a clientes</p>
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
                {/* <Tooltip
                accessibilityLayer={false}
                
                 /> */}
                <Bar dataKey="totalSales" fill="#8884d8" activeBar={<Rectangle fill="pink" stroke="blue" />} />
            </BarChart>
            </>
        </ResponsiveContainer>
    );
}